/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * segmented.jte -- structural + a11y + CSP contract (source-text asserts; real-compiler smoke in
 * test/jte-compile). Pins the native-radio single-select model, the raised-pill peer-checked
 * styling, the radiogroup a11y, the typed option Map (no hardcoded data), and CSP hygiene.
 */
import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const src = readFileSync(join(import.meta.dirname, "..", "registry", "jte", "segmented.jte"), "utf8");
const markup = src.replace(/<%--[\s\S]*?--%>/g, "");

describe("segmented -- param API", () => {
  test("declares name + typed option Map + value + size/block", () => {
    expect(src).toContain("@param String name");
    expect(src).toContain("@param java.util.Map<String, String> options = null");
    expect(src).toContain("@param String value = null");
    expect(src).toContain('@param String size = "md"');
    expect(src).toContain("@param boolean block = false");
  });
});

describe("segmented -- single-select native-radio model", () => {
  test("each option is a real sr-only radio + a visible label segment", () => {
    expect(markup).toContain('type="radio"');
    expect(markup).toContain("peer sr-only");
    expect(markup).toContain('data-slot="segmented-segment"');
  });
  test("the selected key drives the radio checked state (not colour alone)", () => {
    expect(markup).toContain("opt.getKey().equals(value)");
    expect(markup).toContain('checked="${on}"');
  });
  test("options arrive via a typed Map -- no data hardcoded in the partial", () => {
    expect(markup).toContain("options.entrySet()");
    expect(markup).toContain("opt.getValue()");
  });
  test("the raised-pill selected state uses peer-checked + the popover surface", () => {
    expect(src).toContain("peer-checked:bg-[var(--lv-color-popover)]");
    expect(src).toContain("peer-checked:shadow-[var(--lv-shadow-xs)]");
  });
});

describe("segmented -- a11y", () => {
  test("is a radiogroup fieldset with an accessible name", () => {
    expect(markup).toContain('role="radiogroup"');
    expect(markup).toContain("<fieldset");
    expect(markup).toContain('aria-label="${ariaLabel}"');
  });
});

describe("segmented -- token + CSP hygiene", () => {
  test("no hardcoded hex and no inline script/handler", () => {
    expect(markup).not.toMatch(/#[0-9a-fA-F]{3,6}/);
    expect(src).not.toMatch(/<script/i);
    expect(markup).not.toMatch(/\son[a-z]+=/i);
  });
});
