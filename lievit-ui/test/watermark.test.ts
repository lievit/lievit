/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * watermark.jte -- structural + a11y + CSP contract (source-text asserts; real-compiler smoke in
 * test/jte-compile). Pins the CSP-clean tiled-DOM approach (no canvas, no script, no data-URI),
 * the non-interactive + unselectable overlay, the aria-hidden decoration, and the tiling loop.
 */
import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const src = readFileSync(join(import.meta.dirname, "..", "registry", "jte", "watermark.jte"), "utf8");
const markup = src.replace(/<%--[\s\S]*?--%>/g, "");

describe("watermark -- param API", () => {
  test("declares text/count/rotate/opacity/color/gap", () => {
    expect(src).toContain('@param String text = "lievit"');
    expect(src).toContain("@param int count = 60");
    expect(src).toContain("@param double rotate = -22");
    expect(src).toContain("@param double opacity = 0.10");
  });
});

describe("watermark -- CSP-clean tiled DOM (the whole point)", () => {
  test("never uses a <canvas>, a <script>, or a data: URI (Ant's JS approach forbidden by CSP)", () => {
    expect(src).not.toMatch(/<script/i);
    expect(markup).not.toMatch(/<canvas/i);
    expect(markup).not.toMatch(/data:/i);
  });
  test("tiles the mark as real DOM spans via a bounded loop", () => {
    expect(markup).toContain("@for(int i = 0; i < clampedCount; i++)");
    expect(markup).toContain('data-slot="watermark-mark"');
    expect(src).toContain("Math.max(0, Math.min(400, count))");
  });
});

describe("watermark -- a11y + non-interaction", () => {
  test("the overlay is aria-hidden, pointer-events:none and user-select:none", () => {
    expect(markup).toMatch(/data-slot="watermark-overlay"[\s\S]*?aria-hidden="true"/);
    expect(markup).toContain("pointer-events-none");
    expect(markup).toContain("select-none");
  });
  test("the content underneath is rendered untouched in its own slot", () => {
    expect(markup).toContain('data-slot="watermark-content"');
    expect(markup).toContain("${content}");
  });
});

describe("watermark -- token + CSP hygiene", () => {
  test("no hardcoded hex and no inline handler", () => {
    expect(markup).not.toMatch(/#[0-9a-fA-F]{3,6}/);
    expect(markup).not.toMatch(/\son[a-z]+=/i);
  });
});
