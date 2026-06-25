/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * `lv-alert-dialog` -- the WAI-ARIA APG Alert Dialog focus mechanics, as a Stimulus controller (the
 * conversion of the shared `runtime/features/focus-trap.enhancer.ts` for the alert-dialog instance).
 * Mounted ON THE PANEL ELEMENT (`role="alertdialog"`) via `data-controller="lv-alert-dialog"`. The
 * title, description, confirm/cancel buttons and all ARIA are server-rendered HTML; this controller
 * ONLY owns the three modal focus mechanics the server cannot do:
 *
 * 1. **focus trap** -- Tab / Shift+Tab cycle within the panel, body scroll-lock while open;
 * 2. **initial focus on the cancel button** -- the least-destructive action (`[data-initial-focus]`),
 *    per APG "focus the least destructive action on open for irreversible steps";
 * 3. **return focus to the opener** on close (the morph removes the panel -> `disconnect`).
 *
 * All three are composed from the shared {@link FocusTrap} util (never re-rolled here) -- the same
 * lever dialog / drawer / sheet reuse. The controller adds nothing but wiring it to `connect`/
 * `disconnect` and routing Escape to the wire.
 *
 * Escape == cancel (deliberate, never a neutral dismiss -- there is no close-X and the backdrop does
 * not dismiss). The controlled/uncontrolled doctrine (wire-410 fix) lives in {@link
 * DismissableController.dismissViaWire}: Escape fires the action named in `data-lv-wire-close` ONLY
 * when the surface is wire-CONTROLLED (an alert-dialog's open state is server-owned by definition,
 * so the template always stamps it). An uncontrolled instance (attribute absent) closes with ZERO
 * round-trip. The doctrine is read by the base, never re-implemented or hardcoded to "cancel" here.
 *
 * Morph-safety: the panel appears when the parent wire component re-renders with open=true (Stimulus
 * `connect` -> trap activates); it is removed when open=false (Stimulus `disconnect` -> trap
 * deactivates + returns focus). No `data-lievit-rt-focus-trap-active` marker, no `afterCall` sweep
 * for orphaned traps -- Stimulus owns connect/disconnect, so the idempotency + teardown are free.
 *
 * a11y source: WAI-ARIA APG Alert Dialog + Modal Dialog
 * (https://www.w3.org/WAI/ARIA/apg/patterns/alertdialog/,
 *  https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/).
 */

import { DismissableController } from "../base/dismissable-controller.js";
import { FocusTrap } from "../base/focus-trap.js";

export default class LvAlertDialogController extends DismissableController<HTMLElement> {
  /** The active modal focus trap (Tab cycle + scroll-lock + return-focus), or null while disconnected. */
  private trap: FocusTrap | null = null;

  connect(): void {
    // Modal surface: trap Tab + scroll-lock + move initial focus to [data-initial-focus] (the cancel
    // button) + capture the opener for return-on-close. Escape routes to the wire cancel action.
    this.trap = new FocusTrap(this.element, { onEscape: () => this.onEscape() });
    this.trap.activate();
  }

  disconnect(): void {
    // Deactivate restores body scroll + returns focus to the element that held it on activate (the
    // opener). Stimulus calls this when the morph removes the closed panel.
    this.trap?.deactivate();
    this.trap = null;
  }

  /**
   * Escape inside the trap == cancel for an alert dialog. {@link DismissableController.dismissViaWire}
   * encodes the controlled/uncontrolled doctrine: it fires `data-lv-wire-close` on the enclosing
   * component when controlled, and is a no-op when uncontrolled (no spurious wire-410 close).
   */
  private onEscape(): void {
    this.dismissViaWire(this.element, { trigger: this.element });
  }
}
