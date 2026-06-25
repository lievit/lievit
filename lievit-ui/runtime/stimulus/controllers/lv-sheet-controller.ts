/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * `lv-sheet` -- the CONTROLLED sheet (edge-anchored modal dialog) focus mechanics, as a Stimulus
 * controller (the conversion of the sheet's use of `runtime/features/focus-trap.enhancer.ts`).
 * Mounted ON THE `<dialog>` panel via `data-controller="lv-sheet"`, which the template stamps ONLY
 * in the CONTROLLED + open state (`${(isControlled && open) ? "lv-sheet" : null}`). The UNCONTROLLED
 * sheet is a native modal `<dialog>` opened with `showModal()`; the browser owns its trap + Escape +
 * `::backdrop`, so it carries NO controller and this class never touches it (zero JS, by design).
 *
 * All three modal focus-mechanics a controlled `<dialog open>` (NON-modal: not in the top layer)
 * owes per WAI-ARIA APG Dialog/Modal are delegated to the shared {@link FocusTrap} util -- the ONE
 * place trap + scroll-lock + return-focus live, so this controller re-rolls none of them:
 * 1. **trap Tab / Shift+Tab** inside the dialog while it is shown;
 * 2. **scroll-lock** the body while the dialog is open;
 * 3. **return focus** to the opener when the dialog closes (Stimulus `disconnect`).
 *
 * Escape obeys the controlled/uncontrolled doctrine via the shared {@link DismissableController}
 * base: {@link FocusTrap}'s `onEscape` calls {@link DismissableController.dismissViaWire}, which
 * fires the close action ONLY when the panel carries `data-lv-wire-close` (server-owned open state).
 * The template stamps `data-lv-wire-close` exactly when `isControlled && closable`, so:
 * - controlled + closable   => Escape fires the close action over the wire (server flips `open`);
 * - controlled + !closable  => `data-lv-wire-close` is absent => Escape is inert (the must-act
 *   pattern: a non-dismissible sheet cannot be closed by Escape), with ZERO `/lievit/<id>/call`.
 * There is no hardcoded `"close"` fallback -- firing a spurious close on a host with no matching
 * `@LievitAction` is exactly the wire-410 "page expired" bug the doctrine prevents.
 *
 * Morph-safety: the controller connects when the open dialog enters the DOM and Stimulus tears the
 * trap down in `disconnect()` when the wire morph drops `data-controller` (open -> closed) or removes
 * the dialog. No `data-lievit-rt-focus-trap-active` marker, no `afterCall` sweep, no stuck
 * scroll-lock on a hidden-but-present dialog -- Stimulus owns the lifecycle, so closing the sheet
 * deactivates the trap exactly once and restores focus + scrolling.
 *
 * a11y source: WAI-ARIA APG Dialog (Modal) https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/
 */

import { DismissableController } from "../base/dismissable-controller.js";
import { FocusTrap } from "../base/focus-trap.js";

export default class LvSheetController extends DismissableController<HTMLElement> {
  /** The active focus trap over the dialog, live between `connect` and `disconnect`. */
  private trap: FocusTrap | null = null;

  connect(): void {
    // Modal surface: trap Tab + scroll-lock + return-focus, with Escape routed through the
    // controlled/uncontrolled doctrine (dismissViaWire is a no-op when data-lv-wire-close is absent).
    this.trap = new FocusTrap(this.element, {
      onEscape: () => {
        this.dismissViaWire(this.element, { trigger: this.element });
      },
    });
    this.trap.activate();
  }

  disconnect(): void {
    // Stimulus calls this on morph-out (open -> closed loses data-controller, or the dialog is
    // removed): deactivate releases the scroll-lock and returns focus to the opener exactly once.
    this.trap?.deactivate();
    this.trap = null;
  }
}
