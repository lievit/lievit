/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * `lv-navigation-menu` -- the WAI-ARIA APG **Disclosure Navigation** keyboard supplement, as a
 * Stimulus controller (the conversion of the `nav` mode of `runtime/features/collection-nav.enhancer.ts`
 * for the navigation-menu component). Mounted on the `<nav>` landmark via
 * `data-controller="lv-navigation-menu"`; the keydown is bound declaratively from the template with
 * `data-action="keydown->lv-navigation-menu#onKeydown"` (CSP-clean, re-bound by Stimulus across the
 * wire morph).
 *
 * Disclosure-Navigation model (https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/examples/disclosure-navigation/):
 * Tab is the PRIMARY navigation; arrow keys are a SUPPLEMENTAL aid. So:
 * - Arrow keys (orientation-aware) call `element.focus()` on the next/prev enabled item.
 * - `tabindex` is NEVER mutated (every item stays `tabindex="0"`) -- this is NOT the roving-tabindex
 *   (Tabs) model and NOT the aria-activedescendant (Listbox/Menu) model; the controller writes
 *   neither `tabindex="-1"` nor `aria-activedescendant`.
 * - Home / End focus the first / last enabled item; printable keys type-to-focus (typeahead).
 * - Escape fires the collection's `data-lievit-collection-escape-action` on the wire ONLY when one
 *   is declared (navigation-menu declares none, so Escape is a client-side no-op here; the native
 *   `[popover]` panels close on Esc themselves). The wire seam is {@link callWire}: blank action =>
 *   no round-trip, honouring the controlled/uncontrolled doctrine.
 *
 * Item / config contract (the established `data-lievit-collection*` attributes the server already
 * renders; the controller reads them, it never invents data):
 * - items: every `[data-lievit-item]` descendant (top-level leaf `<a>` + disclosure `<button>`).
 * - disabled item: `aria-disabled="true"` or a native `disabled` attribute -- skipped in traversal.
 * - `data-lievit-collection-orientation`: `"vertical"` | `"horizontal"` | `"both"` (default vertical).
 * - `data-lievit-collection-wrap="true"`: wrap at the ends.
 * - `data-lievit-collection-escape-action`: optional wire action fired on Escape.
 *
 * Morph-safety: the keydown action is declared in the template, so Stimulus re-binds it whenever the
 * morph re-renders the `<nav>`, and the typeahead timer is cleared in `disconnect()`. No
 * `data-lievit-rt-collection-active` marker, no `afterCall` deactivate sweep, no `Map` of active
 * roots -- Stimulus owns connect/disconnect. The old shared enhancer still serves the OTHER
 * collection modes (Listbox / Menu / Tabs); it skips this instance via the
 * `data-controller~="lv-navigation-menu"` guard, so the two paths never double-handle a keystroke.
 */

import { Controller } from "@hotwired/stimulus";
import { callWire } from "../bridge.js";

const ITEM_ATTR = "data-lievit-item";
const ORIENTATION_ATTR = "data-lievit-collection-orientation";
const WRAP_ATTR = "data-lievit-collection-wrap";
const ESCAPE_ACTION_ATTR = "data-lievit-collection-escape-action";

/** Typeahead reset delay in ms (APG-standard). */
const TYPEAHEAD_DELAY_MS = 500;

function isDisabled(item: Element): boolean {
  return item.getAttribute("aria-disabled") === "true" || item.hasAttribute("disabled");
}

/**
 * The next enabled item in `items` from `current` by `delta`, honouring `wrap`. With `current` null,
 * returns the first (delta>0) or last (delta<0) enabled item. Returns null when no item is enabled.
 */
function nextItem(
  items: Element[],
  current: Element | null,
  delta: 1 | -1,
  wrap: boolean,
): Element | null {
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

export default class LvNavigationMenuController extends Controller<HTMLElement> {
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
   * `data-action="keydown->lv-navigation-menu#onKeydown"`). Implements the APG Disclosure Navigation
   * supplemental keyboard pattern: arrow/Home/End/typeahead move real DOM focus, Escape fires the
   * optional escape action; `tabindex` and `aria-activedescendant` are never touched.
   */
  onKeydown(e: KeyboardEvent): void {
    const orientation = this.element.getAttribute(ORIENTATION_ATTR) ?? "vertical";
    const wrap = this.element.getAttribute(WRAP_ATTR) === "true";
    const escapeAction = this.element.getAttribute(ESCAPE_ACTION_ATTR);

    const isVertical = orientation === "vertical" || orientation === "both";
    const isHorizontal = orientation === "horizontal" || orientation === "both";

    const items = this.items();
    const currentFocused = items.find((i) => i === document.activeElement) ?? null;

    const isNextKey = (e.key === "ArrowDown" && isVertical) || (e.key === "ArrowRight" && isHorizontal);
    const isPrevKey = (e.key === "ArrowUp" && isVertical) || (e.key === "ArrowLeft" && isHorizontal);

    let handled = false;

    if (isNextKey || isPrevKey) {
      const target = nextItem(items, currentFocused, isNextKey ? 1 : -1, wrap);
      if (target != null) {
        (target as HTMLElement).focus();
      }
      handled = true;
    } else if (e.key === "Home") {
      const enabled = items.filter((i) => !isDisabled(i));
      if (enabled.length > 0) {
        (enabled[0] as HTMLElement).focus();
      }
      handled = true;
    } else if (e.key === "End") {
      const enabled = items.filter((i) => !isDisabled(i));
      if (enabled.length > 0) {
        (enabled[enabled.length - 1] as HTMLElement).focus();
      }
      handled = true;
    } else if (e.key === "Escape") {
      // Controlled/uncontrolled doctrine via the bridge: callWire is a no-op when escapeAction is
      // blank, so an uncontrolled nav (navigation-menu) never round-trips on Escape.
      callWire(this.element, escapeAction, { trigger: this.element });
      handled = true;
    } else if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
      this.typeahead(e.key, currentFocused, (match) => (match as HTMLElement).focus());
      handled = true;
    }

    if (handled) {
      e.preventDefault();
    }
  }

  /** The collection items the server marked with `data-lievit-item`, in document order. */
  private items(): Element[] {
    return Array.from(this.element.querySelectorAll<Element>(`[${ITEM_ATTR}]`));
  }

  /**
   * Type-to-focus across the enabled items (APG typeahead). Repeated presses of the same character
   * cycle through items starting with it; a different character extends the buffer. `onMatch` applies
   * the mode's selection (here: `element.focus()`, leaving tabindex untouched).
   */
  private typeahead(char: string, currentItem: Element | null, onMatch: (item: Element) => void): void {
    if (this.typeaheadTimer != null) {
      clearTimeout(this.typeaheadTimer);
    }

    const lc = char.toLowerCase();
    const repeated =
      this.typeaheadBuffer.length > 0 && this.typeaheadBuffer.split("").every((c) => c === lc);
    this.typeaheadBuffer = repeated ? lc : this.typeaheadBuffer + lc;
    const buffer = this.typeaheadBuffer;

    const items = this.items().filter((i) => !isDisabled(i));
    const startIdx = currentItem != null ? items.indexOf(currentItem) : -1;
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
