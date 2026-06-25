/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * `lv-rich-select` -- the WAI-ARIA APG Combobox keyboard navigation of the server-first rich-select
 * WIRE component (ADR-0012, roadmap L1), as a Stimulus controller (the conversion of the colocated
 * `registry/wire/rich-select/rich-select.ts` enhancer). Mounted on the rich-select ROOT via
 * `data-controller="lv-rich-select"`.
 *
 * The catalog, the server-side debounced filter, the single/multiple selection, the chips and the
 * create affordance all live in typed Java rendered by JTE; this controller is the ONE irreducible
 * client bit: ArrowUp/ArrowDown move the active option, Home/End jump to the ends, Enter activates
 * the active option. The listbox is always rendered (the panel is inline, not a popover), so the
 * search input owns the keystrokes via `data-action="keydown->lv-rich-select#onKeyDown"` (CSP-clean,
 * a plain string attribute -- never an inline handler, the bug the pivot exists to kill).
 *
 * Controlled / uncontrolled doctrine: this controller issues ZERO wire calls of its own. "Active"
 * is a pure client gesture; Enter ACTIVATES the active option by re-using its OWN server `l:click`
 * (a synthetic `.click()`), so the selection / toggle / create logic stays 100% on the server and
 * no spurious round-trip is ever sent (the wire-410 page-expired bug class is structurally absent --
 * there is no close action to fire, so the controller extends plain `Controller`, not
 * `DismissableController`).
 *
 * Morph-safety: the keydown wiring is a declared `data-action`, so Stimulus's action observer
 * re-binds it automatically when a wire morph re-renders the search input, and the option set is read
 * through `optionTargets` (re-resolved on every morph). No `data-rich-select-wired` marker, no
 * WeakSet, no afterCall sweep -- Stimulus owns connect/disconnect, so re-enhancing after a morph
 * cannot stack a second listener.
 *
 * a11y source: WAI-ARIA APG Combobox (https://www.w3.org/WAI/ARIA/apg/patterns/combobox/) with a
 * listbox popup; the active option is named via `data-rich-select-active` (the established DOM
 * contract the styling + the kit IT speak).
 */

import { Controller } from "@hotwired/stimulus";

/** Marks the currently active (keyboard-focused) option -- the established rich-select DOM contract. */
const ACTIVE = "data-rich-select-active";

export default class LvRichSelectController extends Controller<HTMLElement> {
  static targets = ["option"];

  /** The selectable option + create rows, in DOM order (re-resolved by Stimulus on every morph). */
  declare readonly optionTargets: HTMLElement[];

  /**
   * APG Combobox keyboard nav, wired via `data-action="keydown->lv-rich-select#onKeyDown"` on the
   * search input. ArrowDown/Up step (and wrap) the active option, Home/End jump to the ends, Enter
   * activates the active option by synthetically clicking it (firing its own server `l:click`).
   *
   * @param event the keydown from the search input
   */
  onKeyDown(event: KeyboardEvent): void {
    const options = this.selectableOptions();
    if (options.length === 0) {
      return;
    }
    const current = options.findIndex((o) => o.getAttribute(ACTIVE) === "true");
    switch (event.key) {
      case "ArrowDown":
        // from no active option (-1) ArrowDown lands on the first; otherwise step + wrap.
        event.preventDefault();
        this.activate(options, wrap(current + 1, options.length));
        break;
      case "ArrowUp":
        // from no active option (-1) ArrowUp lands on the LAST (APG); otherwise step + wrap.
        event.preventDefault();
        this.activate(
          options,
          current < 0 ? options.length - 1 : wrap(current - 1, options.length),
        );
        break;
      case "Home":
        event.preventDefault();
        this.activate(options, 0);
        break;
      case "End":
        event.preventDefault();
        this.activate(options, options.length - 1);
        break;
      case "Enter":
        // Activate the active option via its own server l:click (a synthetic click); the selection /
        // toggle / create logic stays entirely server-side, the controller never touches the wire.
        if (current >= 0) {
          event.preventDefault();
          options[current].click();
        }
        break;
      default:
        break;
    }
  }

  /** The non-disabled option + create rows, in DOM order. */
  private selectableOptions(): HTMLElement[] {
    return this.optionTargets.filter(
      (o) => o.getAttribute("aria-disabled") !== "true",
    );
  }

  /** Marks index `i` active + scrolls it into view; clears the others. */
  private activate(options: HTMLElement[], i: number): void {
    options.forEach((option, idx) => {
      if (idx === i) {
        option.setAttribute(ACTIVE, "true");
        option.scrollIntoView({ block: "nearest" });
      } else {
        option.removeAttribute(ACTIVE);
      }
    });
  }
}

/** Wraps an index into `[0, length)` so ArrowUp/Down cycle the list. */
function wrap(i: number, length: number): number {
  return ((i % length) + length) % length;
}
