/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * `lv-toggle` -- the two-state toggle button (WAI-ARIA APG Toggle Button) for `lievit/toggle.jte`,
 * as a Stimulus controller. Mounted ON THE `<button>` via `data-controller="lv-toggle"`; the click
 * is wired CSP-clean by `data-action="click->lv-toggle#toggle"` (a plain string, no inline handler).
 *
 * The controlled/uncontrolled doctrine, applied to a press (the same rule that governs the overlay
 * family, here for a button instead of a dismiss):
 *
 * - CONTROLLED -- the button carries the established lievit wire attribute `l:click="<action>"`
 *   (emitted by `toggle.jte` only when `wireClick` is non-blank): the pressed state is a SERVER
 *   fact (data-down). The runtime's own `l:click` binding rides the click to the wire, the server
 *   flips `pressed`, and the morph patches `aria-pressed`/`data-pressed` on re-render. This
 *   controller MUST NOT also flip the state or fire a second wire call -- it defers entirely. So
 *   {@link toggle} is a no-op here; the server owns the truth (no optimistic divergence).
 *
 * - UNCONTROLLED -- no `l:click`: the press is purely local UI state with NO owner on the server.
 *   {@link toggle} flips `aria-pressed` (and the mirrored `data-pressed`) CLIENT-SIDE with ZERO
 *   `/lievit/<id>/call`. This is the capability the server-only partial lacked; it is the
 *   button-shaped form of "an uncontrolled instance acts purely client-side, ZERO round-trip".
 *
 * Reading `l:click` (not `data-lv-wire-close`) is deliberate: a toggle has no overlay and no close,
 * so the {@link DismissableController} base does not apply. `l:click` IS the established lievit
 * contract attribute that marks a server-owned action on this element (the runtime reads the same
 * attribute, runtime.ts), so it is the correct controlled-ness signal here. The controller never
 * imports the wire bridge and fires ZERO wire calls of its own -- the controlled path's round-trip
 * is the runtime's `l:click` responsibility, untouched by this conversion.
 *
 * Why a plain {@link Controller}, not {@link DismissableController}: there is nothing to dismiss and
 * no focus to trap/return (a native `<button>` gives role + Enter/Space activation + Tab focus +
 * `disabled` semantics for free, and the APG label-stability rule keeps the label fixed across
 * states). So there is no focus/dismiss logic to collapse into the shared base.
 *
 * Morph-safety: the click is a declared `data-action`, so Stimulus re-binds it automatically after
 * the lievit wire morph + idiomorph + Turbo Drive; a morph that removes the button disconnects the
 * controller. No `WeakSet` of wired buttons, no `data-*-enhanced` marker -- Stimulus owns the
 * lifecycle, which is the whole point of the migration.
 *
 * a11y source: WAI-ARIA APG Button -- Toggle Button. `aria-pressed` communicates the state (the
 * label never changes); `[aria-pressed="true"]` drives the visual via CSS, no class mutation.
 */

import { Controller } from "@hotwired/stimulus";

/** The established lievit wire attribute that, when present+non-blank, marks a server-owned click. */
const WIRE_CLICK_ATTR = "l:click";

export default class LvToggleController extends Controller<HTMLButtonElement> {
  /**
   * True when the pressed state is owned by the server: the button declares a non-blank
   * `l:click` action, so the runtime rides the click to the wire and the morph reconciles the
   * state. The controller stays out of this path.
   */
  get isControlled(): boolean {
    const action = this.element.getAttribute(WIRE_CLICK_ATTR);
    return action != null && action.trim().length > 0;
  }

  /**
   * `click->lv-toggle#toggle`. CONTROLLED: no-op (the server owns the pressed state; the runtime's
   * `l:click` fires the round-trip and the morph patches the attributes). UNCONTROLLED: flip the
   * pressed state purely client-side, ZERO wire round-trip.
   */
  toggle(): void {
    if (this.isControlled) {
      return;
    }
    const next = this.element.getAttribute("aria-pressed") !== "true";
    const value = next ? "true" : "false";
    // Keep aria-pressed (the APG state + the CSS `aria-[pressed=true]:` selector) and the mirrored
    // data-pressed in lock-step, exactly as toggle.jte renders them from the server `pressed` fact.
    this.element.setAttribute("aria-pressed", value);
    this.element.setAttribute("data-pressed", value);
  }
}
