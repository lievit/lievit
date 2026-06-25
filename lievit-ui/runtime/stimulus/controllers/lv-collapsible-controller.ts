/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * `lv-collapsible` -- the WAI-ARIA APG Disclosure (Radix Collapsible source) toggle, as a Stimulus
 * controller. The conversion of the collapsible WIRE component (`registry/wire/collapsible`): there
 * was no `*.enhancer.ts` before -- the disclosure rode the core `l:click="toggle"` directive, which
 * ALWAYS round-tripped (the open state lives server-side in `CollapsibleComponent.open`). This
 * controller owns the trigger click (CSP-clean `data-action`, no `l:click`) and routes it through
 * the controlled/uncontrolled doctrine, the SAME wire-410 rule the overlays follow, applied here to
 * a NON-close `toggle` action via the {@link callWire} seam:
 *
 * - **CONTROLLED**: the root carries `data-lv-wire-toggle="<action>"` (the `@LievitAction` name).
 *   The open state is server-owned, so `#toggle` rides the wire and the server re-renders +
 *   morphs the new `aria-expanded` / `hidden` / `data-state` / chevron. The controller mutates
 *   ZERO client state on this path (the server is the single owner). This is what the shipped
 *   `collapsible.jte` stamps, so ALL existing behaviour is preserved.
 * - **UNCONTROLLED**: `data-lv-wire-toggle` absent/blank => {@link callWire} is a no-op (ZERO
 *   `/lievit/<id>/call`) and the disclosure flips PURELY client-side. A standalone (non-wire)
 *   include of the template gets a working, a11y-correct disclosure for free -- and the spurious
 *   wire round-trip that maps to a 410 "page expired" can never happen.
 *
 * `disabled` is honoured on BOTH paths (no toggle, no round-trip), mirroring the server no-op in
 * `CollapsibleComponent.toggle()` so a disabled trigger never flips, client- or server-side.
 *
 * Mounted on the component ROOT (`[data-lievit-component]`), so {@link Controller.element} is the
 * wire root and {@link callWire} addresses it directly. shadcn DOM namespace: the canonical state
 * hook is `data-state="open"|"closed"` on the root (`data-slot` identifies the parts); the
 * controller drives `data-state` on the uncontrolled path.
 *
 * Morph-safety: the click is a `data-action`, which Stimulus re-binds when the wire morph
 * re-renders the trigger; nothing is bound in `connect()`, so there is nothing to leak and no
 * `WeakSet` / `data-*-enhanced` marker -- Stimulus owns connect/disconnect.
 *
 * a11y source: WAI-ARIA APG Disclosure + Radix Collapsible (button[aria-expanded][aria-controls] +
 * region[aria-labelledby], collapsed region removed from the a11y tree via `hidden`).
 */

import { Controller } from "@hotwired/stimulus";
import { callWire } from "../bridge.js";

/** The controlled-marker attribute: present + non-blank names the wire `@LievitAction` to fire. */
const WIRE_TOGGLE_ATTR = "data-lv-wire-toggle";

export default class LvCollapsibleController extends Controller<HTMLElement> {
  static targets = ["trigger", "region", "chevron"];
  static values = { disabled: Boolean };

  declare readonly triggerTarget: HTMLElement;
  declare readonly hasTriggerTarget: boolean;
  declare readonly regionTarget: HTMLElement;
  declare readonly hasRegionTarget: boolean;
  declare readonly chevronTarget: HTMLElement;
  declare readonly hasChevronTarget: boolean;
  declare readonly disabledValue: boolean;

  /**
   * The wire action to fire when the disclosure is server-controlled, or `null` when uncontrolled
   * (`data-lv-wire-toggle` absent/blank). Drives the controlled/uncontrolled split, mirroring
   * `DismissableController.wireCloseAction` for the close family.
   */
  private get wireToggleAction(): string | null {
    const v = this.element.getAttribute(WIRE_TOGGLE_ATTR);
    return v != null && v.length > 0 ? v : null;
  }

  /**
   * The disclosure trigger click. Routed by the doctrine: CONTROLLED => the named action rides the
   * wire and the server re-renders; UNCONTROLLED => a purely client-side flip with no round-trip.
   * A no-op while `disabled` (mirrors the server-side guard) so neither path runs.
   *
   * @param event the click event (its `currentTarget` is the trigger; used for the call meta)
   */
  toggle(event?: Event): void {
    if (this.disabledValue) {
      return;
    }
    const trigger = this.resolveTrigger(event);
    // callWire is a no-op (returns false) when wireToggleAction is null => UNCONTROLLED => flip
    // locally. CONTROLLED => the server owns the open state and morphs the result; do NOT also
    // mutate the DOM here or the optimistic flip would fight the authoritative morph.
    const fired = callWire(this.element, this.wireToggleAction, { trigger });
    if (!fired) {
      this.flipLocally();
    }
  }

  /** The trigger element for the call meta: the event's currentTarget, else the target, else root. */
  private resolveTrigger(event?: Event): Element {
    const current = event?.currentTarget;
    if (current instanceof Element) {
      return current;
    }
    return this.hasTriggerTarget ? this.triggerTarget : this.element;
  }

  /**
   * UNCONTROLLED client-side disclosure flip: keeps the APG a11y contract (button `aria-expanded`
   * + region `hidden` toggled together) and the shadcn `data-state` hook in sync, and rotates the
   * chevron. Reads the current state from the rendered DOM, never from a duplicated client field.
   */
  private flipLocally(): void {
    const next = !this.isOpen();
    if (this.hasTriggerTarget) {
      this.triggerTarget.setAttribute("aria-expanded", next ? "true" : "false");
    }
    if (this.hasRegionTarget) {
      // `hidden` present => collapsed (out of the tab order + a11y tree); absent => expanded.
      this.regionTarget.toggleAttribute("hidden", !next);
    }
    this.element.setAttribute("data-state", next ? "open" : "closed");
    if (this.hasChevronTarget) {
      this.chevronTarget.style.transform = `rotate(${next ? "180" : "0"}deg)`;
    }
  }

  /** Reads the current open state from the server-rendered DOM (the single source of truth). */
  private isOpen(): boolean {
    if (this.hasTriggerTarget) {
      return this.triggerTarget.getAttribute("aria-expanded") === "true";
    }
    return this.element.getAttribute("data-state") === "open";
  }
}
