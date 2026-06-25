/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * The shared base every dismissable surface (popover, dropdown-menu, context-menu, dialog, drawer,
 * sheet, sidebar off-canvas) extends. It exists so the **controlled / uncontrolled doctrine lives
 * in exactly ONE place** -- the rule that fixed the wire-410 "page expired" bug:
 *
 * > An overlay fires a wire round-trip on close ONLY when it is wire-CONTROLLED (its open state is
 * > owned by the server). An UNCONTROLLED instance closes purely client-side with ZERO
 * > `/lievit/<id>/call`. Firing a spurious `close` on an uncontrolled overlay whose host has no
 * > matching `@LievitAction` maps to UNKNOWN_COMPONENT -> 410 -> a misleading "page expired" dialog.
 *
 * Controlled-ness is read from the established lievit contract attribute `data-lv-wire-close`
 * (the templates stamp it ONLY when the open state is server-owned), exposed here as
 * {@link DismissableController.wireCloseAction} / {@link DismissableController.isControlled}. A
 * subclass calls {@link DismissableController.dismissViaWire} on close and the doctrine decides:
 * controlled -> the named action rides the wire; uncontrolled -> nothing happens.
 *
 * It also offers the lightest return-focus pair ({@link captureReturnFocus} /
 * {@link restoreReturnFocus}) for surfaces that want focus restored on close without a full trap
 * (use {@link FocusTrap} from `./focus-trap` for modal surfaces that also trap Tab).
 *
 * Morph-safety: there is NO `data-*-enhanced` / `wireOnce` bookkeeping here. Stimulus connects this
 * controller exactly once per element+identifier and disconnects it when the morph removes the
 * element; subclasses bind listeners in `connect()` and Stimulus tears them down for free in
 * `disconnect()`. That is the whole reason the migration replaces the hand-rolled idempotency.
 */

import { Controller } from "@hotwired/stimulus";
import type { CallMeta } from "../../lifecycle.js";
import { callWire } from "../bridge.js";

/** The established lievit contract attribute that marks a wire-CONTROLLED overlay + names its close action. */
const WIRE_CLOSE_ATTR = "data-lv-wire-close";

/**
 * Base controller carrying the controlled/uncontrolled close doctrine + return-focus helpers.
 * Not registered as a Stimulus identifier itself (it lives outside `controllers/`, so the
 * filename-autoloader never picks it up); concrete controllers `extends DismissableController`.
 *
 * @typeParam T the controller's root element type
 */
export class DismissableController<T extends Element = Element> extends Controller<T> {
  private returnTarget: HTMLElement | null = null;

  /**
   * The close action to fire on the wire when this surface is server-controlled, or `null` when it
   * is uncontrolled (the `data-lv-wire-close` attribute is absent/blank). Subclasses may override
   * to read the attribute from a child panel rather than the root.
   */
  get wireCloseAction(): string | null {
    const v = this.element.getAttribute(WIRE_CLOSE_ATTR);
    return v != null && v.length > 0 ? v : null;
  }

  /** True when the surface's open state is owned by the server (a wire close action is declared). */
  get isControlled(): boolean {
    return this.wireCloseAction != null;
  }

  /**
   * The single close seam. Fires the declared wire close action on the enclosing component when
   * (and only when) this surface is wire-CONTROLLED; a no-op for an uncontrolled surface. This is
   * the one method that encodes the doctrine; subclasses call it from their close path.
   *
   * @param from  the element to resolve the component root from (defaults to the controller root)
   * @param meta  optional call meta forwarded to the wire (e.g. `{ trigger }`)
   * @returns true when a wire call was dispatched, false when it was a client-only close
   */
  protected dismissViaWire(from: Element = this.element, meta?: CallMeta): boolean {
    return callWire(from, this.wireCloseAction, meta);
  }

  /** Records the currently-focused element so {@link restoreReturnFocus} can put focus back. */
  protected captureReturnFocus(): void {
    this.returnTarget =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
  }

  /**
   * Returns focus to the element captured by {@link captureReturnFocus}, unless `unless` already
   * holds focus (the browser may have restored it natively, e.g. native popover Esc). Clears the
   * captured target either way.
   *
   * @param unless if this element already has focus, do not move it (avoid a redundant focus())
   */
  protected restoreReturnFocus(unless?: Element | null): void {
    const target = this.returnTarget;
    this.returnTarget = null;
    if (target == null || typeof target.focus !== "function") {
      return;
    }
    if (unless != null && document.activeElement === unless) {
      return;
    }
    target.focus();
  }
}
