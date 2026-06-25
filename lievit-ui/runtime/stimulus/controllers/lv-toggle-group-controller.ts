/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * `lv-toggle-group` -- the Radix ToggleGroup / RovingFocusGroup client keyboard model, as a Stimulus
 * controller. Mounted on the toggle-group ROOT via `data-controller="lv-toggle-group"`. There was no
 * prior enhancer (the `toggle-group.jte` wire template shipped server-only, relying on native Tab); a
 * `role="radiogroup"` whose items are `role="radio"` (single mode) MANDATES the roving model per
 * WAI-ARIA, and the template already cites Radix ToggleGroup as its a11y source, so this controller
 * supplies the one irreducible client bit the server cannot: a SINGLE tab stop into the group with
 * Arrow/Home/End focus movement among the enabled items.
 *
 * What it owns (focus only -- selection stays server-owned):
 * - **roving tabindex**: exactly one item is `tabindex="0"` (the selected item, else the focused one,
 *   else the first enabled); every other enabled item is `tabindex="-1"`. So the group is one Tab
 *   stop and Tab moves PAST it, not button-by-button (the radiogroup/toolbar contract).
 * - **Arrow/Home/End**: ArrowRight/ArrowDown -> next enabled (wraps), ArrowLeft/ArrowUp -> prev
 *   enabled (wraps), Home -> first, End -> last; disabled items are skipped. Focus moves; the moved-to
 *   item becomes the single tab stop. No selection-follows-focus (Radix ToggleGroup allows the empty
 *   set; selection happens on click / native Enter+Space, which the existing `l:click` already wires).
 *
 * UNCONTROLLED by construction: a toggle-group never DISMISSES and this controller NEVER round-trips
 * the wire -- it is pure client focus, so it is a plain {@link Controller} (no DismissableController,
 * no `data-lv-wire-close`, no `callWire`). The controlled/uncontrolled doctrine is satisfied trivially:
 * zero `/lievit/<id>/call` ever originates here. Selection's server round-trip remains the template's
 * `l:click="$set('toggleValue', ...)"`, untouched by the migration.
 *
 * Morph-safety: the keydown is declared as `data-action` on the root, so Stimulus re-binds it for free
 * after the lievit wire morph + idiomorph + Turbo Drive. The roving `tabindex` attributes ARE NOT a
 * `data-lievit-rt-*` client marker, so idiomorph strips them when it reconciles the buttons toward the
 * server re-render (which carries no tabindex); the same re-render also flips `aria-checked`/
 * `aria-pressed`, so a `connect()`-bound MutationObserver (watching childList + the aria-state/disabled
 * attributes, NEVER `tabindex` -- that would feed back on its own writes) re-establishes the roving
 * stop after every morph. There is no `WeakSet`/`data-*-enhanced` bookkeeping: Stimulus owns
 * connect/disconnect and tears the observer down in `disconnect()`.
 *
 * a11y sources:
 *   Radix ToggleGroup (RovingFocusGroup) -- https://www.radix-ui.com/primitives/docs/components/toggle-group
 *   WAI-ARIA APG Radio Group / Toolbar -- https://www.w3.org/WAI/ARIA/apg/patterns/radio/
 */

import { Controller } from "@hotwired/stimulus";

/** The selector the server stamps on every item button (also exposed as the `item` Stimulus target). */
const ITEM_SELECTOR = "[data-lv-toggle-group-target='item']";

/** Keys this controller claims; anything else passes through to the platform. */
const NAV_KEYS = new Set(["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp", "Home", "End"]);

/** Aria/disabled attributes whose server-driven change must re-derive the roving stop (NOT tabindex). */
const ROVING_RELEVANT_ATTRS = ["aria-checked", "aria-pressed", "disabled", "aria-disabled"];

export default class LvToggleGroupController extends Controller<HTMLElement> {
  static targets = ["item"];

  declare readonly hasItemTarget: boolean;
  declare readonly itemTargets: HTMLButtonElement[];

  /**
   * Re-derives the roving tab stop after a wire morph strips the JS-set `tabindex` (idiomorph drops
   * any attribute the server render omits). Watches the aria-state/childList the same morph mutates,
   * never `tabindex`, so this controller never reacts to its own writes (no feedback loop).
   */
  private observer: MutationObserver | null = null;

  connect(): void {
    this.observer = new MutationObserver(() => this.refreshRoving());
    this.observer.observe(this.element, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ROVING_RELEVANT_ATTRS,
    });
    this.refreshRoving();
  }

  disconnect(): void {
    this.observer?.disconnect();
    this.observer = null;
  }

  /** Roving focus move on Arrow/Home/End; a no-op for any other key (it reaches the platform). */
  onKeydown(event: KeyboardEvent): void {
    if (!NAV_KEYS.has(event.key)) {
      return;
    }
    const enabled = this.enabledItems();
    if (enabled.length === 0) {
      return;
    }

    const current = (event.target as Element | null)?.closest<HTMLButtonElement>(ITEM_SELECTOR);
    const here = current != null ? enabled.indexOf(current) : -1;

    let target: HTMLButtonElement;
    if (event.key === "Home") {
      target = enabled[0]!;
    } else if (event.key === "End") {
      target = enabled[enabled.length - 1]!;
    } else {
      const forward = event.key === "ArrowRight" || event.key === "ArrowDown";
      const base = here >= 0 ? here : 0;
      const n = enabled.length;
      target = enabled[(base + (forward ? 1 : -1) + n) % n]!;
    }

    // Claim the key so the page does not also scroll / move the caret, then move focus + the stop.
    event.preventDefault();
    this.setRovingStop(target);
    target.focus();
  }

  /** The enabled (focusable) item buttons, in DOM order. Disabled items are skipped from navigation. */
  private enabledItems(): HTMLButtonElement[] {
    return this.items().filter((el) => this.isEnabled(el));
  }

  /** All item buttons: the Stimulus targets when present, else a query fallback (defensive). */
  private items(): HTMLButtonElement[] {
    if (this.hasItemTarget) {
      return this.itemTargets;
    }
    return Array.from(this.element.querySelectorAll<HTMLButtonElement>(ITEM_SELECTOR));
  }

  private isEnabled(el: HTMLButtonElement): boolean {
    return !el.hasAttribute("disabled") && el.getAttribute("aria-disabled") !== "true";
  }

  private isSelected(el: HTMLButtonElement): boolean {
    return el.getAttribute("aria-checked") === "true" || el.getAttribute("aria-pressed") === "true";
  }

  /**
   * Establishes the single tab stop: `el` becomes `tabindex="0"`, every other enabled item
   * `tabindex="-1"`. Writes only on a real change so the (tabindex-excluded) observer never loops,
   * and so an unchanged morph produces no attribute churn.
   */
  private setRovingStop(stop: HTMLButtonElement): void {
    for (const el of this.enabledItems()) {
      const want = el === stop ? "0" : "-1";
      if (el.getAttribute("tabindex") !== want) {
        el.setAttribute("tabindex", want);
      }
    }
  }

  /**
   * Picks the roving stop from current truth and applies it. Priority: the item that already holds
   * focus (preserve it across a morph) > the selected item (first selected in multiple mode) > the
   * first enabled item. Called on connect and after every morph the observer sees.
   */
  private refreshRoving(): void {
    const enabled = this.enabledItems();
    if (enabled.length === 0) {
      return;
    }
    const focused = enabled.find((el) => el === document.activeElement);
    const stop = focused ?? enabled.find((el) => this.isSelected(el)) ?? enabled[0]!;
    this.setRovingStop(stop);
  }
}
