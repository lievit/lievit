/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * `lv-menubar` -- the WAI-ARIA APG Menubar keyboard behaviour, as a Stimulus controller (the
 * conversion of the menubar's slice of `runtime/features/collection-nav.enhancer.ts`). Mounted on
 * the bar ROOT via `data-controller="lv-menubar"`; the `<nav role="menubar">` landmark, the
 * `aria-orientation`, and every top-level trigger (`role="menuitem"` + `data-lievit-item`,
 * server-rendered into the `content` slot) are HTML the server emitted -- this controller ONLY
 * drives the horizontal roving-tabindex keyboard model across those triggers.
 *
 * UNCONTROLLED by construction (REFORGE tier doctrine): the bar carries no server-owned open state
 * and never round-trips the wire. Each top-level trigger is an ordinary dropdown-menu whose
 * open/close is browser-owned (native popover API). So this controller extends the plain Stimulus
 * {@link Controller} (NOT {@link DismissableController}) and there is no `data-lv-wire-close`,
 * no select-action, no escape-action: zero `/lievit/<id>/call`.
 *
 * It reads the established collection contract attributes the menubar already emits rather than
 * inventing Stimulus values (the §3 "keep the established data-* contract" rule, the collection
 * analogue of keeping `data-lv-opener` for the overlay family):
 * - root `data-lievit-collection-orientation` -- `"horizontal"` for a menubar (the navigation axis)
 * - root `data-lievit-collection-wrap="true"`  -- Right wraps last->first, Left wraps first->last
 * - each item `data-lievit-item`               -- a top-level trigger in the roving order
 * - item `aria-disabled="true"` / `disabled`   -- skipped during navigation
 * - item `aria-haspopup="menu"`                -- a submenu parent; ArrowDown opens its submenu
 *
 * Roving-tabindex model (APG Tabs/Menubar): the focused trigger holds `tabindex="0"`, every other
 * holds `tabindex="-1"`; the server renders the first trigger as the `tabindex="0"` seed and this
 * controller moves the seed as focus roves. Keyboard:
 *   ArrowRight  next trigger (wraps)        ArrowLeft  previous trigger (wraps)
 *   Home        first trigger               End        last trigger
 *   typeahead   focus the trigger whose label starts with the typed char(s) (500 ms buffer, cycles)
 *   ArrowDown   on an `aria-haspopup="menu"` trigger: dispatch `lv:collection-submenu-open` (the
 *               dropdown-menu owns opening its own panel) -- the APG Menubar "Down opens submenu".
 *   Tab/Shift+Tab exit the bar (non-modal: no focus trap, nothing to do here).
 *
 * Morph-safety: the single keydown listener is bound in `connect()` on the bar root and torn down
 * in `disconnect()`; Stimulus connects this controller exactly once per element+identifier and
 * disconnects it when a wire morph drops the bar. No `data-lievit-rt-collection-active` marker, no
 * `afterCall` deactivation sweep -- Stimulus owns the lifecycle. The legacy collection-nav enhancer
 * SKIPS a root carrying `data-controller~="lv-menubar"` (its migration guard) so the keydown is
 * never double-handled while both paths coexist during the fan-out.
 *
 * APG source: https://www.w3.org/WAI/ARIA/apg/patterns/menubar/
 */

import { Controller } from "@hotwired/stimulus";

const ITEM_ATTR = "data-lievit-item";
const ORIENTATION_ATTR = "data-lievit-collection-orientation";
const WRAP_ATTR = "data-lievit-collection-wrap";

/** Typeahead reset delay in ms (matches the legacy collection-nav enhancer). */
const TYPEAHEAD_DELAY_MS = 500;

/**
 * CustomEvent dispatched on a top-level trigger when ArrowDown opens its submenu. Bubbles +
 * cancelable so the owning dropdown-menu (or a coordinator) can open the child panel. The name +
 * shape are kept identical to the legacy enhancer for behaviour parity.
 */
const SUBMENU_OPEN_EVENT = "lv:collection-submenu-open";

export default class LvMenubarController extends Controller<HTMLElement> {
  private typeaheadBuffer = "";
  private typeaheadTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly keyHandler = (e: KeyboardEvent): void => this.onKeydown(e);

  connect(): void {
    // Bar-root keydown (bubbles up from the focused trigger): the controller element's own event,
    // bound here per the convention. Stimulus removes it in disconnect() across every morph.
    this.element.addEventListener("keydown", this.keyHandler);
  }

  disconnect(): void {
    this.element.removeEventListener("keydown", this.keyHandler);
    if (this.typeaheadTimer != null) {
      clearTimeout(this.typeaheadTimer);
      this.typeaheadTimer = null;
    }
    this.typeaheadBuffer = "";
  }

  private onKeydown(e: KeyboardEvent): void {
    const orientation = this.element.getAttribute(ORIENTATION_ATTR) ?? "vertical";
    const isHorizontal = orientation === "horizontal" || orientation === "both";
    const isVertical = orientation === "vertical" || orientation === "both";
    const wrap = this.element.getAttribute(WRAP_ATTR) === "true";

    const items = this.items();
    const focused = this.focusedItem(items);

    const isNextKey = (e.key === "ArrowRight" && isHorizontal) || (e.key === "ArrowDown" && isVertical);
    const isPrevKey = (e.key === "ArrowLeft" && isHorizontal) || (e.key === "ArrowUp" && isVertical);

    let handled = false;

    if (isNextKey || isPrevKey) {
      this.moveFocus(items, this.nextItem(items, focused, isNextKey ? 1 : -1, wrap));
      handled = true;
    } else if (e.key === "Home") {
      this.moveFocus(items, this.enabled(items)[0] ?? null);
      handled = true;
    } else if (e.key === "End") {
      const enabled = this.enabled(items);
      this.moveFocus(items, enabled[enabled.length - 1] ?? null);
      handled = true;
    } else if (e.key === "ArrowDown" && isHorizontal) {
      // APG Menubar: Down opens the focused trigger's submenu. Only a submenu parent
      // (aria-haspopup="menu") consumes the key; otherwise it falls through untouched.
      if (focused != null && focused.getAttribute("aria-haspopup") === "menu") {
        focused.dispatchEvent(new CustomEvent(SUBMENU_OPEN_EVENT, { bubbles: true, cancelable: true }));
        handled = true;
      }
    } else if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
      this.typeahead(e.key, items, focused);
      handled = true;
    }

    if (handled) {
      e.preventDefault();
    }
  }

  // --- roving-tabindex helpers -----------------------------------------------------------------

  private items(): HTMLElement[] {
    return Array.from(this.element.querySelectorAll<HTMLElement>(`[${ITEM_ATTR}]`));
  }

  private enabled(items: HTMLElement[]): HTMLElement[] {
    return items.filter((i) => !this.isDisabled(i));
  }

  private isDisabled(item: HTMLElement): boolean {
    return item.getAttribute("aria-disabled") === "true" || item.hasAttribute("disabled");
  }

  /** The roving seed: the item that currently holds `tabindex="0"` (server-rendered or last moved). */
  private focusedItem(items: HTMLElement[]): HTMLElement | null {
    return items.find((i) => i.tabIndex === 0) ?? null;
  }

  private nextItem(
    items: HTMLElement[],
    current: HTMLElement | null,
    delta: 1 | -1,
    wrap: boolean,
  ): HTMLElement | null {
    const enabled = this.enabled(items);
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

  /** Move DOM focus to `target` and update the roving tabindex (focused=0, the rest=-1). No-op if null. */
  private moveFocus(items: HTMLElement[], target: HTMLElement | null): void {
    if (target == null) {
      return;
    }
    for (const item of items) {
      item.tabIndex = item === target ? 0 : -1;
    }
    target.focus();
  }

  // --- typeahead -------------------------------------------------------------------------------

  /**
   * Type-to-focus: accumulate printable chars into a buffer (reset after {@link TYPEAHEAD_DELAY_MS});
   * focus the first enabled trigger AFTER the current one whose label starts with the buffer (wrap).
   * Repeated presses of the same char cycle through same-initial triggers (the common APG idiom).
   */
  private typeahead(char: string, items: HTMLElement[], current: HTMLElement | null): void {
    if (this.typeaheadTimer != null) {
      clearTimeout(this.typeaheadTimer);
    }
    const lc = char.toLowerCase();
    const repeated =
      this.typeaheadBuffer.length > 0 && this.typeaheadBuffer.split("").every((c) => c === lc);
    this.typeaheadBuffer = repeated ? lc : this.typeaheadBuffer + lc;
    const buffer = this.typeaheadBuffer;

    const enabled = this.enabled(items);
    const startIdx = current != null ? enabled.indexOf(current) : -1;
    const reordered = [...enabled.slice(startIdx + 1), ...enabled.slice(0, startIdx + 1)];
    const match = reordered.find((i) => (i.textContent ?? "").trim().toLowerCase().startsWith(buffer));
    if (match != null) {
      this.moveFocus(items, match);
    }

    this.typeaheadTimer = setTimeout(() => {
      this.typeaheadBuffer = "";
      this.typeaheadTimer = null;
    }, TYPEAHEAD_DELAY_MS);
  }
}
