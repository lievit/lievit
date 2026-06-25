/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * lv-rate Stimulus controller -- the star-rating hover preview. Driven through the REAL Stimulus
 * Application (auto-loads by filename) over the DOM exactly as rate.jte emits it (no mocks). Proves:
 * the connect-time paint from the selected value, the hover preview (paint up to the hovered star),
 * the revert on mouseleave, the repaint on selection change, and morph-safety.
 */
import { afterEach, describe, it, expect } from "vitest";

import { morph } from "../runtime/morph.js";
import { startStimulus, stopStimulus, flushStimulus } from "../runtime/stimulus/application.js";

const ACTIVE = "var(--lv-color-warning)";
const EMPTY = "var(--lv-color-muted)";

afterEach(() => {
  stopStimulus();
  document.body.innerHTML = "";
});

/** Build a rate root exactly as rate.jte emits it (radiogroup + N star labels). */
function mount(count: number, selected: number): HTMLElement {
  const root = document.createElement("fieldset");
  root.setAttribute("data-controller", "lv-rate");
  root.setAttribute("data-lv-rate-active-color-value", ACTIVE);
  root.setAttribute("data-lv-rate-empty-color-value", EMPTY);
  root.setAttribute("role", "radiogroup");
  let stars = "";
  for (let i = 1; i <= count; i++) {
    const active = i <= selected;
    stars += `
      <label data-value="${i}"
             data-action="mouseenter->lv-rate#preview mouseleave->lv-rate#reset">
        <input type="radio" data-lv-rate-target="input"
               data-action="change->lv-rate#onChange"
               name="r" value="${i}" ${i === selected ? "checked" : ""}>
        <span data-lv-rate-target="star" data-active="${active}"
              style="color:${active ? ACTIVE : EMPTY};">*</span>
      </label>`;
  }
  root.innerHTML = `<div data-slot="rate-stars">${stars}</div>`;
  document.body.appendChild(root);
  return root;
}

const stars = (root: HTMLElement) =>
  Array.from(root.querySelectorAll<HTMLElement>('[data-lv-rate-target="star"]'));
const labels = (root: HTMLElement) => Array.from(root.querySelectorAll<HTMLElement>("label"));
const activeCount = (root: HTMLElement) =>
  stars(root).filter((s) => s.dataset.active === "true").length;

describe("lv-rate -- paint from selection", () => {
  it("paints the first N stars active on connect from the checked radio", async () => {
    const root = mount(5, 3);
    startStimulus({});
    await flushStimulus();
    expect(activeCount(root)).toBe(3);
    expect(stars(root)[2].style.color).toBe(ACTIVE);
    expect(stars(root)[3].style.color).toBe(EMPTY);
  });

  it("paints zero active when nothing is selected", async () => {
    const root = mount(5, 0);
    startStimulus({});
    await flushStimulus();
    expect(activeCount(root)).toBe(0);
  });
});

describe("lv-rate -- hover preview", () => {
  it("paints up to the hovered star on mouseenter", async () => {
    const root = mount(5, 2);
    startStimulus({});
    await flushStimulus();
    labels(root)[3].dispatchEvent(new MouseEvent("mouseenter", { bubbles: false }));
    expect(activeCount(root)).toBe(4); // hovered the 4th star
  });

  it("reverts to the selection on mouseleave", async () => {
    const root = mount(5, 2);
    startStimulus({});
    await flushStimulus();
    labels(root)[4].dispatchEvent(new MouseEvent("mouseenter", { bubbles: false }));
    expect(activeCount(root)).toBe(5);
    labels(root)[4].dispatchEvent(new MouseEvent("mouseleave", { bubbles: false }));
    expect(activeCount(root)).toBe(2); // back to the selected value
  });
});

describe("lv-rate -- selection change", () => {
  it("repaints when a different radio becomes checked", async () => {
    const root = mount(5, 1);
    startStimulus({});
    await flushStimulus();
    const radios = root.querySelectorAll<HTMLInputElement>('input[type="radio"]');
    radios[0].checked = false;
    radios[3].checked = true;
    radios[3].dispatchEvent(new Event("change", { bubbles: true }));
    expect(activeCount(root)).toBe(4);
  });
});

describe("lv-rate -- morph-safety", () => {
  it("after a real morph the hover preview still fires exactly once", async () => {
    const root = mount(5, 2);
    startStimulus({});
    await flushStimulus();

    morph(root, root.outerHTML);
    await flushStimulus();

    labels(root)[2].dispatchEvent(new MouseEvent("mouseenter", { bubbles: false }));
    expect(activeCount(root)).toBe(3);
    labels(root)[2].dispatchEvent(new MouseEvent("mouseleave", { bubbles: false }));
    expect(activeCount(root)).toBe(2);
  });
});
