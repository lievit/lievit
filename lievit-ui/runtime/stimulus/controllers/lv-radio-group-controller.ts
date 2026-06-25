/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * `lv-radio-group` -- roving-tabindex keyboard navigation for the lievit-ui radio-group CUSTOM
 * variant (`role="radiogroup"` + `role="radio"`), as a Stimulus controller (the conversion of
 * `registry/jte/radio-group.enhancer.ts`). Mounted on the radiogroup ROOT via
 * `data-controller="lv-radio-group"`. The NATIVE variant (`nativeInputs=true`) carries no controller:
 * the platform supplies identical roving + arrow-key behaviour for real `<input type="radio">`
 * elements sharing a `name`.
 *
 * It is DIRECT-focus, not aria-activedescendant: the focused option IS the active option (APG Radio
 * Group), unlike the listbox/menu collection-nav. Each option is a Stimulus `option` target so the
 * controller reaches them in DOM order without a querySelector.
 *
 * Controlled / uncontrolled doctrine (the wire-410 fix), honoured BY CONSTRUCTION: this controller
 * NEVER calls the wire. On a state change it dispatches a DOM `change` event (for plain `<form>`
 * submissions + generic listeners) and a `lievit:radio-change` CustomEvent on the root. If the
 * consuming template opted into the wire via `l:change` on `attrs`, the runtime's own event
 * delegation rides that `change` to the server; the controller itself issues ZERO `/lievit/<id>/call`.
 * So it does not extend {@link DismissableController}, does not import the bridge, and a spurious
 * "close" round-trip is structurally impossible here.
 *
 * shadcn DOM namespace preserved: the option hooks are `role="radio"` + `data-slot="radio-option"` +
 * `data-value` + `aria-checked`/`aria-disabled` (server-rendered facts), never `data-lv-*`.
 *
 * Keyboard map (verbatim WAI-ARIA APG Radio Group, https://www.w3.org/WAI/ARIA/apg/patterns/radio/):
 *   ArrowDown / ArrowRight  -> next non-disabled option (wrap, skip disabled); check it; uncheck prev.
 *   ArrowUp   / ArrowLeft   -> prev non-disabled option (wrap, skip disabled); check it; uncheck prev.
 *   Space                   -> check the focused option if unchecked; no-op if already checked.
 *   Enter                   -> no action (APG: only Space activates).
 *   Tab / Shift+Tab         -> the platform exits/enters the group (roving: one tabindex=0 at a time).
 *
 * Morph-safety: Stimulus connects this controller once per element+identifier and the declared
 * `keydown` `data-action` is re-bound automatically across the lievit wire morph + idiomorph + Turbo
 * Drive. No `data-lievit-rt-rg-active` marker, no `activeGroups` map, no `afterCall` sweep -- the
 * hand-rolled idempotency the enhancer carried is gone; Stimulus owns connect/disconnect.
 */

import { Controller } from "@hotwired/stimulus";

export default class LvRadioGroupController extends Controller<HTMLElement> {
  static targets = ["option"];

  declare readonly optionTargets: HTMLElement[];

  /**
   * On connect (mount + a morph that replaces the root) reconcile the roving tabindex over the
   * server-rendered state: exactly one option holds tabindex=0 (the checked one, else the first
   * non-disabled). Idempotent over the JTE output, and the safety net when a morph changed which
   * option is checked.
   */
  connect(): void {
    this.syncTabindex();
  }

  /**
   * The single keydown handler, declared in the template as
   * `data-action="keydown->lv-radio-group#onKeydown"` on the root (a focused option's keydown
   * bubbles up to it). Implements the APG Radio Group keyboard map; `preventDefault` on every key it
   * owns (arrows + Space) so the page never scrolls under the group.
   */
  onKeydown(event: KeyboardEvent): void {
    const options = this.optionTargets;
    const focused = options.find((o) => o === document.activeElement) ?? null;
    let handled = false;

    if (event.key === "ArrowDown" || event.key === "ArrowRight") {
      const target = this.nextOption(options, focused, 1);
      if (target != null) {
        this.select(options, target);
      }
      handled = true;
    } else if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
      const target = this.nextOption(options, focused, -1);
      if (target != null) {
        this.select(options, target);
      }
      handled = true;
    } else if (event.key === " ") {
      // Space: check the focused option if not already checked (APG); always own the key (no scroll).
      if (
        focused != null &&
        !this.isDisabled(focused) &&
        focused.getAttribute("aria-checked") !== "true"
      ) {
        this.select(options, focused);
      }
      handled = true;
    }
    // Enter: no-op (APG Radio Group does not bind Enter).

    if (handled) {
      event.preventDefault();
    }
  }

  /**
   * Checks `target`, unchecks every other option, moves the roving tabindex + DOM focus to it, then
   * announces the change: a bubbling DOM `change` (for `<form>` + `l:change` delegation) and a
   * `lievit:radio-change` CustomEvent carrying `{ name, value }`. The controller does NOT call the
   * wire itself (the controlled/uncontrolled doctrine: any wire ride is the runtime's `l:change`).
   */
  private select(options: HTMLElement[], target: HTMLElement): void {
    const name = this.element.getAttribute("id")?.replace(/^rg-/, "") ?? "";
    const value = target.getAttribute("data-value") ?? "";

    for (const opt of options) {
      opt.setAttribute("aria-checked", opt === target ? "true" : "false");
      opt.tabIndex = opt === target ? 0 : -1;
    }

    target.focus();

    this.element.dispatchEvent(new Event("change", { bubbles: true, cancelable: false }));
    this.element.dispatchEvent(
      new CustomEvent("lievit:radio-change", {
        bubbles: true,
        cancelable: false,
        detail: { name, value },
      }),
    );
  }

  /**
   * Sets the roving tabindex: exactly one option gets tabindex=0 (the checked one if any, else the
   * first non-disabled, else the first option for structural reachability), every other gets -1.
   */
  private syncTabindex(): void {
    const options = this.optionTargets;
    const checked = options.find((o) => o.getAttribute("aria-checked") === "true") ?? null;
    const tabStop = checked ?? this.firstTabStop(options);
    for (const opt of options) {
      opt.tabIndex = opt === tabStop ? 0 : -1;
    }
  }

  /** The first non-disabled option, or the first option if all are disabled (reachability). */
  private firstTabStop(options: HTMLElement[]): HTMLElement | null {
    if (options.length === 0) {
      return null;
    }
    return options.find((o) => !this.isDisabled(o)) ?? options[0];
  }

  /** Whether an option is disabled (aria-disabled="true"). */
  private isDisabled(option: HTMLElement): boolean {
    return option.getAttribute("aria-disabled") === "true";
  }

  /**
   * The next (delta=1) or previous (delta=-1) non-disabled option, wrapping. Returns null when there
   * is no non-disabled option. When `current` is null/absent, returns the first (delta>0) or last
   * (delta<0) enabled option.
   */
  private nextOption(
    options: HTMLElement[],
    current: HTMLElement | null,
    delta: 1 | -1,
  ): HTMLElement | null {
    const enabled = options.filter((o) => !this.isDisabled(o));
    if (enabled.length === 0) {
      return null;
    }
    if (current == null) {
      return delta > 0 ? enabled[0] : enabled[enabled.length - 1];
    }
    const idx = enabled.indexOf(current);
    if (idx < 0) {
      return delta > 0 ? enabled[0] : enabled[enabled.length - 1];
    }
    const next = (idx + delta + enabled.length) % enabled.length;
    return enabled[next];
  }
}
