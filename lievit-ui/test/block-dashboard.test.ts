/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * Dashboard BLOCK (#461). A block is a composition: the canonical analytics-dashboard
 * PATTERN as a JTE template that wires existing lievit-ui pieces (stat cards, <lv-badge>,
 * the Lucide icon partial, <lv-chart>, the composable table set). Like the static-partial
 * suites, the .jte is compiled in the Java world, so this harness asserts on the partial
 * SOURCE as text: it pins the token-driven styling (every colour/space/radius reads a
 * --lv-* var), the accessibility contract (labelled regions + a real <th scope> table),
 * that every datum arrives via @param (no hardcoded business data), that charts are
 * referenced as <lv-chart> islands, that icons go through the Lucide partial (never Font
 * Awesome), and that no inline <script> ships. This is the structural golden the planning
 * DONE criteria asks for; a render/golden in the Java runtime is out of scope for the JS suite.
 */
import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const blockPath = join(import.meta.dirname, "..", "registry", "jte", "blocks", "dashboard.jte");
const src = readFileSync(blockPath, "utf8");

/** Tailwind utilities that legitimately carry a fractional / fixed geometry value. */
const HARDCODE_EXCEPTIONS = /tracking-tight|leading-snug|leading-none|tabular-nums/;

describe("dashboard block (#461) -- shared hygiene", () => {
  test("ships a usage-doc comment with the @param API + a @template call snippet", () => {
    expect(src, "missing jte comment block").toContain("<%--");
    expect(src, "missing Usage section").toMatch(/Usage/);
    expect(src, "usage snippet must show the @template call").toContain("@template.blocks.dashboard(");
    expect(src, "missing param declaration").toMatch(/@param /);
  });

  test("uses block (<%-- --%>) comment syntax for inline notes, never @* *@", () => {
    expect(src).toContain("<%--");
    expect(src).toContain("--%>");
    expect(src, "must NOT use the @* *@ comment syntax").not.toMatch(/@\*/);
  });

  test("never reaches for Font Awesome / wa-icon", () => {
    expect(src.toLowerCase()).not.toMatch(/font-?awesome|wa-icon|fa-/);
  });

  test("no inline <script> and no inline on* handlers", () => {
    expect(src).not.toMatch(/<script/i);
    const inlineHandlers = src.match(/\son[a-z]+=/gi) ?? [];
    expect(inlineHandlers, `unexpected inline handlers: ${inlineHandlers.join(", ")}`).toEqual([]);
  });

  test("contains no em-dashes", () => {
    expect(src).not.toMatch(/—/);
  });

  test("styling is token-driven (no bare hex colours, no raw px spacing)", () => {
    expect(src, "leaked a hardcoded hex colour").not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    // Strip arbitrary-value brackets first (text-[length:var(--lv-text-sm)], p-[var(--lv-space-4)],
    // grid-cols-2, h-1/2) so their inner --lv-* token names + fractions are not mistaken for bare
    // scale utilities. What remains must contain NO Tailwind numeric scale utility: every dimension
    // reads a --lv-* var. Allow the documented geometry exceptions + the responsive grid-cols-N.
    const stripped = src
      .replace(/\[[^\]]*\]/g, "[]")
      .replace(/grid-cols-\d+/g, "")
      .replace(/-\d+\/\d+/g, "")
      .replace(/\bmin-w-0\b/g, "");
    const numericUtils = (stripped.match(/\b(?:p|px|py|pt|pb|pl|pr|m|mx|my|mb|mt|gap|h|w|text|size|space)-[1-9]/g) ?? [])
      .filter((u) => !HARDCODE_EXCEPTIONS.test(u));
    expect(numericUtils, `non-token numeric utilities: ${numericUtils.join(", ")}`).toEqual([]);
  });
});

describe("dashboard block -- data via params, nothing hardcoded", () => {
  test("KPI stats, chart data and table rows are all @param-driven", () => {
    expect(src).toContain("@param List<Map<String, String>> stats");
    expect(src).toContain("@param String chartCategories");
    expect(src).toContain("@param String chartSeries");
    expect(src).toContain("@param List<Map<String, String>> rows");
    expect(src).toContain("@param List<String> rowColumns");
  });

  test("the KPI value/label/delta come from the stat map, not literals", () => {
    expect(src).toContain('stat.getOrDefault("label"');
    expect(src).toContain('stat.getOrDefault("value"');
    expect(src).toContain('stat.getOrDefault("delta"');
    // the big value is rendered from the derived variable, never a hardcoded number/currency
    expect(src).toContain("${value}");
    expect(src).not.toMatch(/\$\s?1[,.]250|\b45,678\b|Total Revenue|New Customers/);
  });

  test("the chart data attributes interpolate the params, no inline literal arrays", () => {
    expect(src).toContain('categories="${chartCategories}"');
    expect(src).toContain('series="${chartSeries}"');
  });

  test("the table loops the caller's columns + rows, no hardcoded cells", () => {
    expect(src).toContain("@for(String col : rowColumns)");
    expect(src).toContain("@for(Map<String, String> row : rows)");
    expect(src).toContain('row.getOrDefault("c" + c');
  });
});

describe("dashboard block -- composes existing components", () => {
  test("stat-card delta uses the <lv-badge> island", () => {
    expect(src).toContain("<lv-badge");
  });

  test("the trend arrow goes through the Lucide icon partial", () => {
    expect(src).toContain("@template.icon(name = iconName");
    // the up/down arrow is derived from the delta sign, using vendored Lucide icons
    expect(src).toMatch(/arrow-down/);
    expect(src).toMatch(/arrow-up/);
  });

  test("references one or more <lv-chart> islands for the charts row", () => {
    expect(src).toContain("<lv-chart");
    expect(src).toMatch(/type="\$\{chartType\}"/);
  });

  test("the recent-items table is built from the composable table partial set", () => {
    expect(src).toContain("@template.table(");
    expect(src).toContain("@template.table.header(");
    expect(src).toContain("@template.table.body(");
    expect(src).toContain("@template.table.head(");
    expect(src).toContain("@template.table.cell(");
  });
});

describe("dashboard block -- accessibility", () => {
  test("each stat card is a labelled region", () => {
    expect(src).toContain('role="region"');
    expect(src).toMatch(/aria-labelledby="\$\{regionId\}"/);
  });

  test("the KPI row groups its cards under a (visually hidden) heading", () => {
    expect(src).toContain('aria-labelledby="lv-dashboard-kpis-title"');
    expect(src).toMatch(/sr-only/);
  });

  test("the table exposes proper column headers via <th scope>", () => {
    // table.head defaults scope="col"; the dashboard composes that part for headers
    expect(src).toContain("@template.table.head(");
    const headPartial = readFileSync(
      join(import.meta.dirname, "..", "registry", "jte", "table", "head.jte"),
      "utf8"
    );
    expect(headPartial).toContain('scope="${scope}"');
    expect(headPartial).toContain('@param String scope = "col"');
  });

  test("section headings give the block a document outline and rank-nest under the page", () => {
    expect(src).toContain("@param int headingLevel");
    // JTE forbids expressions in HTML tag names (<${hTag}> does not compile), so the
    // configurable heading rank is expressed via the WAI-ARIA heading role + aria-level,
    // computed from headingLevel. This keeps the dynamic outline AND compiles.
    expect(src).toContain('var hLevel = Math.min(Math.max(headingLevel, 2), 5);');
    expect(src).toContain('var subLevel = Math.min(hLevel + 1, 6);');
    expect(src).toContain('role="heading" aria-level="${hLevel}"');
    expect(src).toContain('role="heading" aria-level="${subLevel}"');
    // never reintroduce the non-compiling dynamic tag name.
    expect(src, "dynamic <${hTag}> tag name does not compile in JTE").not.toMatch(/<\/?\$\{/);
  });
});
