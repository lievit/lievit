/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * lv-input-number Stimulus controller -- the numeric stepper. Driven through the REAL Stimulus
 * Application started by startStimulus() (auto-loads controllers by filename) over the DOM exactly
 * as input-number.jte emits it (no mocks). Proves: increment/decrement by step, min/max clamp,
 * ArrowUp/Down keyboard step, at-bounds button disabling, the programmatic `input` event, and
 * morph-safety (after a real morph one click = one step, no stacked listeners).
 */
import { afterEach, describe, it, expect } from "vitest";

import { morph } from "../runtime/morph.js";
import { startStimulus, stopStimulus, flushStimulus } from "../runtime/stimulus/application.js";

afterEach(() => {
  stopStimulus();
  document.body.innerHTML = "";
});

interface Opts {
  value?: string;
  min?: string;
  max?: string;
  step?: string;
  precision?: string;
}

/** Build a stepper root exactly as input-number.jte emits it (controller + targets + actions). */
function mount(opts: Opts = {}): HTMLElement {
  const root = document.createElement("div");
  root.setAttribute("data-controller", "lv-input-number");
  root.setAttribute("data-lv-input-number-step-value", opts.step ?? "1");
  if (opts.min != null) root.setAttribute("data-lv-input-number-min-value", opts.min);
  if (opts.max != null) root.setAttribute("data-lv-input-number-max-value", opts.max);
  if (opts.precision != null) root.setAttribute("data-lv-input-number-precision-value", opts.precision);
  root.innerHTML = `
    <button type="button" data-lv-input-number-target="decrement"
            data-action="click->lv-input-number#decrement">-</button>
    <input data-lv-input-number-target="input"
           data-action="input->lv-input-number#onInput keydown->lv-input-number#onKeydown"
           name="qty" value="${opts.value ?? ""}">
    <button type="button" data-lv-input-number-target="increment"
            data-action="click->lv-input-number#increment">+</button>`;
  document.body.appendChild(root);
  return root;
}

const input = (root: HTMLElement) => root.querySelector("input") as HTMLInputElement;
const incBtn = (root: HTMLElement) =>
  root.querySelector('[data-lv-input-number-target="increment"]') as HTMLButtonElement;
const decBtn = (root: HTMLElement) =>
  root.querySelector('[data-lv-input-number-target="decrement"]') as HTMLButtonElement;

describe("lv-input-number -- stepping", () => {
  it("increments by step on the + button", async () => {
    const root = mount({ value: "1", step: "1" });
    startStimulus({});
    await flushStimulus();
    incBtn(root).click();
    expect(input(root).value).toBe("2");
  });

  it("decrements by step on the - button", async () => {
    const root = mount({ value: "5", step: "2" });
    startStimulus({});
    await flushStimulus();
    decBtn(root).click();
    expect(input(root).value).toBe("3");
  });

  it("ArrowUp / ArrowDown step the value from the input", async () => {
    const root = mount({ value: "10", step: "5" });
    startStimulus({});
    await flushStimulus();
    input(root).dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }));
    expect(input(root).value).toBe("15");
    input(root).dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    expect(input(root).value).toBe("10");
  });

  it("rounds to the declared precision", async () => {
    const root = mount({ value: "9.90", step: "0.1", precision: "2" });
    startStimulus({});
    await flushStimulus();
    incBtn(root).click();
    expect(input(root).value).toBe("10.00");
  });

  it("fires an `input` event on a programmatic step (l:model sees it)", async () => {
    const root = mount({ value: "1" });
    startStimulus({});
    await flushStimulus();
    let fired = 0;
    input(root).addEventListener("input", () => (fired += 1));
    incBtn(root).click();
    expect(fired).toBe(1);
  });
});

describe("lv-input-number -- bounds", () => {
  it("clamps to max and disables the + button at the ceiling", async () => {
    const root = mount({ value: "9", max: "10", step: "5" });
    startStimulus({});
    await flushStimulus();
    incBtn(root).click();
    expect(input(root).value).toBe("10"); // 9 + 5 clamped to 10
    expect(incBtn(root).disabled).toBe(true);
  });

  it("clamps to min and disables the - button at the floor", async () => {
    const root = mount({ value: "1", min: "0", step: "5" });
    startStimulus({});
    await flushStimulus();
    decBtn(root).click();
    expect(input(root).value).toBe("0");
    expect(decBtn(root).disabled).toBe(true);
  });

  it("is unbounded when no min/max attribute is present", async () => {
    const root = mount({ value: "0", step: "1" });
    startStimulus({});
    await flushStimulus();
    decBtn(root).click();
    expect(input(root).value).toBe("-1");
    expect(decBtn(root).disabled).toBe(false);
  });
});

describe("lv-input-number -- morph-safety", () => {
  it("after a real morph one click still steps exactly once (no stacked listeners)", async () => {
    const root = mount({ value: "1", step: "1" });
    startStimulus({});
    await flushStimulus();

    // Re-render the same element (idempotent morph), as the lievit wire would.
    morph(root, root.outerHTML);
    await flushStimulus();

    incBtn(root).click();
    expect(input(root).value).toBe("2"); // exactly one step, not two
  });
});
