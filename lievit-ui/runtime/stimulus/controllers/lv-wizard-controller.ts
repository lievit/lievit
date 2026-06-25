/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * `lv-wizard` -- the skippable multi-step stepper's keyboard behaviour, as a Stimulus controller
 * (the conversion of the wizard's slice of `runtime/features/collection-nav.enhancer.ts`). Mounted on
 * the step-list ROOT (`<ol data-slot="wizard-step-list">`) via `data-controller="lv-wizard"`; the
 * `<ol role="list">`, every reachable step `<button data-lievit-item l:click="goTo">`, the
 * `aria-current="step"`, the `tabindex="0"` seed on the current step and the `aria-disabled`
 * unreachable steps are all server-rendered HTML -- this controller ONLY drives the
 * roving-tabindex keyboard model across the reachable step buttons (skippable mode only).
 *
 * The wizard is CONTROLLED by construction (the wizard doctrine: the active step is a server fact
 * owned by the caller's `@Wire int activeStep`; there is no native element that owns multi-step
 * state the way a popover owns open/close, so uncontrolled is not meaningful here). Activation
 * therefore always rides the wire, via the single CSP-clean seam {@link callWire} -- never
 * `runtime.callAction` directly. {@link callWire} is a no-op when the select action is blank or no
 * runtime is published, so the controlled/uncontrolled doctrine holds by construction (an absent
 * select action -> zero `/lievit/<id>/call`). The controller is a plain {@link Controller} (no
 * dismiss, no focus-trap), so it touches none of the shared base classes.
 *
 * It reads the established collection contract attributes the wizard already emits in skippable
 * mode (the convention's "keep the established data-* contract" rule, the collection analogue of
 * keeping `data-lv-opener` for the overlay family) rather than inventing Stimulus values:
 * - root `data-lievit-collection-orientation` -- `"horizontal"` | `"vertical"` (the navigation axis)
 * - root `data-lievit-collection-wrap="true"` -- Arrow wraps last->first / first->last at the ends
 * - root `data-lievit-collection-select-action` -- the wire action fired on Enter / Space (`goTo`)
 * - each reachable step `data-lievit-item` -- a step in the roving order
 * - item `aria-disabled="true"` / `disabled` -- skipped during navigation (defence in depth: the
 *   template already withholds `data-lievit-item` from unreachable steps)
 *
 * Roving-tabindex + manual-activation model (APG Tabs, the wizard runs `data-manual-activation`):
 *   ArrowRight/ArrowDown  next step (per orientation; wraps)
 *   ArrowLeft/ArrowUp     previous step (wraps)
 *   Home / End            first / last reachable step
 *   typeahead             focus the step whose label starts with the typed char(s) (500 ms buffer)
 *   Enter / Space         fire the select action (`goTo`) on the focused step -- MANUAL activation:
 *                         Arrow keys MOVE focus only, they never navigate; the user commits with
 *                         Enter / Space. (The step button also carries `l:click="goTo"` for the
 *                         mouse path; `goTo(n)` is idempotent so the redundant native activation is
 *                         harmless.)
 * The focused step holds `tabindex="0"`, every other holds `tabindex="-1"`; the server renders the
 * current step as the `tabindex="0"` seed and this controller moves the seed as focus roves.
 *
 * Why the wizard needs NO collection-nav skip-guard (unlike the overlay-family / menubar guards in
 * convention sec.7): the skippable step-list no longer carries the bare `data-lievit-collection`
 * ACTIVATOR attribute -- only the `data-lievit-collection-*` CONFIG attributes remain (an attribute
 * selector `[data-lievit-collection]` and `hasAttribute("data-lievit-collection")` both match the
 * exact name only, NOT `-orientation`/`-wrap`/...). So the shared collection-nav enhancer never
 * scans this root and there is no coexistence to guard: the keystroke is handled exactly once, by
 * this controller, with no edit to the shared enhancer.
 *
 * Morph-safety: the single keydown listener is declared in the template as
 * `data-action="keydown->lv-wizard#onKeydown"`, so Stimulus binds it on connect and re-binds it
 * automatically when a wire morph re-renders the step-list -- no `data-*-enhanced` marker, no
 * `afterCall` deactivation sweep, no stacked listeners. Only the typeahead timer is controller-owned
 * state, cleared in {@link disconnect}.
 *
 * APG source: https://www.w3.org/WAI/ARIA/apg/patterns/tabs/ (roving-tabindex, manual activation).
 */

import { Controller } from "@hotwired/stimulus";
import { callWire } from "../bridge.js";

const ITEM_ATTR = "data-lievit-item";
const ORIENTATION_ATTR = "data-lievit-collection-orientation";
const WRAP_ATTR = "data-lievit-collection-wrap";
const SELECT_ACTION_ATTR = "data-lievit-collection-select-action";

/** Typeahead reset delay in ms (matches the legacy collection-nav enhancer). */
const TYPEAHEAD_DELAY_MS = 500;

function isDisabled(item: Element): boolean {
  return item.getAttribute("aria-disabled") === "true" || item.hasAttribute("disabled");
}

/**
 * The next enabled item in `items` from `current` by `delta`, honouring `wrap`. With `current` null,
 * returns the first (delta>0) or last (delta<0) enabled item. Returns null when no item is enabled.
 */
function nextItem<T extends Element>(
  items: T[],
  current: T | null,
  delta: 1 | -1,
  wrap: boolean,
): T | null {
  const enabled = items.filter((i) => !isDisabled(i));
  if (enabled.length === 0) {
    return null;
  }
  if (current == null) {
    return delta > 0 ? enabled[0]! : enabled[enabled.length - 1]!;
  }
  const idx = enabled.indexOf(current);
  if (idx < 0) {
    return delta > 0 ? enabled[0]! : enabled[enabled.length - 1]!;
  }
  const next = idx + delta;
  if (next < 0) {
    return wrap ? enabled[enabled.length - 1]! : enabled[0]!;
  }
  if (next >= enabled.length) {
    return wrap ? enabled[0]! : enabled[enabled.length - 1]!;
  }
  return enabled[next]!;
}

export default class LvWizardController extends Controller<HTMLElement> {
  /** Accumulated type-to-focus buffer; reset after {@link TYPEAHEAD_DELAY_MS} of inactivity. */
  private typeaheadBuffer = "";
  private typeaheadTimer: ReturnType<typeof setTimeout> | null = null;

  disconnect(): void {
    // The keydown listener is declared via data-action, so Stimulus removes it for us; only the
    // typeahead timer is controller-owned state that must be cleared on morph-out.
    if (this.typeaheadTimer != null) {
      clearTimeout(this.typeaheadTimer);
      this.typeaheadTimer = null;
    }
    this.typeaheadBuffer = "";
  }

  /**
   * The single keydown entry point (bound from the template as
   * `data-action="keydown->lv-wizard#onKeydown"`, listening on the step-list root where keydown
   * bubbles up from the focused step button). Implements the APG Tabs roving-tabindex model with
   * manual activation: Arrow / Home / End / typeahead move real DOM focus and the `tabindex="0"`
   * seed; Enter / Space commit the focused step over the wire (`goTo`).
   */
  onKeydown(e: KeyboardEvent): void {
    const orientation = this.element.getAttribute(ORIENTATION_ATTR) ?? "vertical";
    const wrap = this.element.getAttribute(WRAP_ATTR) === "true";
    const selectAction = this.element.getAttribute(SELECT_ACTION_ATTR);

    const isVertical = orientation === "vertical" || orientation === "both";
    const isHorizontal = orientation === "horizontal" || orientation === "both";

    const items = this.items();
    const focused = this.focusedItem(items);

    const isNextKey = (e.key === "ArrowDown" && isVertical) || (e.key === "ArrowRight" && isHorizontal);
    const isPrevKey = (e.key === "ArrowUp" && isVertical) || (e.key === "ArrowLeft" && isHorizontal);

    let handled = false;

    if (isNextKey || isPrevKey) {
      // Manual activation: Arrow keys move focus + the roving seed ONLY; they never fire `goTo`.
      this.moveFocus(items, nextItem(items, focused, isNextKey ? 1 : -1, wrap));
      handled = true;
    } else if (e.key === "Home") {
      this.moveFocus(items, this.enabled(items)[0] ?? null);
      handled = true;
    } else if (e.key === "End") {
      const enabled = this.enabled(items);
      this.moveFocus(items, enabled[enabled.length - 1] ?? null);
      handled = true;
    } else if (e.key === "Enter" || e.key === " ") {
      // Manual activation: commit the focused step over the wire. callWire is a no-op when
      // selectAction is blank / no runtime -> uncontrolled-safe by construction. preventDefault
      // stops Space scrolling (and suppresses the focused button's native Enter activation; the
      // redundant `l:click` mouse path fires the same idempotent `goTo`).
      if (focused != null && !isDisabled(focused)) {
        callWire(focused, selectAction, { trigger: focused });
      }
      handled = true;
    } else if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
      this.typeahead(e.key, focused, (match) => this.moveFocus(items, match));
      handled = true;
    }

    if (handled) {
      e.preventDefault();
    }
  }

  /** The step items the server marked with `data-lievit-item`, in document order. */
  private items(): HTMLElement[] {
    return Array.from(this.element.querySelectorAll<HTMLElement>(`[${ITEM_ATTR}]`));
  }

  /** The reachable (non-`aria-disabled`) step items. */
  private enabled(items: HTMLElement[]): HTMLElement[] {
    return items.filter((i) => !isDisabled(i));
  }

  /** The step that currently holds the roving seed (`tabindex="0"`), or null before any Arrow. */
  private focusedItem(items: HTMLElement[]): HTMLElement | null {
    return items.find((i) => i.tabIndex === 0) ?? null;
  }

  /**
   * Move the roving seed + real DOM focus to `target` (no-op when null): the target gets
   * `tabindex="0"`, every other item gets `tabindex="-1"`, then `target.focus()`.
   */
  private moveFocus(items: HTMLElement[], target: HTMLElement | null): void {
    if (target == null) {
      return;
    }
    for (const item of items) {
      item.tabIndex = item === target ? 0 : -1;
    }
    target.focus();
  }

  /**
   * Type-to-focus across the reachable steps (APG typeahead). Repeated presses of the same
   * character cycle through steps starting with it; a different character extends the buffer.
   * `onMatch` applies the selection (here: {@link moveFocus}, which also rolls the roving seed).
   */
  private typeahead(char: string, current: HTMLElement | null, onMatch: (item: HTMLElement) => void): void {
    if (this.typeaheadTimer != null) {
      clearTimeout(this.typeaheadTimer);
    }

    const lc = char.toLowerCase();
    const repeated =
      this.typeaheadBuffer.length > 0 && this.typeaheadBuffer.split("").every((c) => c === lc);
    this.typeaheadBuffer = repeated ? lc : this.typeaheadBuffer + lc;
    const buffer = this.typeaheadBuffer;

    const items = this.enabled(this.items());
    const startIdx = current != null ? items.indexOf(current) : -1;
    // Search from the item AFTER the current one, wrapping around the list.
    const reordered = [...items.slice(startIdx + 1), ...items.slice(0, startIdx + 1)];
    const match = reordered.find((i) => (i.textContent ?? "").trim().toLowerCase().startsWith(buffer));
    if (match != null) {
      onMatch(match);
    }

    this.typeaheadTimer = setTimeout(() => {
      this.typeaheadBuffer = "";
      this.typeaheadTimer = null;
    }, TYPEAHEAD_DELAY_MS);
  }
}
