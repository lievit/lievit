/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * WAI-ARIA APG Tooltip enhancer (#34 v-next shared enhancers). A wrapper span carrying
 * `data-lievit-tooltip-wrapper` + a sibling `[popover="manual"]` bubble get the full
 * hover/focus show/hide lifecycle wired by this enhancer.
 *
 * The server renders BOTH elements (wrapper + bubble) in the DOM; the bubble is hidden by
 * `popover="manual"` (UA removes it from the a11y tree and layout when not open). The enhancer
 * owns the three irreducible client concerns:
 *
 * 1. **Show/hide timing** — `pointerenter` starts a `delay`-ms timer before showing; `focusin`
 *    shows immediately. `pointerleave` and `focusout` hide after `hideDelay` ms (default 0).
 * 2. **`aria-describedby` wiring** — set on the first focusable descendant of the wrapper (or
 *    the wrapper itself) at mount, pointing at the bubble's `id`. Removed on destroy.
 * 3. **Esc dismiss** — a `document` capture-phase `keydown` listener registered only while the
 *    bubble is open; removed on hide. Focus stays on the trigger (non-modal).
 *
 * Hover persistence (APG rule): `pointerenter` on the bubble cancels the pending hide timer so
 * moving the pointer from the trigger into the bubble keeps the tooltip visible.
 *
 * Attribute protocol on the WRAPPER element (emitted by `tooltip.jte`):
 * - `data-lievit-tooltip-wrapper`    — discovery hook (no value)
 * - `data-lievit-tooltip-id`         — the bubble's `id`
 * - `data-lievit-tooltip-delay`      — show delay in ms (default 600)
 * - `data-lievit-tooltip-hide-delay` — hide delay in ms (default 0)
 * - `data-lievit-tooltip-placement`  — informational (CSS Anchor Positioning does the work)
 * - `data-lievit-tooltip-disabled`   — when present, the enhancer is a no-op
 *
 * Attribute protocol on the BUBBLE element:
 * - `popover="manual"` — UA hides the bubble by default; the enhancer calls `showPopover()` /
 *   `hidePopover()` explicitly
 * - `role="tooltip"` — static, server-rendered
 * - `id` — matches `data-lievit-tooltip-id` on the wrapper
 *
 * Idempotency: a WeakSet tracks wrappers that already have listeners wired. Re-scanning after a
 * morph is safe.
 *
 * CSP-clean: no `eval`, no inline handlers, no dynamic `<script>`.
 *
 * APG source: https://www.w3.org/WAI/ARIA/apg/patterns/tooltip/
 */

import type { LievitRuntime } from "../runtime.js";

const WRAPPER_ATTR = "data-lievit-tooltip-wrapper";
const ID_ATTR = "data-lievit-tooltip-id";
const DELAY_ATTR = "data-lievit-tooltip-delay";
const HIDE_DELAY_ATTR = "data-lievit-tooltip-hide-delay";
const DISABLED_ATTR = "data-lievit-tooltip-disabled";

/** Default show delay (ms) when the attribute is absent or not a finite number. */
const DEFAULT_DELAY_MS = 600;

/** Wrappers that already have event listeners attached (idempotency guard). */
const wiredWrappers = new WeakSet<Element>();

/**
 * The focusable elements the enhancer considers for `aria-describedby` placement.
 * Visibility checks are omitted intentionally: happy-dom has no layout engine, so
 * `offsetWidth`-based visibility always returns 0. The selector is tight enough that
 * invisible-but-focusable elements are unusual in practice.
 */
const FOCUSABLE_SELECTOR = [
  "a[href]",
  "area[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "button:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
  "[contenteditable]",
].join(", ");

/** Return the first focusable descendant of a container, or null. */
function firstFocusable(container: Element): Element | null {
  return container.querySelector<Element>(FOCUSABLE_SELECTOR);
}

/** Parse an integer data-attribute, returning `fallback` on absence or NaN. */
function intAttr(el: Element, name: string, fallback: number): number {
  const raw = el.getAttribute(name);
  if (raw == null) return fallback;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : fallback;
}

interface TooltipState {
  /** The bubble element (`[popover="manual"]`). */
  bubble: HTMLElement;
  /** The element that received `aria-describedby` (first focusable or the wrapper itself). */
  ariaTarget: Element;
  /** The document-level Escape keydown handler — registered only while the bubble is open. */
  escapeHandler: EventListener | null;
  /** Pending show timer id. */
  showTimer: ReturnType<typeof setTimeout> | null;
  /** Pending hide timer id. */
  hideTimer: ReturnType<typeof setTimeout> | null;
  /** Whether the tooltip is currently open. */
  open: boolean;
}

/** Active tooltip states keyed by wrapper. Map so we can iterate on afterCall. */
const activeTooltips = new Map<Element, TooltipState>();

// ---------------------------------------------------------------------------
// Per-instance show / hide logic
// ---------------------------------------------------------------------------

function cancelShow(state: TooltipState): void {
  if (state.showTimer != null) {
    clearTimeout(state.showTimer);
    state.showTimer = null;
  }
}

function cancelHide(state: TooltipState): void {
  if (state.hideTimer != null) {
    clearTimeout(state.hideTimer);
    state.hideTimer = null;
  }
}

function showBubble(state: TooltipState): void {
  cancelHide(state);
  if (state.open) return;
  state.open = true;

  // Register the Escape handler on document (capture) only while visible.
  const escHandler: EventListener = (ev: Event): void => {
    if ((ev as KeyboardEvent).key === "Escape") {
      ev.stopPropagation();
      hideBubble(state);
    }
  };
  state.escapeHandler = escHandler;
  document.addEventListener("keydown", escHandler, true);

  state.bubble.showPopover();
}

function hideBubble(state: TooltipState): void {
  cancelShow(state);
  if (!state.open) return;
  state.open = false;

  if (state.escapeHandler != null) {
    document.removeEventListener("keydown", state.escapeHandler, true);
    state.escapeHandler = null;
  }

  state.bubble.hidePopover();
}

// ---------------------------------------------------------------------------
// Wire one tooltip wrapper
// ---------------------------------------------------------------------------

function wireWrapper(wrapper: Element): void {
  if (wiredWrappers.has(wrapper)) return;
  wiredWrappers.add(wrapper);

  // Disabled: no listeners wired, bubble stays hidden.
  if (wrapper.hasAttribute(DISABLED_ATTR)) return;

  const id = wrapper.getAttribute(ID_ATTR);
  if (id == null || id.length === 0) return;

  const bubble = document.getElementById(id) as HTMLElement | null;
  if (bubble == null) return;

  const delay = intAttr(wrapper, DELAY_ATTR, DEFAULT_DELAY_MS);
  const hideDelay = intAttr(wrapper, HIDE_DELAY_ATTR, 0);

  // Set aria-describedby on the first focusable descendant (or the wrapper itself if none).
  const ariaTarget: Element = firstFocusable(wrapper) ?? wrapper;
  ariaTarget.setAttribute("aria-describedby", id);

  const state: TooltipState = {
    bubble,
    ariaTarget,
    escapeHandler: null,
    showTimer: null,
    hideTimer: null,
    open: false,
  };
  activeTooltips.set(wrapper, state);

  // ------------------------------------------------------------------
  // Pointer events on the WRAPPER
  // ------------------------------------------------------------------
  wrapper.addEventListener("pointerenter", () => {
    cancelHide(state);
    if (!state.open) {
      state.showTimer = setTimeout(() => {
        state.showTimer = null;
        showBubble(state);
      }, delay);
    }
  });

  wrapper.addEventListener("pointerleave", () => {
    cancelShow(state);
    if (state.open) {
      state.hideTimer = setTimeout(() => {
        state.hideTimer = null;
        hideBubble(state);
      }, hideDelay);
    }
  });

  // ------------------------------------------------------------------
  // Keyboard events on the WRAPPER (focus always immediate)
  // ------------------------------------------------------------------
  wrapper.addEventListener("focusin", () => {
    cancelShow(state); // cancel any pending delayed show
    showBubble(state); // immediate
  });

  wrapper.addEventListener("focusout", () => {
    // Hide immediately on focus leaving — no hide-delay for keyboard (APG).
    cancelShow(state);
    hideBubble(state);
  });

  // ------------------------------------------------------------------
  // Hover persistence: pointer entering the bubble cancels the hide timer
  // ------------------------------------------------------------------
  bubble.addEventListener("pointerenter", () => {
    cancelHide(state);
  });

  bubble.addEventListener("pointerleave", () => {
    if (state.open) {
      state.hideTimer = setTimeout(() => {
        state.hideTimer = null;
        hideBubble(state);
      }, hideDelay);
    }
  });
}

/** Tear down state for a wrapper that was removed from the DOM. */
function destroyWrapper(wrapper: Element): void {
  const state = activeTooltips.get(wrapper);
  if (state == null) return;

  cancelShow(state);
  cancelHide(state);

  if (state.escapeHandler != null) {
    document.removeEventListener("keydown", state.escapeHandler, true);
    state.escapeHandler = null;
  }

  // Remove aria-describedby (the spec / agent instructions require cleanup on destroy).
  state.ariaTarget.removeAttribute("aria-describedby");

  // Best-effort: hide the bubble if still open and still in the DOM.
  if (state.open && document.body.contains(state.bubble)) {
    try {
      state.bubble.hidePopover();
    } catch {
      // Ignore: the bubble may have been removed already.
    }
  }
  state.open = false;

  activeTooltips.delete(wrapper);
}

// ---------------------------------------------------------------------------
// Scan a component root for tooltip wrappers
// ---------------------------------------------------------------------------

function scanRoot(root: Element): void {
  // The root itself may carry the wrapper attribute (unusual but legal).
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
 * Installs the tooltip enhancer on a runtime. Scans every component root for
 * `[data-lievit-tooltip-wrapper]` elements on init and after every wire call.
 *
 * @param runtime the started runtime to extend
 * @returns an unsubscribe function
 */
export function installTooltip(runtime: LievitRuntime): () => void {
  return runtime.use({
    onComponentInit(ctx) {
      scanRoot(ctx.root);
    },
    afterCall(outcome) {
      // Re-scan after morph (new tooltip wrappers may have appeared).
      scanRoot(outcome.root);
      // Destroy state for wrappers removed from the DOM.
      for (const [wrapper] of activeTooltips) {
        if (!document.body.contains(wrapper)) {
          destroyWrapper(wrapper);
        }
      }
    },
  });
}
