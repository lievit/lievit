/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * WAI-ARIA APG Dialog Modal focus trap (#34 v-next shared enhancers). A container that carries
 * `data-lievit-focus-trap` traps Tab/Shift+Tab focus cycling within itself. When Escape is pressed,
 * the action named in `data-lievit-escape-action` is called on the component owning the container.
 * Focus is restored to the element that held it when the trap was activated, on deactivation.
 *
 * Attribute protocol:
 * - `data-lievit-focus-trap` — activates the trap on the element (no value needed)
 * - `data-lievit-escape-action` — wire action to call on Escape (e.g. `"close"`)
 * - `data-initial-focus` — (ADDITIVE) marks the element inside the trap that should receive initial
 *   focus. Priority: `[data-initial-focus]` > `[autofocus]` > first focusable > container itself.
 *   alert-dialog.jte places this on the cancel button (least-destructive default per APG).
 *
 * Idempotency: `data-lievit-rt-focus-trap-active` is stamped on the container while the trap is
 * live; a second activation on the same element is a no-op.
 *
 * Scroll lock: while the trap is active, `document.body` gets `overflow: hidden` (restored verbatim
 * on deactivate) and `data-lievit-trap-scroll-lock` is set for CSS hooks.
 *
 * Detection: the enhancer registers an `onComponentInit` lifecycle hook that scans for
 * `[data-lievit-focus-trap]` elements inside every component root after morph.
 *
 * APG source: https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/
 */

import type { LievitRuntime } from "../runtime.js";

const TRAP_ATTR = "data-lievit-focus-trap";
const ESCAPE_ACTION_ATTR = "data-lievit-escape-action";
const ACTIVE_ATTR = "data-lievit-rt-focus-trap-active";
/** Additive: highest-priority initial-focus target (alert-dialog cancel button etc.). */
const INITIAL_FOCUS_ATTR = "data-initial-focus";

/**
 * Elements that can receive keyboard focus (DOM spec + ARIA supplement).
 * Visibility check (offsetWidth / getClientRects) is omitted: happy-dom / JSDOM have no layout
 * engine, so layout-based visibility would always return false in tests. In a real browser the
 * selector is tight enough that invisible-but-focusable elements are unusual.
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

function getFocusable(container: Element): Element[] {
  return Array.from(container.querySelectorAll<Element>(FOCUSABLE_SELECTOR));
}

interface TrapState {
  readonly container: Element;
  readonly returnTarget: Element | null;
  readonly keyHandler: EventListener;
  readonly savedBodyOverflow: string;
}

/** Currently active traps, one per container element. Map (not WeakMap) so we can iterate on afterCall. */
const activeTraps = new Map<Element, TrapState>();

function activateTrap(container: Element, runtime: LievitRuntime): void {
  if (activeTraps.has(container)) {
    return; // idempotent
  }
  // Migration guard (Stimulus conversion): an alert-dialog converted to the `lv-alert-dialog`
  // Stimulus controller owns its own focus trap (via the shared FocusTrap util). This enhancer must
  // NOT also trap it, or the panel would be double-trapped (two keydown handlers => double Escape).
  // Converted templates still carry data-lievit-focus-trap for the family golden, so guard here.
  // Remove this guard when the last focus-trap consumer (dialog/drawer/sheet) is converted and the
  // enhancer is deleted (dedicated cleanup PR).
  if (container.matches('[data-controller~="lv-alert-dialog"]')) {
    return;
  }
  container.setAttribute(ACTIVE_ATTR, "");

  const returnTarget = document.activeElement instanceof Element ? document.activeElement : null;

  // Initial focus priority (additive, guards ensure no change when data-initial-focus is absent):
  //   [data-initial-focus] > [autofocus] > first focusable > container itself
  const initialFocusTarget = container.querySelector<HTMLElement>(`[${INITIAL_FOCUS_ATTR}]`);
  if (initialFocusTarget != null) {
    initialFocusTarget.focus();
  } else {
    const autofocused = container.querySelector<HTMLElement>("[autofocus]");
    if (autofocused != null) {
      autofocused.focus();
    } else {
      const first = getFocusable(container)[0] as HTMLElement | undefined;
      if (first != null) {
        first.focus();
      } else {
        if (!container.hasAttribute("tabindex")) {
          (container as HTMLElement).setAttribute("tabindex", "-1");
        }
        (container as HTMLElement).focus();
      }
    }
  }

  // Scroll lock
  const savedBodyOverflow = (document.body as HTMLElement).style.overflow;
  (document.body as HTMLElement).style.overflow = "hidden";
  document.body.setAttribute("data-lievit-trap-scroll-lock", "");

  const escapeAction = container.getAttribute(ESCAPE_ACTION_ATTR);

  const keyHandler: EventListener = (rawEvent: Event): void => {
    if (!activeTraps.has(container)) {
      return;
    }
    const e = rawEvent as KeyboardEvent;
    if (e.key === "Escape") {
      if (escapeAction != null && escapeAction.length > 0) {
        e.preventDefault();
        void runtime.callAction(container, escapeAction, { trigger: container });
      }
      return;
    }
    if (e.key !== "Tab") {
      return;
    }
    const focusable = getFocusable(container);
    if (focusable.length === 0) {
      e.preventDefault();
      return;
    }
    const first = focusable[0] as HTMLElement;
    const last = focusable[focusable.length - 1] as HTMLElement;
    if (e.shiftKey) {
      if (document.activeElement === first || !container.contains(document.activeElement)) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last || !container.contains(document.activeElement)) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  document.addEventListener("keydown", keyHandler);

  activeTraps.set(container, { container, returnTarget, keyHandler, savedBodyOverflow });
}

function deactivateTrap(container: Element): void {
  const state = activeTraps.get(container);
  if (state == null) {
    return;
  }
  activeTraps.delete(container);
  container.removeAttribute(ACTIVE_ATTR);
  document.removeEventListener("keydown", state.keyHandler);

  // Restore scroll lock
  (document.body as HTMLElement).style.overflow = state.savedBodyOverflow;
  document.body.removeAttribute("data-lievit-trap-scroll-lock");

  // Restore focus
  if (
    state.returnTarget != null &&
    typeof (state.returnTarget as HTMLElement).focus === "function"
  ) {
    (state.returnTarget as HTMLElement).focus();
  }
}

/**
 * Installs the focus-trap enhancer on a runtime. Registers an `onComponentInit` lifecycle hook
 * that scans every component root for `[data-lievit-focus-trap]` elements, plus an `afterCall`
 * hook that deactivates stale traps after every morph.
 *
 * @param runtime the started runtime to extend
 * @returns an unsubscribe function
 */
export function installFocusTrap(runtime: LievitRuntime): () => void {
  return runtime.use({
    onComponentInit(ctx) {
      // The root itself may carry the trap attribute.
      if (ctx.root.hasAttribute(TRAP_ATTR)) {
        activateTrap(ctx.root, runtime);
      }
      // Scan descendants.
      for (const el of Array.from(ctx.root.querySelectorAll<Element>(`[${TRAP_ATTR}]`))) {
        activateTrap(el, runtime);
      }
    },
    afterCall() {
      // Deactivate any trap whose container was removed from the DOM by the morph.
      for (const [container] of activeTraps) {
        if (!document.body.contains(container)) {
          deactivateTrap(container);
        }
      }
    },
  });
}
