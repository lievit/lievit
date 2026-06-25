/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * grid/row.jte + grid/col.jte -- structural + CSP contract (source-text asserts; real-compiler
 * smoke in test/jte-compile). Pins the 24-column CSS-grid math expressed via INLINE style (so no
 * dynamic Tailwind col-span-* class a scanner would purge), the gutter token scale, span/offset,
 * and CSP hygiene.
 */
import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const gridDir = join(import.meta.dirname, "..", "registry", "jte", "grid");
const row = readFileSync(join(gridDir, "row.jte"), "utf8");
const col = readFileSync(join(gridDir, "col.jte"), "utf8");
const rowMarkup = row.replace(/<%--[\s\S]*?--%>/g, "");
const colMarkup = col.replace(/<%--[\s\S]*?--%>/g, "");

describe("grid.row -- 24-column container", () => {
  test("declares gutter/justify/align params", () => {
    expect(row).toContain('@param String gutter = "middle"');
    expect(row).toContain('@param String justify = "start"');
    expect(row).toContain('@param String align = "stretch"');
  });
  test("renders a CSS grid with 24 tracks via inline style (not dynamic Tailwind classes)", () => {
    expect(rowMarkup).toContain("grid-template-columns:repeat(24,minmax(0,1fr))");
    expect(rowMarkup).toContain('data-slot="grid-row"');
  });
  test("gutter keyword maps onto the token scale", () => {
    expect(row).toContain("var(--lv-space-4)");
    expect(row).toContain("gutterToken != null ? gutterToken : gutter");
  });
});

describe("grid.col -- span + offset cell", () => {
  test("declares span/offset int params", () => {
    expect(col).toContain("@param int span = 24");
    expect(col).toContain("@param int offset = 0");
  });
  test("clamps span to 1..24", () => {
    expect(col).toContain("Math.max(1, Math.min(24, span))");
  });
  test("offset pins an explicit start track; no offset uses the span shorthand", () => {
    expect(col).toContain("grid-column:");
    expect(col).toContain("(offset + 1)");
    expect(col).toContain("span ");
  });
  test("renders data-slot=grid-col with the clamped span", () => {
    expect(colMarkup).toContain('data-slot="grid-col"');
    expect(colMarkup).toContain('data-span="${clampedSpan}"');
  });
});

describe("grid -- CSP hygiene", () => {
  test("no inline script/handler in either file", () => {
    for (const s of [row, col]) {
      expect(s).not.toMatch(/<script/i);
    }
    expect(rowMarkup).not.toMatch(/\son[a-z]+=/i);
    expect(colMarkup).not.toMatch(/\son[a-z]+=/i);
  });
});
