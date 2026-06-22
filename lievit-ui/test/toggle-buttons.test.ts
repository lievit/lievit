/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * toggle-buttons (Filament ToggleButtons / shadcn ToggleGroup, form-bound + JS-off-safe): a
 * zero-JS segmented FORM control. Structural golden over the partial SOURCE (it compiles in the
 * Java world; this pins the native-input-styled-as-button trick, the radio/checkbox split, the
 * native POST contract, the joined-look CSS and the a11y wiring).
 */
import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const jteDir = join(import.meta.dirname, "..", "registry", "jte");
const read = (rel: string) => readFileSync(join(jteDir, rel), "utf8");
const markupOf = (rel: string) => read(rel).replace(/<%--[\s\S]*?--%>/g, "");

const src = read("toggle-buttons.jte");
const markup = markupOf("toggle-buttons.jte");

describe("toggle-buttons.jte -- native, zero-JS segmented form control", () => {
  test("is a native fieldset group (the platform radiogroup / checkbox set)", () => {
    expect(markup).toContain("<fieldset");
    expect(markup).toContain('data-slot="toggle-buttons"');
    expect(markup).toContain('role="group"');
  });

  test("each segment is a REAL native input (radio or checkbox), not a <button>", () => {
    expect(markup).toContain('type="${inputType}"');
    expect(src).toContain('var inputType = multiple ? "checkbox" : "radio"');
    expect(markup).toContain('data-slot="toggle-button-control"');
  });

  test("the segments share one `name` so they POST natively", () => {
    expect(markup).toContain('name="${name}"');
    expect(markup).toContain('value="${opt.getKey()}"');
  });

  test("the input is sr-only (focusable + submitted), the label is the visible peer-painted segment", () => {
    expect(markup).toContain('class="peer sr-only"');
    expect(src).toContain("peer-checked:bg-[var(--lv-color-primary)]");
    expect(src).toContain("peer-focus-visible:shadow-[var(--lv-ring)]");
    expect(markup).toContain('data-slot="toggle-button-label"');
    expect(markup).toContain('for="${segId}"');
  });

  test("the segments do NOT carry a bogus aria-pressed on the <label> (the native :checked is the truth)", () => {
    expect(markup).not.toContain("aria-pressed");
  });

  test("single vs multiple drives radio vs checkbox + the checked computation", () => {
    expect(src).toContain("multiple ? selectedSet.contains(opt.getKey()) : opt.getKey().equals(value)");
    expect(src).toMatch(/@param boolean multiple = false/);
  });

  test("reuses the button-group joined-look CSS (collapsed inner rounding + shared borders)", () => {
    expect(src).toContain("[&>*:not(:first-child)]:rounded-l-none");
    expect(src).toContain("[&>*:not(:first-child)]:border-l-0");
  });

  test("size + orientation are token-driven choices", () => {
    expect(src).toContain('case "sm"');
    expect(src).toContain('case "lg"');
    expect(src).toMatch(/@param String orientation = "horizontal"/);
  });

  test("invalid + describedBy wire the group's error state", () => {
    expect(markup).toContain('aria-invalid="${invalid ? "true" : null}"');
    expect(markup).toContain('aria-describedby="${describedBy}"');
  });

  test("options come in via a Map param or a content slot, never hardcoded", () => {
    expect(src).toMatch(/@param java\.util\.Map<String, String> options/);
    expect(src).toMatch(/@param gg\.jte\.Content content/);
    expect(markup).toContain("@if(content != null)");
  });

  test("no inline script or on* handler in the markup (CSP-clean, zero JS)", () => {
    expect(markup).not.toMatch(/<script/);
    expect(markup).not.toMatch(/\son[a-z]+=/);
  });
});
