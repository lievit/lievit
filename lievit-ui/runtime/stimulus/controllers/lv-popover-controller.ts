/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * `lv-popover` -- the native-HTML-`popover` seam, as a Stimulus controller (the conversion of
 * `runtime/features/popover-anchor.enhancer.ts`). Mounted ON THE PANEL element via
 * `data-controller="lv-popover"`; the panel already carries the established lievit contract:
 *
 * - `popover` (native) + `data-lv-opener="<triggerId>"` -- the trigger this panel belongs to.
 * - `data-lv-wire-close="<action>"` -- PRESENT only on a wire-CONTROLLED overlay (server owns the
 *   open state). Its presence drives {@link DismissableController.isControlled}; on light-dismiss
 *   the base fires that action. ABSENT => uncontrolled => the close is purely client-side, ZERO
 *   round-trip (the controlled/uncontrolled doctrine, wire-410 fix). Read by the base, not here.
 * - inside the panel, `[data-lv-autofocus]` -- the element to focus after the panel opens.
 *
 * What the controller does on the native `toggle` event:
 * 1. **open**: record the opener; mirror `aria-expanded="true"` on it (only if it already declared
 *    the attribute -- never add it to a trigger that did not opt in); move focus to
 *    `[data-lv-autofocus]` if present.
 * 2. **closed**: return focus to the opener if the browser did not; mirror `aria-expanded="false"`;
 *    `dismissViaWire()` -- which fires the close action ONLY when controlled.
 *
 * Morph-safety: the toggle listener is bound in `connect()` and Stimulus removes the whole
 * controller (and so the listener) on `disconnect()` when a wire morph drops the panel. No
 * `WeakSet`-of-wired-panels, no `afterCall` teardown sweep -- Stimulus owns the lifecycle.
 *
 * a11y source: WAI-ARIA APG Disclosure + the native HTML popover light-dismiss/top-layer seam.
 */

import { DismissableController } from "../base/dismissable-controller.js";

const OPENER_ATTR = "data-lv-opener";
const AUTOFOCUS_ATTR = "data-lv-autofocus";

export default class LvPopoverController extends DismissableController<HTMLElement> {
  /** The opener recorded when the panel last opened (for focus-return on close). */
  private opener: HTMLElement | null = null;
  private readonly toggleHandler = (e: Event): void => this.onToggle(e);

  connect(): void {
    this.element.addEventListener("toggle", this.toggleHandler);
  }

  disconnect(): void {
    this.element.removeEventListener("toggle", this.toggleHandler);
    this.opener = null;
  }

  private get openerId(): string | null {
    return this.element.getAttribute(OPENER_ATTR);
  }

  private resolveOpener(): HTMLElement | null {
    const id = this.openerId;
    return id != null && id.length > 0 ? document.getElementById(id) : null;
  }

  private onToggle(rawEvent: Event): void {
    // ToggleEvent.newState is "open" | "closed"; cast because the type may be absent in some libs.
    const newState =
      (rawEvent as unknown as { newState?: string }).newState ??
      (rawEvent as ToggleEvent).newState;

    if (newState === "open") {
      this.onOpen();
    } else if (newState === "closed") {
      this.onClose();
    }
  }

  private onOpen(): void {
    const opener = this.resolveOpener();
    if (opener != null) {
      this.opener = opener;
      // Mirror aria-expanded only when the opener opted in by already declaring it.
      if (opener.hasAttribute("aria-expanded")) {
        opener.setAttribute("aria-expanded", "true");
      }
    }
    const autofocusTarget = this.element.querySelector<HTMLElement>(`[${AUTOFOCUS_ATTR}]`);
    if (autofocusTarget != null) {
      // Defer so the popover is fully shown before focus moves.
      queueMicrotask(() => autofocusTarget.focus());
    }
  }

  private onClose(): void {
    const opener = this.opener;
    this.opener = null;

    // Focus return: if the browser did not already return focus to the opener, do it.
    if (opener != null && document.activeElement !== opener) {
      opener.focus();
    }
    if (opener != null && opener.hasAttribute("aria-expanded")) {
      opener.setAttribute("aria-expanded", "false");
    }

    // Controlled/uncontrolled doctrine lives in the base: fires the close action ONLY when the
    // panel carries data-lv-wire-close (server-owned open state). Uncontrolled => no wire call.
    this.dismissViaWire(this.element, { trigger: this.element });
  }
}
