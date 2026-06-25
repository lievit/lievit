/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * `lv-tabs` -- the WAI-ARIA APG Tabs roving-tabindex keyboard model, as a Stimulus controller
 * (the conversion of the tabs SLICE of `runtime/features/collection-nav.enhancer.ts`). Mounted on
 * the `role="tablist"` strip via `data-controller="lv-tabs"`. The tablist, the real
 * `<button role="tab">` triggers, the panels, `aria-selected`, the server-stamped roving
 * `tabindex`, and `l:click` (mouse activation, owned by the lievit wire runtime) are all
 * server-rendered HTML; this controller ONLY owns the keyboard interaction the APG Tabs pattern
 * requires:
 *
 * - Arrow keys move DOM focus between tabs (roving tabindex: the focused tab gets `tabindex="0"`,
 *   every other tab `tabindex="-1"`). Horizontal tablist -> Left/Right; vertical -> Up/Down (the
 *   cross-axis arrow is a no-op, per APG).
 * - Home / End jump to the first / last enabled tab.
 * - Wrap at the ends when the tablist opts in (`data-lievit-collection-wrap="true"`).
 * - Disabled tabs (`aria-disabled="true"`, NEVER native `disabled` -- a disabled tab must stay in
 *   the roving order per APG) are skipped during navigation.
 * - Activation mode (APG): AUTOMATIC (default) fires the select action immediately on focus move;
 *   MANUAL (`data-manual-activation="true"`) moves focus only, and Enter / Space fire the action on
 *   the focused tab. Enter / Space are always `preventDefault`-ed so Space never scrolls the page.
 *
 * Controlled / uncontrolled doctrine (the same gate as every converted surface, expressed here for
 * a NON-close action): the select action rides the wire through the single {@link callWire} seam,
 * which is a NO-OP when the action name is blank. The template stamps the action name ONLY when the
 * caller wired one (`data-lievit-collection-select-action`), so an UNCONTROLLED tablist (no action)
 * navigates focus purely client-side with ZERO `/lievit/<id>/call`. There is NO hardcoded fallback
 * action -- a spurious activate on an uncontrolled host would 410 page-expired, the bug the doctrine
 * exists to prevent.
 *
 * Why this is a self-contained slice and not the whole enhancer: `collection-nav.enhancer.ts` is a
 * THREE-mode multi-component engine (aria-activedescendant for listbox/menu, roving-tabindex for
 * tabs, nav mode for disclosure-navigation) still owned by the unconverted components. Tabs only
 * ever used the roving-tabindex branch, so the conversion lifts exactly that branch into this
 * controller; the enhancer keeps serving the others and SKIPS a tablist that carries
 * `data-controller~="lv-tabs"` (the migration guard added to the enhancer, mirroring
 * `popover-anchor.enhancer.ts`), so the two never double-handle a tablist while both coexist.
 *
 * Notably NOT carried over (deliberately): typeahead and the submenu Arrow events. Both are
 * collection-nav features for the menu/listbox families; the tabs key map (template doc-comment +
 * the APG Tabs pattern) is Arrow / Home / End / Enter / Space only, and the tabs suite never
 * asserted typeahead. Adding them here would import menu behaviour tabs never advertised.
 *
 * Morph-safety: the keydown listener is bound in `connect()` on the tablist root and Stimulus
 * removes the whole controller (and so the listener) on `disconnect()` when a wire morph drops or
 * replaces the strip. No `data-*-enhanced` marker, no `afterCall` deactivate sweep, no
 * `WeakSet`-of-wired-roots -- Stimulus owns connect/disconnect, which is the whole point of the
 * migration. The element-bubbled keydown is bound in `connect()` (not `data-action`) to mirror the
 * enhancer's root listener and to stay robust in the happy-dom test substrate.
 *
 * a11y source: WAI-ARIA APG Tabs (roving-tabindex) https://www.w3.org/WAI/ARIA/apg/patterns/tabs/.
 */

import { Controller } from "@hotwired/stimulus";
import { callWire } from "../bridge.js";

/** Established lievit attribute that marks a tab (a roving-collection item). Reused, not renamed. */
const ITEM_ATTR = "data-lievit-item";
/** Established attribute the template stamps with the orientation ("horizontal" | "vertical"). */
const ORIENTATION_ATTR = "data-lievit-collection-orientation";
/** Established attribute: "true" wraps focus at the ends (APG Tabs default for this template). */
const WRAP_ATTR = "data-lievit-collection-wrap";
/** Established attribute naming the wire action fired on activation; blank/absent => uncontrolled. */
const SELECT_ACTION_ATTR = "data-lievit-collection-select-action";
/** Established attribute: "true" => manual activation (Arrow = focus only; Enter/Space = activate). */
const MANUAL_ACTIVATION_ATTR = "data-manual-activation";

export default class LvTabsController extends Controller<HTMLElement> {
  private readonly keyHandler = (e: KeyboardEvent): void => this.onKeydown(e);

  connect(): void {
    this.element.addEventListener("keydown", this.keyHandler);
  }

  disconnect(): void {
    this.element.removeEventListener("keydown", this.keyHandler);
  }

  // --- key handling ----------------------------------------------------------------------------

  private onKeydown(e: KeyboardEvent): void {
    const orientation = this.element.getAttribute(ORIENTATION_ATTR) ?? "horizontal";
    const wrap = this.element.getAttribute(WRAP_ATTR) === "true";
    const manual = this.element.getAttribute(MANUAL_ACTIVATION_ATTR) === "true";
    const selectAction = this.element.getAttribute(SELECT_ACTION_ATTR);

    const isVertical = orientation === "vertical" || orientation === "both";
    const isHorizontal = orientation === "horizontal" || orientation === "both";

    const items = this.items();
    const focused = this.focusedItem(items);

    const isNextKey =
      (e.key === "ArrowDown" && isVertical) || (e.key === "ArrowRight" && isHorizontal);
    const isPrevKey =
      (e.key === "ArrowUp" && isVertical) || (e.key === "ArrowLeft" && isHorizontal);

    let handled = false;

    if (isNextKey || isPrevKey) {
      const target = this.nextItem(items, focused, isNextKey ? 1 : -1, wrap);
      this.moveFocus(items, target);
      // Automatic activation: the Arrow key both moves focus AND activates immediately.
      if (!manual && target != null) {
        this.activate(target, selectAction);
      }
      handled = true;
    } else if (e.key === "Home") {
      const first = this.enabled(items)[0] ?? null;
      this.moveFocus(items, first);
      if (!manual && first != null) {
        this.activate(first, selectAction);
      }
      handled = true;
    } else if (e.key === "End") {
      const enabled = this.enabled(items);
      const last = enabled[enabled.length - 1] ?? null;
      this.moveFocus(items, last);
      if (!manual && last != null) {
        this.activate(last, selectAction);
      }
      handled = true;
    } else if (e.key === "Enter" || e.key === " ") {
      // Manual activation: Enter / Space activate the focused tab. In automatic mode the action
      // already fired on the Arrow key, so this is a no-op activation -- but we still consume the
      // event (preventDefault) so Space does not scroll the page.
      if (manual && focused != null && !this.isDisabled(focused)) {
        this.activate(focused, selectAction);
      }
      handled = true;
    }

    if (handled) {
      e.preventDefault();
    }
  }

  // --- roving-tabindex mechanics ---------------------------------------------------------------

  /** The tab buttons, in DOM order (the roving collection items). */
  private items(): HTMLElement[] {
    return Array.from(this.element.querySelectorAll<HTMLElement>(`[${ITEM_ATTR}]`));
  }

  /** Items that are not disabled. */
  private enabled(items: HTMLElement[]): HTMLElement[] {
    return items.filter((i) => !this.isDisabled(i));
  }

  /**
   * APG Tabs: a disabled tab carries `aria-disabled="true"` ONLY (NOT native `disabled`, which
   * would remove it from the tab order). Native `disabled` is honoured too for robustness.
   */
  private isDisabled(item: Element): boolean {
    return item.getAttribute("aria-disabled") === "true" || item.hasAttribute("disabled");
  }

  /** The item that currently holds the roving `tabindex="0"`, or null before any navigation. */
  private focusedItem(items: HTMLElement[]): HTMLElement | null {
    return items.find((i) => i.tabIndex === 0) ?? null;
  }

  /**
   * The enabled item `delta` steps from `current` (skipping disabled), wrapping at the ends when
   * `wrap` is set. With no current item, returns the first (delta>0) or last (delta<0) enabled item.
   */
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
      return delta > 0 ? enabled[0] : enabled[enabled.length - 1];
    }
    const idx = enabled.indexOf(current);
    if (idx < 0) {
      return delta > 0 ? enabled[0] : enabled[enabled.length - 1];
    }
    const next = idx + delta;
    if (next < 0) {
      return wrap ? enabled[enabled.length - 1] : enabled[0];
    }
    if (next >= enabled.length) {
      return wrap ? enabled[0] : enabled[enabled.length - 1];
    }
    return enabled[next];
  }

  /** Moves DOM focus to `target` and rewrites every item's tabindex (focused 0, others -1). */
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
   * Fires the select action on the activated tab through the single wire seam. {@link callWire} is
   * a no-op when `action` is blank, so an uncontrolled tablist never round-trips (the
   * controlled/uncontrolled doctrine, expressed for a non-close action).
   */
  private activate(tab: HTMLElement, action: string | null): void {
    callWire(tab, action, { trigger: tab });
  }
}
