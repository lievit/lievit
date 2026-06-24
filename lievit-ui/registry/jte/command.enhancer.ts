/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * command enhancer (v-next re-forge): lifecycle-aware enhancer for the CONTROLLED/UNCONTROLLED
 * command palette overlay (registry/jte/command.jte).
 *
 * Responsibilities on activation of a panel ([data-lievit-command]):
 *   1. Client-side filtering: `input` events on the search box hide non-matching
 *      [data-lievit-item] items, hide group containers whose items are all hidden, and toggle
 *      the [data-slot="empty"] live region.
 *   2. Enter dispatch: keydown Enter on the search input reads aria-activedescendant to find
 *      the active option, then dispatches executeAction (plain), openPageAction (data-page-id),
 *      or navigates (data-href). collection-nav.enhancer.ts owns ArrowUp/Down/Home/End key
 *      movement; this enhancer only handles Enter.
 *   3. Backspace in nested page: if the search input is empty and the panel carries a non-empty
 *      data-page, Backspace fires backToRootAction.
 *   4. Global shortcut: while the panel is open (in the DOM), a keydown listener on document
 *      fires closeAction when the panel's data-shortcut chord is pressed (e.g. Ctrl+K / Cmd+K).
 *      NOTE: opening the palette from a closed state (palette not in DOM) is the CALLER's
 *      responsibility (typically a trigger button with l:click="${openAction}" + the same
 *      keyboard shortcut registered on the surrounding page).
 *
 * Shared enhancers (do NOT edit their files):
 *   focus-trap.enhancer.ts  -- Tab cycling, scroll-lock, Escape fires closeAction.
 *   collection-nav.enhancer.ts -- ArrowUp/Down/Home/End navigation, updates aria-activedescendant
 *     on the input (#${inputId}) via data-lievit-collection-activedescendant-target.
 *
 * Idempotency: data-lievit-rt-command-active is stamped on the panel while active; re-scanning the
 * same panel is a no-op.
 *
 * Lifecycle integration: installCommandEnhancer(runtime) registers onComponentInit (scans for
 * panels on every component mount / morph) and afterCall (deactivates panels removed from DOM).
 *
 * Backward-compatible export: commandFilter (pure, DOM-free) is kept for unit tests.
 * enhanceCommand / enhanceAllCommands from the static-palette era are REMOVED (clean break).
 * Use installCommandEnhancer(runtime) for the new surface.
 */

import type { LievitRuntime } from "../../runtime/runtime.js";

const PANEL_ATTR = "data-lievit-command";
const ACTIVE_ATTR = "data-lievit-rt-command-active";

interface PanelState {
  readonly panel: HTMLElement;
  readonly shortcutHandler: EventListener;
  readonly inputHandler: EventListener;
  readonly keydownHandler: EventListener;
}

/** Currently active panels. Map so we can iterate on afterCall to prune stale ones. */
const activePanels = new Map<HTMLElement, PanelState>();

// ---------------------------------------------------------------------------
// Pure filter core (exported for unit tests)
// ---------------------------------------------------------------------------

/**
 * Decide, for each command label, whether it matches a query. Case- and accent-insensitive
 * substring match anywhere in the label, preserving order. An empty/blank query matches
 * every item. DOM-free; unit-testable without a browser.
 *
 * @returns a boolean array index-aligned with `labels`: true == item is shown.
 */
export function commandFilter(labels: string[], query: string): boolean[] {
  const q = normalize(query);
  if (q === "") return labels.map(() => true);
  return labels.map((label) => normalize(label).includes(q));
}

/** Lowercase + strip diacritics so "Citta" matches "città" and case never blocks a match. */
function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

// ---------------------------------------------------------------------------
// Panel activation / deactivation
// ---------------------------------------------------------------------------

/**
 * Parse a shortcut string like "mod+k" into a predicate that matches KeyboardEvent.
 * "mod" means Cmd on Mac, Ctrl elsewhere.
 */
function shortcutMatcher(shortcut: string): (e: KeyboardEvent) => boolean {
  const parts = shortcut.toLowerCase().split("+");
  const key = parts[parts.length - 1];
  const needsMod = parts.includes("mod");
  const needsCtrl = parts.includes("ctrl");
  const needsAlt = parts.includes("alt");
  const needsShift = parts.includes("shift");
  const isMac =
    typeof navigator !== "undefined" && /mac/i.test(navigator.platform);
  return (e: KeyboardEvent): boolean => {
    if (e.key.toLowerCase() !== key) return false;
    if (needsMod && !(isMac ? e.metaKey : e.ctrlKey)) return false;
    if (needsCtrl && !e.ctrlKey) return false;
    if (needsAlt && !e.altKey) return false;
    if (needsShift && !e.shiftKey) return false;
    return true;
  };
}

/**
 * Apply client-side filtering: hide non-matching items, hide empty group containers,
 * toggle the empty state.
 */
function applyFilter(panel: HTMLElement, query: string): void {
  const items = Array.from(panel.querySelectorAll<HTMLElement>("[data-lievit-item]"));
  const labels = items.map((el) => {
    // The label text is inside the span[style*=flex:1] child of option-inner.
    const labelEl = el.querySelector<HTMLElement>("[data-slot='option-inner'] span:not([aria-hidden])");
    return labelEl?.textContent?.trim() ?? "";
  });
  const shown = commandFilter(labels, query);
  items.forEach((el, i) => {
    el.hidden = !shown[i];
  });

  // Hide group containers whose inner items are all hidden.
  const groups = Array.from(panel.querySelectorAll<HTMLElement>("[data-slot='group']"));
  for (const group of groups) {
    const groupItems = Array.from(group.querySelectorAll<HTMLElement>("[data-lievit-item]"));
    const anyVisible = groupItems.some((el) => !el.hidden);
    group.hidden = !anyVisible;
  }

  // Toggle the empty live region.
  const emptyEl = panel.querySelector<HTMLElement>("[data-slot='empty']");
  const anyItemVisible = items.some((el) => !el.hidden);
  if (emptyEl != null) {
    emptyEl.hidden = anyItemVisible;
  }
}

/**
 * Activate a single panel. Idempotent (stamped ACTIVE_ATTR guards re-activation).
 */
export function activatePanel(panel: HTMLElement, runtime: LievitRuntime): void {
  if (panel.hasAttribute(ACTIVE_ATTR)) return;
  panel.setAttribute(ACTIVE_ATTR, "");

  const input = panel.querySelector<HTMLInputElement>("input[role='combobox']");
  if (input == null) return;

  // Seed: everything visible, no active item.
  applyFilter(panel, "");

  // Input filtering.
  const inputHandler: EventListener = () => {
    applyFilter(panel, input.value);
  };
  input.addEventListener("input", inputHandler);

  // Keydown: Enter dispatch + Backspace-in-page.
  const keydownHandler: EventListener = (rawEvent: Event): void => {
    const e = rawEvent as KeyboardEvent;

    if (e.key === "Enter") {
      // Find the active option via aria-activedescendant.
      const activeId = input.getAttribute("aria-activedescendant");
      if (!activeId) return;
      const option = panel.querySelector<HTMLElement>(`#${CSS.escape(activeId)}`);
      if (option == null) return;
      if (option.getAttribute("aria-disabled") === "true") return;

      e.preventDefault();
      const pageId = option.dataset["pageId"];
      const href = option.dataset["href"];
      const cmdId = option.dataset["id"] ?? "";
      const openPageAction = panel.dataset["openPageAction"] ?? "openPage";
      const executeAction = panel.dataset["executeAction"] ?? "executeCommand";

      if (pageId != null && pageId !== "") {
        void runtime.callAction(option, openPageAction, { trigger: option, commandId: pageId });
      } else if (href != null && href !== "") {
        window.location.href = href;
      } else {
        void runtime.callAction(option, executeAction, { trigger: option, commandId: cmdId });
      }
      return;
    }

    if (e.key === "Backspace") {
      const page = panel.dataset["page"] ?? "";
      if (page !== "" && input.value === "") {
        e.preventDefault();
        const backAction = panel.dataset["backToRootAction"] ?? "backToRoot";
        void runtime.callAction(panel, backAction, { trigger: panel });
      }
    }
  };
  input.addEventListener("keydown", keydownHandler);

  // Global shortcut: while panel is in DOM, the shortcut closes it.
  const shortcutStr = panel.dataset["shortcut"] ?? "";
  const matches = shortcutStr !== "" ? shortcutMatcher(shortcutStr) : null;
  const closeAction = panel.dataset["lievitEscapeAction"] ??
    panel.getAttribute("data-lievit-escape-action") ??
    "close";

  const shortcutHandler: EventListener = (rawEvent: Event): void => {
    if (matches == null) return;
    const e = rawEvent as KeyboardEvent;
    if (matches(e)) {
      e.preventDefault();
      void runtime.callAction(panel, closeAction, { trigger: panel });
    }
  };
  document.addEventListener("keydown", shortcutHandler);

  activePanels.set(panel, { panel, shortcutHandler, inputHandler, keydownHandler });
}

/**
 * Deactivate a panel that has left the DOM: remove document listeners and clear the state.
 */
function deactivatePanel(panel: HTMLElement): void {
  const state = activePanels.get(panel);
  if (state == null) return;
  document.removeEventListener("keydown", state.shortcutHandler);
  const input = panel.querySelector<HTMLInputElement>("input[role='combobox']");
  if (input != null) {
    input.removeEventListener("input", state.inputHandler);
    input.removeEventListener("keydown", state.keydownHandler);
  }
  panel.removeAttribute(ACTIVE_ATTR);
  activePanels.delete(panel);
}

// ---------------------------------------------------------------------------
// Runtime integration
// ---------------------------------------------------------------------------

/**
 * Install the command enhancer on a LievitRuntime. Registers onComponentInit (scans every
 * component root for [data-lievit-command] panels after mount / morph) and afterCall (deactivates
 * panels that the morph has removed from the DOM).
 *
 * @param runtime - the runtime to extend
 * @returns an unsubscribe function
 */
export function installCommandEnhancer(runtime: LievitRuntime): () => void {
  return runtime.use({
    onComponentInit(ctx) {
      // The root itself could carry the panel attribute.
      if ((ctx.root as HTMLElement).hasAttribute(PANEL_ATTR)) {
        activatePanel(ctx.root as HTMLElement, runtime);
      }
      for (const el of Array.from(
        ctx.root.querySelectorAll<HTMLElement>(`[${PANEL_ATTR}]`),
      )) {
        activatePanel(el, runtime);
      }
    },
    afterCall() {
      // Prune panels that the morph removed from the DOM.
      for (const [panel] of activePanels) {
        if (!document.body.contains(panel)) {
          deactivatePanel(panel);
        }
      }
    },
  });
}
