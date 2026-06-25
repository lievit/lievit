/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * `lv-modal` -- the centred modal-overlay surface (the `modal` PARTIAL + the `dialog` WIRE), as a
 * Stimulus controller. It is the conversion of the two focus-mechanics enhancers the modal family
 * used: `runtime/features/focus-trap.enhancer.ts` (modal.jte controlled mode) and
 * `registry/wire/dialog/overlay.enhancer.ts` (dialog.jte). Both did the SAME three things a modal
 * owes by WAI-ARIA APG that the server cannot do -- focus-trap, Escape-to-close, return-focus --
 * so they collapse into ONE controller composing the shared `FocusTrap` util + the shared
 * `DismissableController` doctrine. The open/closed STATE stays server-owned; this controller never
 * sets it, it only reacts to it.
 *
 * Mounted via `data-controller="lv-modal"` on the element that carries the server's boolean `hidden`
 * (modal.jte: the `<dialog>` itself; dialog.jte: the overlay root). The trap container is the
 * role=dialog panel: `data-lv-modal-target="panel"` when the panel is a descendant (dialog.jte),
 * else the controller element itself (modal.jte, where the `<dialog>` IS the panel).
 *
 * Server-owned open, reacted to via a Stimulus Value (NOT a hand-rolled MutationObserver): the
 * template stamps `data-lv-modal-open-value="${open}"`; the WIRE morph rewrites it on every
 * open/close round-trip and Stimulus fires {@link openValueChanged}. The controller element is
 * PRESERVED across that morph (idiomorph keeps it), so `connect()`/`disconnect()` do not re-run --
 * the value callback is the only signal the surface opened or closed.
 *   - open  => activate a {@link FocusTrap} on the panel (trap Tab + scroll-lock the body + move
 *              initial focus in, capturing the trigger to return focus to on close).
 *   - close => deactivate it (restore body scroll + return focus to the captured trigger).
 *
 * Controlled / uncontrolled doctrine (wire-410 fix), inherited from {@link DismissableController}:
 * Escape fires the wire close action ONLY when this surface is wire-CONTROLLED, i.e. it carries a
 * non-empty `data-lv-wire-close` (the template stamps it only when a server close action exists and
 * the surface is closable/dismissible). A must-act dialog (`closable=false` / `dismissible=false`)
 * has NO `data-lv-wire-close`, so {@link isControlled} is false, no `onEscape` is wired, and Escape
 * is inert -- the must-act pattern, preserved. The explicit close button + the backdrop still fire
 * their own server-rendered `l:click` close (the WIRE runtime handles those directly; the controller
 * does not duplicate them).
 *
 * Morph-safety: there is no `data-*-enhanced` marker, no `activeTraps` Map, no `afterCall` sweep.
 * Stimulus connects this controller once and {@link disconnect}s it when the morph drops the element
 * (which tears the trap down -- restoring scroll + focus); the value callback handles the in-place
 * open<->close transition. That replaces every hand-rolled idempotency the two enhancers carried.
 *
 * APG source: https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/
 */

import { DismissableController } from "../base/dismissable-controller.js";
import { FocusTrap } from "../base/focus-trap.js";

export default class LvModalController extends DismissableController<HTMLElement> {
  static targets = ["panel"];
  static values = { open: Boolean };

  declare readonly hasPanelTarget: boolean;
  declare readonly panelTarget: HTMLElement;
  declare readonly openValue: boolean;

  /** The live trap while the surface is open; null while closed. */
  private trap: FocusTrap | null = null;
  /** True between connect() and disconnect(); gates the pre-connect initial value callback. */
  private connected = false;

  connect(): void {
    // ValueObserver fires openValueChanged for the default value BEFORE connect() (Stimulus docs):
    // that initial call is skipped by the `connected` guard, so connect() owns the initial state.
    // Targets are available here, so the panel target resolves correctly for an SSR-open surface.
    this.connected = true;
    if (this.openValue) {
      this.activate();
    }
  }

  disconnect(): void {
    // Morph-out (or page leave) while open: tear the trap down so body scroll + focus are restored.
    // No-op when the surface was closed (trap is null / FocusTrap.deactivate is idempotent).
    this.connected = false;
    this.deactivate();
  }

  /**
   * The server-owned open state changed. Skipped for the initial pre-connect call (connect() owns
   * the initial state); thereafter every WIRE morph that flips `data-lv-modal-open-value` routes
   * here, opening or closing the trap in place without a connect/disconnect cycle.
   */
  openValueChanged(open: boolean): void {
    if (!this.connected) {
      return;
    }
    if (open) {
      this.activate();
    } else {
      this.deactivate();
    }
  }

  /** The role=dialog panel the trap guards: the `panel` target if present, else the controller root. */
  private get container(): HTMLElement {
    return this.hasPanelTarget ? this.panelTarget : this.element;
  }

  private activate(): void {
    if (this.trap != null) {
      return; // already open; activation is idempotent
    }
    // Escape routes to the wire close ONLY when controlled+dismissible (data-lv-wire-close present);
    // a must-act surface passes no onEscape, so FocusTrap leaves Escape inert (no preventDefault,
    // no call). The doctrine itself lives in DismissableController, never re-implemented here.
    const onEscape = this.isControlled
      ? (): void => {
          this.dismissViaWire(this.element);
        }
      : undefined;
    this.trap = new FocusTrap(this.container, { onEscape });
    this.trap.activate();
  }

  private deactivate(): void {
    this.trap?.deactivate();
    this.trap = null;
  }
}
