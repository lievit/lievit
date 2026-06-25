/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * `lv-input-number` -- the numeric stepper (Ant Design InputNumber parity), as a Stimulus
 * controller. Mounted on the wrapper of a stepper group:
 *
 *   <div data-controller="lv-input-number"
 *        data-lv-input-number-step-value="1"
 *        data-lv-input-number-min-value="0"        (optional)
 *        data-lv-input-number-max-value="100"      (optional)
 *        data-lv-input-number-precision-value="0"> (optional)
 *     <button data-action="click->lv-input-number#decrement" data-lv-input-number-target="decrement">
 *     <input  data-lv-input-number-target="input"
 *             data-action="input->lv-input-number#onInput keydown->lv-input-number#onKeydown">
 *     <button data-action="click->lv-input-number#increment" data-lv-input-number-target="increment">
 *   </div>
 *
 * It is pure CLIENT view-state: stepping the value never round-trips the wire (the value is a form
 * field the server reads on submit, the CQRS read-your-writes trade-off does not apply to an input
 * a user is typing). It enhances a fully-functional native <input>: with JS off the input is still
 * editable and submittable; the controller only adds the +/- affordances, bound clamping, the
 * ArrowUp/ArrowDown keyboard step, and the at-bounds disabling of the step buttons.
 *
 * `min`/`max` are OPTIONAL: their absence (no data-*-min-value attribute) means unbounded on that
 * side, read via Stimulus's `hasMinValue` / `hasMaxValue` rather than a sentinel.
 *
 * Morph-safety: the only listeners are declarative `data-action` bindings, which Stimulus re-binds
 * automatically when a wire morph re-renders the element. `connect()` just syncs the button
 * disabled-state to the rendered value; there is nothing to tear down (no global listeners).
 *
 * docs-first: verified against @hotwired/stimulus 3.2.x (static values + targets + data-action).
 */

import { Controller } from "@hotwired/stimulus";

export default class LvInputNumberController extends Controller<HTMLElement> {
  static targets = ["input", "increment", "decrement"];
  static values = {
    min: Number,
    max: Number,
    step: Number,
    precision: Number,
  };

  declare readonly hasInputTarget: boolean;
  declare readonly inputTarget: HTMLInputElement;
  declare readonly hasIncrementTarget: boolean;
  declare readonly incrementTarget: HTMLButtonElement;
  declare readonly hasDecrementTarget: boolean;
  declare readonly decrementTarget: HTMLButtonElement;

  declare readonly hasMinValue: boolean;
  declare readonly minValue: number;
  declare readonly hasMaxValue: boolean;
  declare readonly maxValue: number;
  declare readonly hasStepValue: boolean;
  declare readonly stepValue: number;
  declare readonly hasPrecisionValue: boolean;
  declare readonly precisionValue: number;

  connect(): void {
    this.syncButtons();
  }

  /** The step size; defaults to 1 when no step value is declared. */
  private get step(): number {
    return this.hasStepValue && this.stepValue !== 0 ? this.stepValue : 1;
  }

  /** Increment by one step (button + ArrowUp). */
  increment(): void {
    this.applyDelta(this.step);
  }

  /** Decrement by one step (button + ArrowDown). */
  decrement(): void {
    this.applyDelta(-this.step);
  }

  /** ArrowUp / ArrowDown step the value (the rest is the native input). */
  onKeydown(event: KeyboardEvent): void {
    if (event.key === "ArrowUp") {
      event.preventDefault();
      this.increment();
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      this.decrement();
    }
  }

  /** Re-evaluate the button disabled-state as the user types. */
  onInput(): void {
    this.syncButtons();
  }

  /** The current numeric value, or null when the field is blank / not a number. */
  private currentValue(): number | null {
    if (!this.hasInputTarget) {
      return null;
    }
    const raw = this.inputTarget.value.trim();
    if (raw.length === 0) {
      return null;
    }
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }

  /** Clamp a number into [min, max] when those bounds are declared. */
  private clamp(n: number): number {
    let v = n;
    if (this.hasMinValue && v < this.minValue) {
      v = this.minValue;
    }
    if (this.hasMaxValue && v > this.maxValue) {
      v = this.maxValue;
    }
    return v;
  }

  /** Round to the declared precision (decimal places), if any. */
  private format(n: number): string {
    if (this.hasPrecisionValue && this.precisionValue >= 0) {
      return n.toFixed(this.precisionValue);
    }
    return String(n);
  }

  /** Apply a signed delta: step from the current value (or from min/0 when blank), clamp, write. */
  private applyDelta(delta: number): void {
    if (!this.hasInputTarget) {
      return;
    }
    const base = this.currentValue() ?? (this.hasMinValue ? this.minValue : 0);
    const next = this.clamp(base + delta);
    this.inputTarget.value = this.format(next);
    // Fire `input` so any l:model binding / listener sees the programmatic change.
    this.inputTarget.dispatchEvent(new Event("input", { bubbles: true }));
    this.syncButtons();
  }

  /** Disable the +/- buttons when the value is at (or past) a declared bound. */
  private syncButtons(): void {
    const v = this.currentValue();
    if (this.hasIncrementTarget) {
      this.incrementTarget.disabled =
        v != null && this.hasMaxValue && v >= this.maxValue;
    }
    if (this.hasDecrementTarget) {
      this.decrementTarget.disabled =
        v != null && this.hasMinValue && v <= this.minValue;
    }
  }
}
