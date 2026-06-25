/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * `lv-slider` -- the APG slider client behaviour, as a Stimulus controller (the conversion of
 * `runtime/features/slider.enhancer.ts`). Mounted on the slider ROOT via
 * `data-controller="lv-slider"`. The native `input[type=range]` is the accessible spine (role,
 * aria-value*, the full Arrow/Home/End/PageUp-Down keyboard map are the platform's, for free); the
 * styled overlay (track + fill + thumb + tooltip + marks) is `aria-hidden`. This controller only
 * supplies the irreducible client bits the native element does not cover:
 *
 * - on every `input` (drag/key tick): update `--slider-pct` (and `--slider-pct-high` in range mode)
 *   on the root so the CSS-driven fill + thumb overlays track the live value, with NO round-trip.
 * - range mode: clamp `valueLow <= valueHigh` by nudging the moved thumb back when it crosses the
 *   other, then sync `aria-valuemax` (low input) / `aria-valuemin` (high input) so AT hears the live
 *   constraint (APG multithumb rule). DOM tab order stays constant (low always first); never re-sort.
 * - tooltip text: rewrite the tooltip text node with the live numeric value on every `input`.
 * - tooltip hover visibility (`showTooltip="hover"`): toggle `opacity-100` on mouseover/focusin and
 *   remove on mouseout/focusout. Guarded to hover mode so an `always` tooltip is never hidden and a
 *   `never` tooltip never appears (the old enhancer attached these listeners only in hover mode).
 * - plain-form POST sync (single-thumb): on `change`, copy the committed value into a sibling
 *   `input[type=hidden]` of the same name in the closest form. (Range mode has no hidden sync, as in
 *   the enhancer; the wire `l:model` directive picks up the native `change` when bound.)
 *
 * UNCONTROLLED: a slider is pure client cosmetic -- it NEVER round-trips the wire on a drag tick, so
 * this is a plain {@link Controller} (no {@link DismissableController}, no `data-lv-wire-close`, no
 * `callWire`). There is nothing to dismiss and no focus to trap or restore.
 *
 * Morph-safety: ALL behaviour is declared as `data-action` on the native inputs, so Stimulus re-binds
 * it automatically after the lievit wire morph + idiomorph + Turbo Drive visits. There is no
 * `connect()`-bound listener and so nothing to tear down, no `WeakSet`-of-wired-roots, no
 * `data-*-enhanced` marker, no `afterCall` sweep -- Stimulus owns connect/disconnect (the whole point
 * of the migration). The round-2 listener-stacking bug class is structurally impossible.
 *
 * APG sources:
 *   https://www.w3.org/WAI/ARIA/apg/patterns/slider/
 *   https://www.w3.org/WAI/ARIA/apg/patterns/slider-multithumb/
 */

import { Controller } from "@hotwired/stimulus";

/** Compute fill percentage clamped to [0, 100]. */
function computePct(value: number, minVal: number, maxVal: number): number {
  const range = maxVal - minVal;
  if (range === 0) return 0;
  return Math.min(100, Math.max(0, ((value - minVal) / range) * 100));
}

/** The live client label: always numeric (no server round-trip on a drag tick). */
function liveLabel(value: number): string {
  return String(Math.round(value));
}

/** Read a numeric attribute with a fallback when the attribute is the empty string. */
function numOr(raw: string, fallback: number): number {
  return raw !== "" ? parseFloat(raw) : fallback;
}

/** A Stimulus action event carrying this controller's action params. */
type SliderActionEvent = Event & { readonly params: { thumb?: string } };

export default class LvSliderController extends Controller<HTMLElement> {
  static targets = ["input", "inputLow", "inputHigh", "tooltip", "tooltipLow", "tooltipHigh"];

  declare readonly hasInputTarget: boolean;
  declare readonly inputTarget: HTMLInputElement;
  declare readonly hasInputLowTarget: boolean;
  declare readonly inputLowTarget: HTMLInputElement;
  declare readonly hasInputHighTarget: boolean;
  declare readonly inputHighTarget: HTMLInputElement;
  declare readonly hasTooltipTarget: boolean;
  declare readonly tooltipTarget: HTMLElement;
  declare readonly hasTooltipLowTarget: boolean;
  declare readonly tooltipLowTarget: HTMLElement;
  declare readonly hasTooltipHighTarget: boolean;
  declare readonly tooltipHighTarget: HTMLElement;

  // --- single-thumb --------------------------------------------------------------------------

  /** Single-thumb drag/key tick: sync `--slider-pct` + the tooltip text from the native input. */
  onInput(): void {
    if (!this.hasInputTarget) return;
    const input = this.inputTarget;
    const pct = computePct(input.valueAsNumber, numOr(input.min, 0), numOr(input.max, 100));
    this.element.style.setProperty("--slider-pct", `${pct}%`);
    if (this.hasTooltipTarget) {
      this.tooltipTarget.textContent = liveLabel(input.valueAsNumber);
    }
  }

  /** Plain-form POST sync: on commit, copy the value into a same-name hidden input in the form. */
  onChange(): void {
    if (!this.hasInputTarget) return;
    const input = this.inputTarget;
    const form = input.closest("form");
    if (form == null || !input.name) return;
    const hidden = form.querySelector<HTMLInputElement>(
      `input[type=hidden][name="${input.name}"]`,
    );
    if (hidden != null) {
      hidden.value = String(input.valueAsNumber);
    }
  }

  // --- range (dual-thumb) --------------------------------------------------------------------

  /** Low-thumb tick: clamp `low <= high`, then resync both fills + the APG ARIA constraints. */
  onInputLow(): void {
    if (!this.hasInputLowTarget || !this.hasInputHighTarget) return;
    if (this.inputLowTarget.valueAsNumber > this.inputHighTarget.valueAsNumber) {
      this.inputLowTarget.valueAsNumber = this.inputHighTarget.valueAsNumber;
    }
    this.syncBoth();
  }

  /** High-thumb tick: clamp `high >= low`, then resync both fills + the APG ARIA constraints. */
  onInputHigh(): void {
    if (!this.hasInputLowTarget || !this.hasInputHighTarget) return;
    if (this.inputHighTarget.valueAsNumber < this.inputLowTarget.valueAsNumber) {
      this.inputHighTarget.valueAsNumber = this.inputLowTarget.valueAsNumber;
    }
    this.syncBoth();
  }

  private syncBoth(): void {
    const lo = this.inputLowTarget.valueAsNumber;
    const hi = this.inputHighTarget.valueAsNumber;
    const minVal = numOr(this.inputLowTarget.min, 0);
    const maxVal = numOr(this.inputHighTarget.max, 100);

    this.element.style.setProperty("--slider-pct", `${computePct(lo, minVal, maxVal)}%`);
    this.element.style.setProperty("--slider-pct-high", `${computePct(hi, minVal, maxVal)}%`);

    // APG multithumb: each thumb's live constraint reflects the other's current value so AT hears
    // the updated boundary in real time.
    this.inputLowTarget.setAttribute("aria-valuemax", String(hi));
    this.inputHighTarget.setAttribute("aria-valuemin", String(lo));

    if (this.hasTooltipLowTarget) this.tooltipLowTarget.textContent = liveLabel(lo);
    if (this.hasTooltipHighTarget) this.tooltipHighTarget.textContent = liveLabel(hi);
  }

  // --- tooltip hover visibility (hover mode only) --------------------------------------------

  /** mouseover/focusin: reveal the relevant tooltip, but only when `showTooltip="hover"`. */
  showTip(e: SliderActionEvent): void {
    this.tooltipFor(e.params.thumb)?.classList.add("opacity-100");
  }

  /** mouseout/focusout: hide the relevant tooltip, but only when `showTooltip="hover"`. */
  hideTip(e: SliderActionEvent): void {
    this.tooltipFor(e.params.thumb)?.classList.remove("opacity-100");
  }

  /**
   * Resolve the tooltip element for a thumb, or `null` outside hover mode (so `always`/`never`
   * tooltips are never toggled). `thumb` is `"low"`/`"high"` in range mode, undefined single-thumb.
   */
  private tooltipFor(thumb: string | undefined): HTMLElement | null {
    if (this.element.dataset["tooltip"] !== "hover") return null;
    if (thumb === "low") return this.hasTooltipLowTarget ? this.tooltipLowTarget : null;
    if (thumb === "high") return this.hasTooltipHighTarget ? this.tooltipHighTarget : null;
    return this.hasTooltipTarget ? this.tooltipTarget : null;
  }
}
