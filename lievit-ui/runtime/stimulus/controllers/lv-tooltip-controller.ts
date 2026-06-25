/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * `lv-tooltip` -- the WAI-ARIA APG Tooltip behaviour as a Stimulus controller (the conversion of
 * `runtime/features/tooltip.enhancer.ts`). Mounted ON THE WRAPPER span via
 * `data-controller="lv-tooltip"`; the wrapper already carries the established lievit tooltip
 * contract the controller reads (kept as plain `data-lievit-tooltip-*` attributes, exactly as
 * `lv-popover` keeps `data-lv-opener` / `data-lv-wire-close` rather than renaming to Stimulus
 * values):
 *
 * - `data-lievit-tooltip-id`         -- the bubble's `id` (the `[role="tooltip"][popover="manual"]`).
 * - `data-lievit-tooltip-delay`      -- hover show delay in ms (default 600).
 * - `data-lievit-tooltip-hide-delay` -- hover hide delay in ms (default 0).
 * - `data-lievit-tooltip-disabled`   -- when present, the controller no-ops (no listeners, no aria).
 *
 * The three irreducible client concerns the server cannot pre-render, preserved verbatim from the
 * enhancer:
 *
 * 1. **Show/hide timing** -- `pointerenter` starts a `delay`-ms timer before showing; `focusin`
 *    shows immediately. `pointerleave` / bubble-`pointerleave` hide after `hideDelay` ms; `focusout`
 *    hides immediately (APG: no hide delay for keyboard). Hover persistence: `pointerenter` on the
 *    bubble cancels the pending hide so the pointer can traverse from trigger into the bubble.
 * 2. **`aria-describedby` wiring** -- set in {@link connect} on the first focusable descendant of the
 *    wrapper (or the wrapper itself), pointing at the bubble's `id`; removed in {@link disconnect}.
 * 3. **Esc dismiss** -- a `document` capture-phase `keydown` listener; while the bubble is open Esc
 *    hides it and stops propagation (so a parent dialog does not also close). Focus stays on the
 *    trigger (APG: the tooltip is NON-MODAL -- no focus trap, no focus return).
 *
 * Why plain {@link Controller} and NOT {@link DismissableController}: the tooltip never owns
 * server-side open state and NEVER round-trips the wire -- its dismiss is purely the client-side
 * `hidePopover()`. The controlled/uncontrolled doctrine is therefore satisfied trivially as
 * "always uncontrolled" (zero `/lievit/<id>/call`), and that is guaranteed by construction: this
 * file imports no wire seam. It also never traps or returns focus, so the base focus helpers do not
 * apply; there is nothing to collapse into the shared base here.
 *
 * Morph-safety: every listener is bound in {@link connect} and removed in {@link disconnect};
 * Stimulus connects the controller once per element+identifier and disconnects it when the wire
 * morph + idiomorph removes the wrapper -- so the enhancer's `WeakSet`-of-wired-wrappers + the
 * `afterCall` destroy sweep are gone (Stimulus owns the lifecycle).
 *
 * APG source: https://www.w3.org/WAI/ARIA/apg/patterns/tooltip/
 */

import { Controller } from "@hotwired/stimulus";

const ID_ATTR = "data-lievit-tooltip-id";
const DELAY_ATTR = "data-lievit-tooltip-delay";
const HIDE_DELAY_ATTR = "data-lievit-tooltip-hide-delay";
const DISABLED_ATTR = "data-lievit-tooltip-disabled";

/** Default show delay (ms) when the attribute is absent or not a finite number. */
const DEFAULT_DELAY_MS = 600;

/**
 * The focusable elements considered for `aria-describedby` placement. Visibility checks are omitted
 * intentionally: happy-dom has no layout engine, so `offsetWidth`-based visibility always returns 0.
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

/** Parse an integer data-attribute, returning `fallback` on absence or NaN. */
function intAttr(el: Element, name: string, fallback: number): number {
  const raw = el.getAttribute(name);
  if (raw == null) return fallback;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : fallback;
}

export default class LvTooltipController extends Controller<HTMLElement> {
  /** The bubble (`[role="tooltip"][popover="manual"]`), resolved by id in {@link connect}. */
  private bubble: HTMLElement | null = null;
  /** The element that received `aria-describedby` (first focusable descendant or the wrapper). */
  private ariaTarget: Element | null = null;

  private showTimer: ReturnType<typeof setTimeout> | null = null;
  private hideTimer: ReturnType<typeof setTimeout> | null = null;
  private open = false;

  private delay = DEFAULT_DELAY_MS;
  private hideDelay = 0;

  // Object-identity handlers so disconnect() removes exactly what connect() bound (no leaks).
  private readonly onWrapperPointerEnter = (): void => this.scheduleShow();
  private readonly onWrapperPointerLeave = (): void => this.scheduleHide();
  private readonly onWrapperFocusIn = (): void => this.showImmediately();
  private readonly onWrapperFocusOut = (): void => this.hideImmediately();
  private readonly onBubblePointerEnter = (): void => this.cancelHide();
  private readonly onBubblePointerLeave = (): void => this.scheduleHide();
  private readonly onDocumentKeydown = (e: KeyboardEvent): void => {
    if (this.open && e.key === "Escape") {
      e.stopPropagation();
      this.hideImmediately();
    }
  };

  connect(): void {
    // Disabled: no listeners wired, no aria, bubble stays hidden (enhancer parity).
    if (this.element.hasAttribute(DISABLED_ATTR)) return;

    const id = this.element.getAttribute(ID_ATTR);
    if (id == null || id.length === 0) return;

    const bubble = document.getElementById(id);
    if (bubble == null) return;
    this.bubble = bubble;

    this.delay = intAttr(this.element, DELAY_ATTR, DEFAULT_DELAY_MS);
    this.hideDelay = intAttr(this.element, HIDE_DELAY_ATTR, 0);

    // aria-describedby on the first focusable descendant, or the wrapper itself when none.
    const ariaTarget: Element =
      this.element.querySelector<Element>(FOCUSABLE_SELECTOR) ?? this.element;
    ariaTarget.setAttribute("aria-describedby", id);
    this.ariaTarget = ariaTarget;

    this.element.addEventListener("pointerenter", this.onWrapperPointerEnter);
    this.element.addEventListener("pointerleave", this.onWrapperPointerLeave);
    this.element.addEventListener("focusin", this.onWrapperFocusIn);
    this.element.addEventListener("focusout", this.onWrapperFocusOut);
    bubble.addEventListener("pointerenter", this.onBubblePointerEnter);
    bubble.addEventListener("pointerleave", this.onBubblePointerLeave);
    // Document-global key chord: bind here (a keydown@document data-action does not fire reliably
    // in the test substrate); guarded by `this.open` so it is inert while hidden.
    document.addEventListener("keydown", this.onDocumentKeydown, true);
  }

  disconnect(): void {
    this.element.removeEventListener("pointerenter", this.onWrapperPointerEnter);
    this.element.removeEventListener("pointerleave", this.onWrapperPointerLeave);
    this.element.removeEventListener("focusin", this.onWrapperFocusIn);
    this.element.removeEventListener("focusout", this.onWrapperFocusOut);
    this.bubble?.removeEventListener("pointerenter", this.onBubblePointerEnter);
    this.bubble?.removeEventListener("pointerleave", this.onBubblePointerLeave);
    document.removeEventListener("keydown", this.onDocumentKeydown, true);

    this.cancelShow();
    this.cancelHide();
    this.ariaTarget?.removeAttribute("aria-describedby");

    // Best-effort: hide a still-open bubble that is still in the DOM (enhancer destroy parity).
    if (this.open && this.bubble != null && document.body.contains(this.bubble)) {
      try {
        this.bubble.hidePopover();
      } catch {
        // The bubble may already have been removed by the same morph.
      }
    }
    this.open = false;
    this.bubble = null;
    this.ariaTarget = null;
  }

  // --- show / hide ---------------------------------------------------------------------------

  /** `pointerenter` on the wrapper: cancel a pending hide, then arm the delayed show. */
  private scheduleShow(): void {
    this.cancelHide();
    if (this.open || this.showTimer != null) return;
    this.showTimer = setTimeout(() => {
      this.showTimer = null;
      this.showNow();
    }, this.delay);
  }

  /** `pointerleave` (wrapper or bubble): cancel a pending show, then arm the delayed hide. */
  private scheduleHide(): void {
    this.cancelShow();
    if (!this.open || this.hideTimer != null) return;
    this.hideTimer = setTimeout(() => {
      this.hideTimer = null;
      this.hideNow();
    }, this.hideDelay);
  }

  /** `focusin`: show with no delay (APG keyboard rule). */
  private showImmediately(): void {
    this.cancelShow();
    this.showNow();
  }

  /** `focusout` / Escape: hide with no delay (APG keyboard rule). */
  private hideImmediately(): void {
    this.cancelHide();
    this.hideNow();
  }

  private showNow(): void {
    this.cancelHide();
    if (this.open || this.bubble == null) return;
    this.open = true;
    this.bubble.showPopover();
  }

  private hideNow(): void {
    this.cancelShow();
    if (!this.open || this.bubble == null) return;
    this.open = false;
    this.bubble.hidePopover();
  }

  private cancelShow(): void {
    if (this.showTimer != null) {
      clearTimeout(this.showTimer);
      this.showTimer = null;
    }
  }

  private cancelHide(): void {
    if (this.hideTimer != null) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
  }
}
