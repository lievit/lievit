/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * WAI-ARIA APG Tooltip enhancer for the hover-card component (v-next, issue #34). A trigger
 * wrapper carrying `data-lv-hover-card-trigger` + a sibling `[popover="manual"][role="tooltip"]`
 * panel get the full hover/focus show/hide lifecycle wired by this enhancer.
 *
 * The server renders BOTH elements in the DOM (trigger wrapper via `hover-card-trigger.jte` +
 * panel via `hover-card.jte`); the panel is hidden by `popover="manual"`. The enhancer owns
 * the three irreducible client concerns:
 *
 * 1. **Show/hide timing with grace delay** — `pointerenter` on the trigger wrapper starts a
 *    `delay`-ms timer then calls `showPopover()`; `pointerleave` starts a `closeDelay`-ms
 *    timer then calls `hidePopover()`. `pointerenter` on the PANEL cancels the close timer
 *    (hover-grace: cursor travelling from trigger to card keeps the card open). `pointerleave`
 *    on the panel restarts the close timer.
 * 2. **Focus-open path (keyboard-accessible)** — `focusin` on the trigger wrapper shows the
 *    panel immediately (no delay; immediacy is the APG keyboard convention). `focusout` starts
 *    the `closeDelay` timer. If focus returns to the wrapper before the timer fires, it is
 *    cancelled. This is the path for keyboard and screen-reader users.
 * 3. **Esc dismiss** — a `document` capture-phase `keydown` listener registered only while
 *    the panel is open; calls `hidePopover()` and `stopPropagation()` so Esc does not bubble
 *    to a surrounding dialog or drawer. Focus stays on the trigger (non-modal).
 *
 * The `aria-describedby` relationship is emitted unconditionally by the server-rendered template
 * (hover-card-trigger.jte) and is NOT set/removed by this enhancer. This is the correct server-
 * first design: SR users who navigate by keyboard receive the description via the static markup
 * without depending on JavaScript. The `data-open` attribute is stamped/removed on the panel as
 * an observable open-state proxy for CSS and tests (the `:popover-open` pseudo-class cannot be
 * queried via `matches()` in jsdom/happy-dom).
 *
 * Attribute protocol on the TRIGGER WRAPPER element (emitted by `hover-card-trigger.jte`):
 * - `data-lv-hover-card-trigger`  — discovery hook (no value)
 * - `data-card-id`                — id of the matching panel element
 * - `data-delay`                  — show delay in ms (default 300)
 * - `data-close-delay`            — hide delay in ms (default 150)
 * - `data-open-on-focus`          — "true" | "false" string (string check survives morph)
 *
 * Attribute protocol on the PANEL element (emitted by `hover-card.jte`):
 * - `popover="manual"`            — UA hides by default; enhancer calls showPopover/hidePopover
 * - `role="tooltip"`              — static, server-rendered
 * - `id`                          — matches `data-card-id` on the trigger wrapper
 * - `data-open`                   — present when panel is open (set/removed by this enhancer)
 *
 * Idempotency: a WeakSet tracks wrappers that already have listeners wired; re-scanning after
 * a morph is safe.
 *
 * CSP-clean: no `eval`, no inline handlers, no dynamic `<script>`.
 *
 * APG source: https://www.w3.org/WAI/ARIA/apg/patterns/tooltip/
 */

import type { LievitRuntime } from "../runtime.js";

const WRAPPER_ATTR = "data-lv-hover-card-trigger";
const CARD_ID_ATTR = "data-card-id";
const DELAY_ATTR = "data-delay";
const CLOSE_DELAY_ATTR = "data-close-delay";
const OPEN_ON_FOCUS_ATTR = "data-open-on-focus";
const DATA_OPEN_ATTR = "data-open";

/** Default show delay (ms) when the attribute is absent or not a finite number. */
const DEFAULT_DELAY_MS = 300;

/** Default close/grace delay (ms) when the attribute is absent or not a finite number. */
const DEFAULT_CLOSE_DELAY_MS = 150;

/** Wrappers that already have event listeners attached (idempotency guard). */
const wiredWrappers = new WeakSet<Element>();

/** Parse an integer data-attribute, returning `fallback` on absence or NaN. */
function intAttr(el: Element, name: string, fallback: number): number {
  const raw = el.getAttribute(name);
  if (raw == null) return fallback;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : fallback;
}

interface HoverCardState {
  /** The panel element (`[popover="manual"]`). */
  panel: HTMLElement;
  /** Document-level Escape keydown handler; registered only while panel is open. */
  escapeHandler: EventListener | null;
  /** Pending show timer id. */
  showTimer: ReturnType<typeof setTimeout> | null;
  /** Pending close timer id. */
  closeTimer: ReturnType<typeof setTimeout> | null;
  /** Whether the card is currently open. */
  open: boolean;
}

/** Active hover-card states keyed by wrapper. */
const activeCards = new Map<Element, HoverCardState>();

// ---------------------------------------------------------------------------
// Per-instance show / hide logic
// ---------------------------------------------------------------------------

function cancelShow(state: HoverCardState): void {
  if (state.showTimer != null) {
    clearTimeout(state.showTimer);
    state.showTimer = null;
  }
}

function cancelClose(state: HoverCardState): void {
  if (state.closeTimer != null) {
    clearTimeout(state.closeTimer);
    state.closeTimer = null;
  }
}

function showPanel(state: HoverCardState): void {
  cancelClose(state);
  if (state.open) return;
  state.open = true;

  // Esc handler: registered on document (capture) while panel is open only.
  const escHandler: EventListener = (ev: Event): void => {
    if ((ev as KeyboardEvent).key === "Escape") {
      ev.stopPropagation();
      hidePanel(state);
    }
  };
  state.escapeHandler = escHandler;
  document.addEventListener("keydown", escHandler, true);

  state.panel.showPopover();
  state.panel.setAttribute(DATA_OPEN_ATTR, "");
}

function hidePanel(state: HoverCardState): void {
  cancelShow(state);
  if (!state.open) return;
  state.open = false;

  if (state.escapeHandler != null) {
    document.removeEventListener("keydown", state.escapeHandler, true);
    state.escapeHandler = null;
  }

  state.panel.hidePopover();
  state.panel.removeAttribute(DATA_OPEN_ATTR);
}

// ---------------------------------------------------------------------------
// Wire one trigger wrapper
// ---------------------------------------------------------------------------

function wireWrapper(wrapper: Element): void {
  if (wiredWrappers.has(wrapper)) return;
  // Migration guard (Stimulus conversion): a wrapper converted to the `lv-hover-card` Stimulus
  // controller owns its own hover/focus/Esc handling. This enhancer must NOT also wire it, or the
  // card would get two show/hide timer sets. Converted templates carry data-controller="lv-hover-card".
  if (wrapper.matches('[data-controller~="lv-hover-card"]')) {
    wiredWrappers.add(wrapper);
    return;
  }
  wiredWrappers.add(wrapper);

  const cardId = wrapper.getAttribute(CARD_ID_ATTR);
  if (cardId == null || cardId.length === 0) return;

  const panel = document.getElementById(cardId) as HTMLElement | null;
  if (panel == null) return;

  const delay = intAttr(wrapper, DELAY_ATTR, DEFAULT_DELAY_MS);
  const closeDelay = intAttr(wrapper, CLOSE_DELAY_ATTR, DEFAULT_CLOSE_DELAY_MS);
  const openOnFocus = wrapper.getAttribute(OPEN_ON_FOCUS_ATTR) !== "false";

  const state: HoverCardState = {
    panel,
    escapeHandler: null,
    showTimer: null,
    closeTimer: null,
    open: false,
  };
  activeCards.set(wrapper, state);

  // ------------------------------------------------------------------
  // Pointer events on the TRIGGER WRAPPER
  // ------------------------------------------------------------------
  wrapper.addEventListener("pointerenter", () => {
    cancelClose(state);
    if (!state.open) {
      state.showTimer = setTimeout(() => {
        state.showTimer = null;
        showPanel(state);
      }, delay);
    }
  });

  wrapper.addEventListener("pointerleave", () => {
    cancelShow(state);
    if (state.open) {
      state.closeTimer = setTimeout(() => {
        state.closeTimer = null;
        hidePanel(state);
      }, closeDelay);
    }
  });

  // ------------------------------------------------------------------
  // Keyboard events on the TRIGGER WRAPPER (focus-open path)
  // ------------------------------------------------------------------
  if (openOnFocus) {
    wrapper.addEventListener("focusin", () => {
      cancelClose(state);
      showPanel(state); // immediate on focus (APG keyboard convention)
    });

    wrapper.addEventListener("focusout", () => {
      cancelShow(state);
      state.closeTimer = setTimeout(() => {
        state.closeTimer = null;
        hidePanel(state);
      }, closeDelay);
    });
  }

  // ------------------------------------------------------------------
  // Grace period: pointer entering the PANEL cancels the close timer
  // (hover-grace: cursor travelling from trigger to card)
  // ------------------------------------------------------------------
  panel.addEventListener("pointerenter", () => {
    cancelClose(state);
  });

  panel.addEventListener("pointerleave", () => {
    if (state.open) {
      state.closeTimer = setTimeout(() => {
        state.closeTimer = null;
        hidePanel(state);
      }, closeDelay);
    }
  });
}

/** Tear down state for a wrapper that was removed from the DOM. */
function destroyWrapper(wrapper: Element): void {
  const state = activeCards.get(wrapper);
  if (state == null) return;

  cancelShow(state);
  cancelClose(state);

  if (state.escapeHandler != null) {
    document.removeEventListener("keydown", state.escapeHandler, true);
    state.escapeHandler = null;
  }

  // Best-effort: hide the panel if still open and still in the DOM.
  if (state.open && document.body.contains(state.panel)) {
    try {
      state.panel.hidePopover();
    } catch {
      // Panel may have been removed already.
    }
    state.panel.removeAttribute(DATA_OPEN_ATTR);
  }
  state.open = false;

  activeCards.delete(wrapper);
}

// ---------------------------------------------------------------------------
// Scan a root element for trigger wrappers
// ---------------------------------------------------------------------------

function scanRoot(root: Element): void {
  if (root.hasAttribute(WRAPPER_ATTR)) {
    wireWrapper(root);
  }
  for (const el of Array.from(root.querySelectorAll<Element>(`[${WRAPPER_ATTR}]`))) {
    wireWrapper(el);
  }
}

// ---------------------------------------------------------------------------
// Public installer
// ---------------------------------------------------------------------------

/**
 * Installs the hover-card enhancer on a runtime. Scans every component root for
 * `[data-lv-hover-card-trigger]` elements on init and after every wire call.
 *
 * Register in index.ts and call from installAllFeatures to include in the bundle.
 *
 * @param runtime the started runtime to extend
 * @returns an unsubscribe function
 */
export function installHoverCard(runtime: LievitRuntime): () => void {
  return runtime.use({
    onComponentInit(ctx) {
      scanRoot(ctx.root);
    },
    afterCall(outcome) {
      // Re-scan after morph (new trigger wrappers may have appeared).
      scanRoot(outcome.root);
      // Destroy state for wrappers removed from the DOM.
      for (const [wrapper] of activeCards) {
        if (!document.body.contains(wrapper)) {
          destroyWrapper(wrapper);
        }
      }
    },
  });
}
