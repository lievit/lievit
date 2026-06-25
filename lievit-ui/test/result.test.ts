/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * result.jte -- structural + a11y + CSP contract (source-text asserts; real-compiler smoke in
 * test/jte-compile). Pins the status->glyph+colour mapping, the live-region a11y, the icon reuse,
 * the extra/content action slots, and CSP hygiene.
 */
import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const src = readFileSync(join(import.meta.dirname, "..", "registry", "jte", "result.jte"), "utf8");
const markup = src.replace(/<%--[\s\S]*?--%>/g, "");

describe("result -- param API", () => {
  test("declares status/title/subTitle + slot params", () => {
    expect(src).toContain('@param String status = "info"');
    expect(src).toContain("@param String title = null");
    expect(src).toContain("@param String subTitle = null");
    expect(src).toContain("@param gg.jte.Content extra = null");
    expect(src).toContain("@param gg.jte.Content content = null");
  });
});

describe("result -- status drives glyph + colour", () => {
  test("maps the seven statuses to a lucide glyph", () => {
    for (const g of ["circle-check", "circle-x", "triangle-alert", "lock", "circle-question-mark", "info"]) {
      expect(src).toContain(`"${g}"`);
    }
  });
  test("colour intents are token-driven (success/danger/warning/info/muted)", () => {
    expect(src).toContain("var(--lv-color-success)");
    expect(src).toContain("var(--lv-color-danger)");
    expect(src).toContain("var(--lv-color-muted-fg)");
  });
  test("reuses the lievit icon primitive (one icon system)", () => {
    expect(markup).toContain("@template.lievit.icon(name = iconName");
  });
});

describe("result -- a11y", () => {
  test("is a live status region so a morphed-in result is announced", () => {
    expect(markup).toContain('role="status"');
    expect(markup).toContain('aria-live="polite"');
  });
  test("the glyph is aria-hidden (colour never the sole signal)", () => {
    expect(markup).toContain('data-slot="result-icon"');
    expect(markup).toMatch(/data-slot="result-icon"[\s\S]*?aria-hidden="true"/);
  });
});

describe("result -- token + CSP hygiene", () => {
  test("no hardcoded hex and no inline script/handler", () => {
    expect(markup).not.toMatch(/#[0-9a-fA-F]{3,6}/);
    expect(src).not.toMatch(/<script/i);
    expect(markup).not.toMatch(/\son[a-z]+=/i);
  });
});
