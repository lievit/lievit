/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * color-picker (Filament ColorPicker, native-first): a native <input type=color> + optional preset
 * swatches. Two halves: a structural golden over the partial SOURCE (native-input-as-form-source,
 * a11y, no-dep), and the enhancer DOM behaviour (preset click writes the native value + fires
 * native change) against a DOM shaped like the partial.
 */
import { describe, test, expect, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  enhanceColorPicker,
  enhanceAllColorPickers,
} from "../registry/jte/color-picker.enhancer.js";

const jteDir = join(import.meta.dirname, "..", "registry", "jte");
const read = (rel: string) => readFileSync(join(jteDir, rel), "utf8");
const markupOf = (rel: string) => read(rel).replace(/<%--[\s\S]*?--%>/g, "");

describe("color-picker.jte -- native <input type=color> form field", () => {
  const src = read("color-picker.jte");
  const markup = markupOf("color-picker.jte");

  test("the form source of truth is a native <input type=color> carrying name + value", () => {
    expect(markup).toContain('type="color"');
    expect(markup).toContain('name="${name}"');
    expect(markup).toContain('value="${value}"');
    expect(markup).toContain("data-color-picker-input");
  });

  test("the wrapper carries the enhancer hook + l:model binds the native input", () => {
    expect(markup).toContain("data-lievit-color-picker");
    expect(markup).toContain('l:model="${model}"');
  });

  test("presets are real <button type=button> with an aria-label naming the colour (not colour alone)", () => {
    expect(markup).toContain('data-color-picker-preset="${preset}"');
    expect(markup).toContain('aria-label="${preset}"');
    expect(markup).toContain('type="button"');
  });

  test("presets are optional + come in via a List param (never hardcoded)", () => {
    expect(src).toMatch(/@param java\.util\.List<String> presets/);
    expect(markup).toContain("@if(hasPresets)");
  });

  test("invalid + describedBy wire the field's error state", () => {
    expect(markup).toContain('aria-invalid="${invalid ? "true" : null}"');
    expect(markup).toContain('aria-describedby="${describedBy}"');
  });

  test("a live hex readout is aria-live so AT hears the colour change", () => {
    expect(markup).toContain('aria-live="polite"');
    expect(markup).toContain("data-color-picker-value");
  });

  test("no inline script or on* handler in the markup (CSP-clean)", () => {
    expect(markup).not.toMatch(/<script/);
    expect(markup).not.toMatch(/\son[a-z]+=/);
  });
});

/** Build a DOM matching the server-rendered color-picker partial (with presets). */
function render(value = "#000000", presets: string[] = ["#2563eb", "#16a34a"]): HTMLElement {
  const root = document.createElement("div");
  root.setAttribute("data-lievit-color-picker", "");
  const presetRow = document.createElement("div");
  for (const p of presets) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.setAttribute("data-color-picker-preset", p);
    presetRow.appendChild(btn);
  }
  root.appendChild(presetRow);
  const input = document.createElement("input");
  input.type = "color";
  input.name = "colore";
  input.value = value;
  input.setAttribute("data-color-picker-input", "");
  root.appendChild(input);
  const readout = document.createElement("output");
  readout.setAttribute("data-color-picker-value", "");
  readout.textContent = value;
  root.appendChild(readout);
  document.body.appendChild(root);
  return root;
}

const input = (root: HTMLElement) =>
  root.querySelector<HTMLInputElement>("[data-color-picker-input]")!;
const readout = (root: HTMLElement) =>
  root.querySelector<HTMLElement>("[data-color-picker-value]")!;
const presetBtns = (root: HTMLElement) =>
  Array.from(root.querySelectorAll<HTMLButtonElement>("[data-color-picker-preset]"));

afterEach(() => {
  document.body.innerHTML = "";
});

describe("color-picker enhancer -- DOM behaviour", () => {
  test("clicking a preset writes its colour into the native input + fires native change", () => {
    const root = render();
    enhanceColorPicker(root);
    let changes = 0;
    input(root).addEventListener("change", () => changes++);
    presetBtns(root)[0].click();
    expect(input(root).value).toBe("#2563eb");
    expect(changes).toBe(1);
  });

  test("the hex readout follows both a preset click and a native input event", () => {
    const root = render();
    enhanceColorPicker(root);
    presetBtns(root)[1].click();
    expect(readout(root).textContent).toBe("#16a34a");
    input(root).value = "#ffffff";
    input(root).dispatchEvent(new Event("input", { bubbles: true }));
    expect(readout(root).textContent).toBe("#ffffff");
  });

  test("a disabled input ignores preset clicks", () => {
    const root = render();
    input(root).disabled = true;
    enhanceColorPicker(root);
    presetBtns(root)[0].click();
    expect(input(root).value).toBe("#000000");
  });

  test("is idempotent + enhanceAll wires every root", () => {
    const root = render();
    enhanceColorPicker(root);
    enhanceColorPicker(root);
    expect(root.hasAttribute("data-color-picker-enhanced")).toBe(true);
    const second = render("#111111");
    enhanceAllColorPickers();
    expect(second.hasAttribute("data-color-picker-enhanced")).toBe(true);
  });
});
