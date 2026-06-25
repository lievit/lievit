/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * `lv-rate` -- the star-rating control (Ant Design Rate parity), as a Stimulus controller. The
 * SELECTION is a native radio group (one radio per star, sr-only, form-submitting); the controller
 * only adds the HOVER PREVIEW (paint the stars up to the pointer) and keeps the painted fill in
 * sync with the chosen value. Progressive enhancement: with JS off the radios still select + submit
 * and the SERVER-rendered fill (each star painted from the initial value) is correct; the controller
 * just enriches it with the live hover preview.
 *
 * DOM contract (what rate.jte emits):
 *   <div data-controller="lv-rate" role="radiogroup"
 *        data-lv-rate-active-color-value="var(--lv-color-warning)"
 *        data-lv-rate-empty-color-value="var(--lv-color-muted)">
 *     <label data-value="1" data-action="mouseenter->lv-rate#preview mouseleave->lv-rate#reset">
 *       <input type="radio" data-lv-rate-target="input" data-action="change->lv-rate#onChange" ...>
 *       <span data-lv-rate-target="star">...star glyph...</span>
 *     </label>
 *     ... (N stars) ...
 *   </div>
 *
 * The fill colour is read from data-*-value (themeable, no hardcoded token name in the module). The
 * controller paints by setting each star glyph's `style.color` -- that is controller JS, not an
 * inline template handler, so the strict CSP is satisfied.
 *
 * Morph-safety: the only listeners are declarative `data-action` bindings, re-bound by Stimulus on
 * a wire morph. `connect()` paints from the current selection; nothing to tear down.
 *
 * docs-first: verified against @hotwired/stimulus 3.2.x (static targets/values + data-action).
 */

import { Controller } from "@hotwired/stimulus";

export default class LvRateController extends Controller<HTMLElement> {
  static targets = ["input", "star"];
  static values = {
    activeColor: { type: String, default: "var(--lv-color-warning)" },
    emptyColor: { type: String, default: "var(--lv-color-muted)" },
  };

  declare readonly inputTargets: HTMLInputElement[];
  declare readonly starTargets: HTMLElement[];
  declare readonly activeColorValue: string;
  declare readonly emptyColorValue: string;

  connect(): void {
    this.paint(this.selectedValue());
  }

  /** Hover preview: paint up to the star the pointer entered (read from its label's data-value). */
  preview(event: Event): void {
    const label = event.currentTarget as HTMLElement | null;
    const v = label?.dataset.value;
    const n = v != null ? Number(v) : NaN;
    if (Number.isFinite(n)) {
      this.paint(n);
    }
  }

  /** Pointer left the group: revert the paint to the actual selection. */
  reset(): void {
    this.paint(this.selectedValue());
  }

  /** A radio was chosen: re-paint to the new selection. */
  onChange(): void {
    this.paint(this.selectedValue());
  }

  /** The currently-selected rating (count of the checked radio), or 0 when none is checked. */
  private selectedValue(): number {
    const checked = this.inputTargets.find((i) => i.checked);
    if (checked == null) {
      return 0;
    }
    const n = Number(checked.value);
    return Number.isFinite(n) ? n : 0;
  }

  /** Paint the first `threshold` stars active, the rest empty (1-based, by target order). */
  private paint(threshold: number): void {
    this.starTargets.forEach((star, index) => {
      const active = index + 1 <= threshold;
      star.style.color = active ? this.activeColorValue : this.emptyColorValue;
      star.dataset.active = active ? "true" : "false";
    });
  }
}
