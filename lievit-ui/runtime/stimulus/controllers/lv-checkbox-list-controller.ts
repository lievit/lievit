/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * `lv-checkbox-list` -- the progressive-enhancement tools of the multi-select checkbox group, as a
 * Stimulus controller (the conversion of `registry/jte/checkbox-list.enhancer.ts`). Mounted on the
 * `<fieldset>` root via `data-controller="lv-checkbox-list"`. The options, the checked state, and
 * the form-bound native checkboxes are all server-rendered; JS-OFF the user simply ticks the native
 * boxes and they POST the repeated `name`. This controller ONLY adds the two tools the partial keeps
 * hidden until JS runs:
 *   - a client-side filter over the visible options (the `role=searchbox` input)
 *   - a select-all / clear bulk toggle (its `aria-pressed` + visible label mirror the all-checked state)
 *
 * Neither tool owns the value: the native checkboxes stay the form source of truth, so the field
 * POSTs identically whether or not JS ran. This is an UNCONTROLLED, client-only surface -- it never
 * round-trips the wire (no {@link DismissableController}); the bulk toggle fires native `input` +
 * `change` so `l:model` / forms observe the change exactly as a hand tick would.
 *
 * Wiring is CSP-clean and declarative (no inline `<script>` / `on*=`): the template carries
 * `data-action` descriptors (`input->...#filter`, `click->...#toggleAll`, `change->...#onChange` on
 * the root) and a `data-lv-checkbox-list-target="tools"` on the hidden tools row. Stimulus rebinds
 * every `data-action` automatically across the wire morph + idiomorph, so the round-2
 * listener-stacking bug class is structurally impossible. The hidden tools row is revealed in
 * {@link tools-target}'s connect callback (fires before {@link connect} and again whenever a morph
 * re-inserts the row), not in a one-shot init -- so JS-on always shows live controls.
 *
 * The descendants are reached through the established `data-checkbox-list-*` / `data-slot` contract
 * (the same hooks the still-shipping enhancer + golden tests speak), not renamed to Stimulus values.
 *
 * WAI-ARIA APG Checkbox Group: native fieldset/legend, aria-pressed + dynamic label on the toggle.
 */

import { Controller } from "@hotwired/stimulus";

/** The re-forged checkbox primitive's native input slot (NOT the deprecated "checkbox-control"). */
const BOX = "[data-slot='checkbox-input']";
/** One option row wrapper (carries data-label / data-value for filtering). */
const OPTION = "[data-checkbox-list-option]";
/** The select-all / clear bulk toggle button. */
const TOGGLE = "[data-checkbox-list-toggle-all]";

/** Case- and accent-insensitive substring match of a query against an option label. */
export function matchesQuery(label: string, query: string): boolean {
  const q = normalize(query);
  if (q === "") return true;
  return normalize(label).includes(q);
}

/** Lowercase + strip diacritics so "citta" matches "città" and case never blocks a match. */
function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

export default class LvCheckboxListController extends Controller<HTMLElement> {
  static targets = ["tools"];

  declare readonly hasToolsTarget: boolean;
  declare readonly toolsTarget: HTMLElement;

  connect(): void {
    // Reflect the initial all-checked state onto the toggle (the tools row may already be present).
    this.syncToggleState();
  }

  /**
   * Reveal the tools row the partial rendered hidden (so JS-off shows no dead controls). Fires
   * before connect() on the initial scan and again whenever a morph re-inserts the row -- the
   * morph-safe replacement for the enhancer's `afterCall` re-reveal.
   */
  toolsTargetConnected(el: HTMLElement): void {
    el.hidden = false;
  }

  /** `input->lv-checkbox-list#filter`: hide options whose label does not match the query. */
  filter(event: Event): void {
    const query = (event.target as HTMLInputElement).value;
    for (const option of this.options()) {
      const label = option.getAttribute("data-label") ?? option.textContent ?? "";
      option.style.display = matchesQuery(label, query) ? "" : "none";
    }
    this.syncToggleState();
  }

  /**
   * `click->lv-checkbox-list#toggleAll`: check (or, when all already checked, clear) every visible,
   * enabled box, firing native `input` + `change` so `l:model` / forms see it. Acts only on the
   * currently-visible boxes, so it respects an active filter.
   */
  toggleAll(): void {
    const boxes = this.visibleBoxes();
    const allChecked = boxes.length > 0 && boxes.every((b) => b.checked);
    const next = !allChecked;
    for (const box of boxes) {
      if (box.checked === next) continue;
      box.checked = next;
      box.dispatchEvent(new Event("input", { bubbles: true }));
      box.dispatchEvent(new Event("change", { bubbles: true }));
    }
    this.syncToggleState();
  }

  /** `change->lv-checkbox-list#onChange` (on the root): keep the toggle honest when boxes are ticked by hand. */
  onChange(event: Event): void {
    const target = event.target as HTMLElement;
    if (typeof target.matches === "function" && target.matches(BOX)) {
      this.syncToggleState();
    }
  }

  // --- internals -----------------------------------------------------------------------------

  private options(): HTMLElement[] {
    return Array.from(this.element.querySelectorAll<HTMLElement>(OPTION));
  }

  private get toggle(): HTMLButtonElement | null {
    return this.element.querySelector<HTMLButtonElement>(TOGGLE);
  }

  /** The enabled, currently-visible (not display:none) boxes -- what the bulk toggle acts on. */
  private visibleBoxes(): HTMLInputElement[] {
    return Array.from(this.element.querySelectorAll<HTMLInputElement>(BOX)).filter((box) => {
      if (box.disabled) return false;
      const option = box.closest<HTMLElement>(OPTION);
      return !option || option.style.display !== "none";
    });
  }

  /**
   * Sync the toggle's `aria-pressed` + visible label to the current all-checked state of the
   * visible, enabled boxes. The button carries `data-select-all-label` (shown when NOT all checked)
   * and `data-clear-label` (shown when all checked); its text content is swapped to stay accurate.
   */
  private syncToggleState(): void {
    const toggle = this.toggle;
    if (toggle == null) return;
    const boxes = this.visibleBoxes();
    const allChecked = boxes.length > 0 && boxes.every((b) => b.checked);
    toggle.setAttribute("aria-pressed", String(allChecked));
    const selectLabel = toggle.getAttribute("data-select-all-label") ?? "Select all";
    const clearLabel = toggle.getAttribute("data-clear-label") ?? selectLabel;
    toggle.textContent = allChecked ? clearLabel : selectLabel;
  }
}
