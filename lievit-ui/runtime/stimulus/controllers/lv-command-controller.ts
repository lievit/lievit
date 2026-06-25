/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * `lv-command` -- the CONTROLLED/UNCONTROLLED command-palette overlay, as a Stimulus controller
 * (the conversion of `registry/jte/command.enhancer.ts` + its use of `focus-trap.enhancer.ts`).
 * Mounted ON THE PANEL via `data-controller="lv-command"`; the panel carries the established
 * lievit contract attributes the template stamps:
 *
 * - `data-lv-wire-close="<closeAction>"` -- PRESENT only on a wire-CONTROLLED palette (the caller's
 *   Wire component owns the open state). Its presence drives {@link DismissableController.isControlled};
 *   Escape and the global shortcut fire that action ONLY when present. ABSENT => uncontrolled => the
 *   close is a client-only no-op, ZERO round-trip (the controlled/uncontrolled doctrine, wire-410
 *   fix). Read by the base, not here.
 * - `data-shortcut="<chord>"` -- the global open/close chord (e.g. `mod+k`); while the panel is in
 *   the DOM, pressing it CLOSES the palette (opening from closed is the caller's trigger).
 * - `data-page="<name>"` -- current nested page; non-empty + an empty search box => Backspace goes
 *   back to root via `data-back-to-root-action`.
 * - `data-execute-action` / `data-open-page-action` / `data-back-to-root-action` -- the non-close
 *   wire actions Enter / Backspace dispatch (routed through the {@link callWire} seam, not here).
 *
 * What it owns (folding three enhancers into one controller + the shared base):
 *  1. **Client-side filtering**: `input` on the search box hides non-matching `[data-lievit-item]`,
 *     hides group containers whose items are all hidden, and toggles the `[data-slot="empty"]` live
 *     region (declared via `data-action="input->lv-command#filter"`).
 *  2. **Enter dispatch**: keydown Enter on the input reads `aria-activedescendant` (kept in sync by
 *     the still-shared collection-nav enhancer) to find the active option, then `data-page-id` ->
 *     openPageAction, `data-href` -> client navigation, else executeAction.
 *  3. **Backspace in a nested page**: empty input + non-empty `data-page` => backToRootAction.
 *  4. **Global shortcut close**: a DOCUMENT-level keydown bound in {@link connect} (an element
 *     `data-action` cannot express a document-scoped chord) fires the close via the doctrine.
 *  5. **Focus trap**: the shared {@link FocusTrap} (Tab cycling + scroll-lock + initial focus +
 *     return-focus + Escape -> close) -- the duplicated trap/dismiss logic now lives ONCE in
 *     `base/focus-trap.ts` + `DismissableController`, never re-rolled here.
 *
 * NOT owned (stays with the shared `collection-nav.enhancer.ts`, untouched): ArrowUp/Down/Home/End
 * navigation over the listbox, which keeps `aria-activedescendant` on the input current. The
 * listbox keeps its `data-lievit-collection*` attributes; this controller only reads the result.
 *
 * Morph-safety: the trap + the document shortcut listener are bound in `connect()` and Stimulus
 * removes the whole controller (and so both) on `disconnect()` when a wire morph drops the panel.
 * The `input`/`keydown` element wiring is `data-action` so Stimulus re-binds it across morphs. No
 * `data-lievit-rt-command-active` marker, no `afterCall` prune -- Stimulus owns the lifecycle.
 *
 * a11y source: WAI-ARIA APG Combobox + Listbox (aria-activedescendant model) + Dialog Modal trap.
 */

import { DismissableController } from "../base/dismissable-controller.js";
import { FocusTrap } from "../base/focus-trap.js";
import { callWire } from "../bridge.js";

/**
 * Decide, for each command label, whether it matches a query. Case- and accent-insensitive
 * substring match anywhere in the label, preserving order. An empty/blank query matches every
 * item. DOM-free; unit-testable without a browser. Exported so a pure unit test can pin it without
 * mounting the controller.
 *
 * @returns a boolean array index-aligned with `labels`: true == item is shown.
 */
export function commandFilter(labels: string[], query: string): boolean[] {
  const q = normalize(query);
  if (q === "") {
    return labels.map(() => true);
  }
  return labels.map((label) => normalize(label).includes(q));
}

/** Lowercase + strip diacritics so "citta" matches "città" and case never blocks a match. */
function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

/**
 * Parse a shortcut string like "mod+k" into a predicate over a KeyboardEvent. "mod" means Cmd on
 * Mac, Ctrl elsewhere. Returns `null` for a blank shortcut (no global chord).
 */
function shortcutMatcher(shortcut: string): ((e: KeyboardEvent) => boolean) | null {
  if (shortcut === "") {
    return null;
  }
  const parts = shortcut.toLowerCase().split("+");
  const key = parts[parts.length - 1];
  const needsMod = parts.includes("mod");
  const needsCtrl = parts.includes("ctrl");
  const needsAlt = parts.includes("alt");
  const needsShift = parts.includes("shift");
  const isMac = typeof navigator !== "undefined" && /mac/i.test(navigator.platform);
  return (e: KeyboardEvent): boolean => {
    if (e.key.toLowerCase() !== key) {
      return false;
    }
    if (needsMod && !(isMac ? e.metaKey : e.ctrlKey)) {
      return false;
    }
    if (needsCtrl && !e.ctrlKey) {
      return false;
    }
    if (needsAlt && !e.altKey) {
      return false;
    }
    if (needsShift && !e.shiftKey) {
      return false;
    }
    return true;
  };
}

export default class LvCommandController extends DismissableController<HTMLElement> {
  static targets = ["input"];

  declare readonly hasInputTarget: boolean;
  declare readonly inputTarget: HTMLInputElement;

  private trap: FocusTrap | null = null;
  private readonly shortcutHandler = (e: KeyboardEvent): void => this.onShortcut(e);

  connect(): void {
    // Modal surface: trap Tab + scroll-lock + initial focus, and route Escape through the doctrine.
    this.trap = new FocusTrap(this.element, { onEscape: () => this.dismissViaWire() });
    this.trap.activate();

    // Global shortcut chord (e.g. Cmd/Ctrl+K) closes while the panel is in the DOM. A document
    // listener (not a data-action) because the chord is document-scoped; removed in disconnect().
    document.addEventListener("keydown", this.shortcutHandler);

    // Seed: everything visible, empty live region hidden (no query typed yet).
    this.applyFilter("");
  }

  disconnect(): void {
    document.removeEventListener("keydown", this.shortcutHandler);
    this.trap?.deactivate();
    this.trap = null;
  }

  /** `data-action="input->lv-command#filter"`: re-run the client-side filter on every keystroke. */
  filter(): void {
    if (this.hasInputTarget) {
      this.applyFilter(this.inputTarget.value);
    }
  }

  /**
   * `data-action="keydown->lv-command#onInputKey"`: Enter dispatches the active option;
   * Backspace on an empty box in a nested page goes back to root. Arrow keys are owned by
   * collection-nav (it updates `aria-activedescendant`), so they are not handled here.
   */
  onInputKey(event: KeyboardEvent): void {
    if (event.key === "Enter") {
      this.dispatchActive(event);
      return;
    }
    if (event.key === "Backspace") {
      this.backIfNestedRoot(event);
    }
  }

  // --- internals -----------------------------------------------------------------------------

  /** The global-shortcut document handler: matched chord => close via the doctrine. */
  private onShortcut(e: KeyboardEvent): void {
    const matches = shortcutMatcher(this.element.dataset["shortcut"] ?? "");
    if (matches != null && matches(e)) {
      e.preventDefault();
      this.dismissViaWire(this.element, { trigger: this.element });
    }
  }

  /** Enter on the input: resolve the active option and route it to its wire action / navigation. */
  private dispatchActive(event: KeyboardEvent): void {
    if (!this.hasInputTarget) {
      return;
    }
    const activeId = this.inputTarget.getAttribute("aria-activedescendant");
    if (activeId == null || activeId === "") {
      return;
    }
    const option = this.element.querySelector<HTMLElement>(`#${CSS.escape(activeId)}`);
    if (option == null || option.getAttribute("aria-disabled") === "true") {
      return;
    }

    event.preventDefault();
    const pageId = option.dataset["pageId"];
    const href = option.dataset["href"];
    const cmdId = option.dataset["id"] ?? "";
    const openPageAction = this.element.dataset["openPageAction"] ?? "openPage";
    const executeAction = this.element.dataset["executeAction"] ?? "executeCommand";

    if (pageId != null && pageId !== "") {
      callWire(option, openPageAction, { trigger: option, commandId: pageId });
    } else if (href != null && href !== "") {
      window.location.href = href;
    } else {
      callWire(option, executeAction, { trigger: option, commandId: cmdId });
    }
  }

  /** Backspace on an empty search box inside a nested page returns to the root palette. */
  private backIfNestedRoot(event: KeyboardEvent): void {
    if (!this.hasInputTarget) {
      return;
    }
    const page = this.element.dataset["page"] ?? "";
    if (page !== "" && this.inputTarget.value === "") {
      event.preventDefault();
      const backAction = this.element.dataset["backToRootAction"] ?? "backToRoot";
      callWire(this.element, backAction, { trigger: this.element });
    }
  }

  /**
   * Apply client-side filtering: hide non-matching items, hide group containers whose items are all
   * hidden, and toggle the empty live region. The label text is the non-`aria-hidden` span inside
   * each option's `[data-slot="option-inner"]` (the server-rendered structure).
   */
  private applyFilter(query: string): void {
    const items = Array.from(this.element.querySelectorAll<HTMLElement>("[data-lievit-item]"));
    const labels = items.map((el) => {
      const labelEl = el.querySelector<HTMLElement>(
        "[data-slot='option-inner'] span:not([aria-hidden])",
      );
      return labelEl?.textContent?.trim() ?? "";
    });
    const shown = commandFilter(labels, query);
    items.forEach((el, i) => {
      el.hidden = !shown[i];
    });

    for (const group of Array.from(
      this.element.querySelectorAll<HTMLElement>("[data-slot='group']"),
    )) {
      const groupItems = Array.from(
        group.querySelectorAll<HTMLElement>("[data-lievit-item]"),
      );
      group.hidden = !groupItems.some((el) => !el.hidden);
    }

    const emptyEl = this.element.querySelector<HTMLElement>("[data-slot='empty']");
    if (emptyEl != null) {
      emptyEl.hidden = items.some((el) => !el.hidden);
    }
  }
}
