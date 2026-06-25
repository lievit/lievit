/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * `lv-drawer` -- the CONTROLLED + modal side-panel overlay focus-mechanics, as a Stimulus
 * controller (the conversion of the drawer partial's reliance on the shared
 * `runtime/features/focus-trap.enhancer.ts`). Mounted ON THE PANEL element (the
 * `[data-slot="drawer-panel"]` `role="dialog"` div) via `data-controller="lv-drawer"`.
 *
 * The drawer is a WAI-ARIA APG Dialog (Modal) rendered to a viewport EDGE: every focus rule is
 * identical to dialog, placement is purely visual. The open/closed STATE is SERVER-OWNED (the
 * caller's `@Wire boolean open`): the server flips the panel's `hidden` attribute and the client
 * morphs it. This controller never decides open-state and never round-trips the wire to SET it;
 * it only supplies the three focus-mechanics a modal owes by APG that the server cannot do:
 *
 * - **focus trap**: Tab / Shift+Tab cycle within the panel, body scroll-lock, initial focus moved
 *   in ([data-initial-focus] > [autofocus] > first focusable > the panel). This is the shared
 *   {@link FocusTrap} util -- the convergence lever, never re-rolled per overlay.
 * - **Escape-to-close**: routed through {@link DismissableController.dismissViaWire}, so the
 *   controlled/uncontrolled doctrine (the wire-410 fix) decides whether a wire round-trip fires.
 *   The panel carries `data-lv-wire-close="<closeAction>"` ONLY when controlled + modal + closable;
 *   absent (the must-act `!closable` case) => `dismissViaWire` is a no-op => Escape is inert, the
 *   trap stays. The doctrine lives ONCE in the base; there is no hardcoded `"close"` fallback here.
 * - **return focus**: {@link FocusTrap} records the element focused when the trap activated (the
 *   opener) and restores it on deactivate.
 *
 * Activation is driven by the `open` Stimulus value (`data-lv-drawer-open-value`): the server
 * stamps the boolean, the morph mutates it, and Stimulus fires {@link openValueChanged}. We hold
 * the trap while open, drop it while closed -- so a panel that stays in the DOM as `hidden`
 * (destroyOnClose=false) never traps focus behind an invisible surface. A non-modal controlled
 * drawer never carries `data-controller="lv-drawer"` (the template omits it; APG non-modal = native
 * Tab), so this controller only ever runs the modal case.
 *
 * Morph-safety: Stimulus connects this controller once per element+identifier and disconnects it
 * when the morph drops the panel; {@link disconnect} tears the trap (and its document keydown
 * listener) down. No `data-lievit-rt-focus-trap-active` marker, no `afterCall` sweep, no
 * `WeakSet` of trapped containers -- Stimulus owns the lifecycle, the idempotency is free.
 *
 * APG source: https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/
 */

import { DismissableController } from "../base/dismissable-controller.js";
import { FocusTrap } from "../base/focus-trap.js";

export default class LvDrawerController extends DismissableController<HTMLElement> {
  static values = { open: Boolean };

  declare readonly openValue: boolean;
  declare readonly hasOpenValue: boolean;

  /** The live trap while the panel is open, or `null` while closed (the activation flag). */
  private trap: FocusTrap | null = null;

  /**
   * Stimulus fires this after `initialize` and on every `data-lv-drawer-open-value` mutation
   * (the wire morph flips it). Hold the focus trap while open, drop it while closed.
   */
  openValueChanged(open: boolean): void {
    if (open) {
      this.activateTrap();
    } else {
      this.deactivateTrap();
    }
  }

  disconnect(): void {
    this.deactivateTrap();
  }

  /** Activate the shared modal trap once (idempotent: a re-fire while open is a no-op). */
  private activateTrap(): void {
    if (this.trap != null) {
      return;
    }
    this.trap = new FocusTrap(this.element, { onEscape: () => this.dismissViaWire() });
    this.trap.activate();
  }

  /** Deactivate the trap (restores scroll + focus); a no-op when already closed. */
  private deactivateTrap(): void {
    this.trap?.deactivate();
    this.trap = null;
  }
}
