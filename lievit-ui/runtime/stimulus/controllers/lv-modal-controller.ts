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
 * Two ways the surface signals open/close, auto-selected at {@link connect}:
 *
 * 1. WIRE-VALUE mode (default; the open state is server-owned): the template stamps
 *    `data-lv-modal-open-value="${open}"`; the WIRE morph rewrites it on every open/close round-trip
 *    and Stimulus fires {@link openValueChanged}. The controller element is PRESERVED across that
 *    morph (idiomorph keeps it), so `connect()`/`disconnect()` do not re-run -- the value callback is
 *    the only signal the surface opened or closed. This is what `modal.jte` (controlled mode) and the
 *    `dialog` WIRE use.
 *
 * 2. `[hidden]`-DRIVEN mode (no `data-lv-modal-open-value` is bound, so {@link hasOpenValue} is
 *    false): the open state is CLIENT-owned. A consumer's own dispatcher reveals/hides the surface by
 *    toggling the `hidden` ATTRIBUTE on this root (the surface is NOT a wire component and never sets
 *    the Stimulus value). The controller installs a {@link MutationObserver} on its root's `hidden`
 *    attribute and reacts to it exactly as it reacts to the value: `hidden` REMOVED => open, `hidden`
 *    ADDED => close. This is the in-jar replacement for a consumer's hand-rolled `[hidden]`-observer
 *    fork (focus-trap + scroll-lock + Escape + return-focus for client-revealed overlays), so the
 *    consumer can mount `data-controller="lv-modal"` (panel marked `data-lv-modal-target="panel"`) and
 *    drop the fork. Escape here closes by re-adding `hidden` (see {@link dismissViaHidden}); a consumer
 *    that owns the close can intercept the cancelable `lievit:modal-dismiss` event to stay in sync. A
 *    must-act overlay opts out with `data-lv-modal-dismissible="false"` (Escape inert).
 *
 * Either way the transition is the same pair:
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

/**
 * Attribute that opts a `[hidden]`-driven overlay OUT of Escape-to-close (the must-act pattern), the
 * client-owned mirror of "no `data-lv-wire-close`" in wire-value mode. Any value other than the
 * literal `"false"` keeps the surface dismissible; absence keeps it dismissible (the common case).
 */
const DISMISSIBLE_ATTR = "data-lv-modal-dismissible";

/**
 * Cancelable event the controller dispatches on its root when Escape requests a close in
 * `[hidden]`-driven mode, BEFORE it re-adds `hidden`. A consumer whose own dispatcher owns the
 * open/close state listens for it (and may `preventDefault()` to run its own hide) so the controller's
 * Escape-close stays in sync with the dispatcher. Un-prevented, the controller sets `hidden` itself.
 */
const MODAL_DISMISS_EVENT = "lievit:modal-dismiss";

export default class LvModalController extends DismissableController<HTMLElement> {
  static targets = ["panel"];
  static values = { open: Boolean };

  declare readonly hasPanelTarget: boolean;
  declare readonly panelTarget: HTMLElement;
  declare readonly openValue: boolean;
  declare readonly hasOpenValue: boolean;

  /** The live trap while the surface is open; null while closed. */
  private trap: FocusTrap | null = null;
  /** True between connect() and disconnect(); gates the pre-connect initial value callback. */
  private connected = false;
  /** Watches the root's `hidden` attribute in `[hidden]`-driven mode; null in wire-value mode. */
  private hiddenObserver: MutationObserver | null = null;

  /**
   * True when no wire open-value is bound, so the open state is CLIENT-owned and driven by the
   * `hidden` attribute. False when the template stamped `data-lv-modal-open-value` (wire-value mode).
   * `modal.jte` (controlled) + the `dialog` WIRE always stamp the value, so they are never
   * hidden-driven; a consumer that mounts the controller on a `[hidden]`-toggled overlay is.
   */
  private get hiddenDriven(): boolean {
    return !this.hasOpenValue;
  }

  connect(): void {
    this.connected = true;
    if (this.hiddenDriven) {
      // Client-owned open state: observe the root's `hidden` attribute (the consumer's dispatcher
      // toggles it) and react to it the same way wire-value mode reacts to the value callback.
      this.hiddenObserver = new MutationObserver(() => this.onHiddenMutation());
      this.hiddenObserver.observe(this.element, {
        attributes: true,
        attributeFilter: ["hidden"],
      });
      if (!this.element.hasAttribute("hidden")) {
        this.activate(); // SSR-revealed: engage immediately, as connect() owns the initial state.
      }
      return;
    }
    // Wire-value mode. ValueObserver fires openValueChanged for the default value BEFORE connect()
    // (Stimulus docs): that initial call is skipped by the `connected` guard, so connect() owns the
    // initial state. Targets are available here, so the panel resolves for an SSR-open surface.
    if (this.openValue) {
      this.activate();
    }
  }

  disconnect(): void {
    // Morph-out (or page leave) while open: tear the trap down so body scroll + focus are restored.
    // No-op when the surface was closed (trap is null / FocusTrap.deactivate is idempotent). The
    // hidden-observer (if any) is disconnected so it never fires after the element leaves the tree.
    this.connected = false;
    this.hiddenObserver?.disconnect();
    this.hiddenObserver = null;
    this.deactivate();
  }

  /**
   * The server-owned open state changed (wire-value mode only). Skipped for the initial pre-connect
   * call (connect() owns the initial state) and inert in `[hidden]`-driven mode (the value is never
   * bound there, so this should not fire, but the guard keeps the two paths from crossing). Every
   * WIRE morph that flips `data-lv-modal-open-value` routes here, opening or closing the trap in
   * place without a connect/disconnect cycle.
   */
  openValueChanged(open: boolean): void {
    if (!this.connected || this.hiddenDriven) {
      return;
    }
    if (open) {
      this.activate();
    } else {
      this.deactivate();
    }
  }

  /**
   * The root's `hidden` attribute changed (`[hidden]`-driven mode). `hidden` REMOVED => the consumer
   * revealed the surface => engage; `hidden` ADDED => it hid the surface => disengage. Idempotent via
   * {@link activate} / {@link deactivate}, so a redundant mutation (e.g. re-setting an already-present
   * attribute) is a no-op.
   */
  private onHiddenMutation(): void {
    if (!this.connected) {
      return;
    }
    if (this.element.hasAttribute("hidden")) {
      this.deactivate();
    } else {
      this.activate();
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
    this.trap = new FocusTrap(this.container, { onEscape: this.resolveOnEscape() });
    this.trap.activate();
  }

  /**
   * The Escape handler for the active trap, or `undefined` to leave Escape inert. The two modes mirror
   * each other:
   *   - wire-value: route to the wire close ONLY when controlled (data-lv-wire-close present); a
   *     must-act surface has none, so Escape is inert. The doctrine lives in DismissableController.
   *   - `[hidden]`-driven: close by re-adding `hidden` ONLY when dismissible (no
   *     `data-lv-modal-dismissible="false"`); a must-act overlay opts out and Escape is inert.
   */
  private resolveOnEscape(): (() => void) | undefined {
    if (this.hiddenDriven) {
      return this.isHiddenDismissible ? (): void => this.dismissViaHidden() : undefined;
    }
    return this.isControlled
      ? (): void => {
          this.dismissViaWire(this.element);
        }
      : undefined;
  }

  /** Whether a `[hidden]`-driven overlay allows Escape-to-close (the client mirror of isControlled). */
  private get isHiddenDismissible(): boolean {
    return this.element.getAttribute(DISMISSIBLE_ATTR) !== "false";
  }

  /**
   * Closes a `[hidden]`-driven overlay client-side: dispatch a cancelable {@link MODAL_DISMISS_EVENT}
   * so a consumer that owns the open state can intercept it; if no one prevents it, re-add `hidden`,
   * which the {@link hiddenObserver} then sees and uses to tear the trap down (restore scroll + focus).
   */
  private dismissViaHidden(): void {
    const proceed = this.element.dispatchEvent(
      new CustomEvent(MODAL_DISMISS_EVENT, { bubbles: true, cancelable: true }),
    );
    if (proceed) {
      this.element.setAttribute("hidden", "");
    }
  }

  private deactivate(): void {
    this.trap?.deactivate();
    this.trap = null;
  }
}
