/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * Static JTE partials, Wave 4 SERVER-heavy (ADR-0012 server-first pivot): the two genuinely
 * client-leaning islands converted to server-rendered partials --
 *   - chart       -> a static inline-SVG bar chart emitted from typed @param data (no JS, no
 *                    canvas, no client charting lib). The interactive chart is an escape-hatch.
 *   - date-picker -> the native <input type="date"> (the browser owns the calendar/keyboard/locale).
 * Their Lit islands (registry/components/{chart,date-picker}) were deleted; these partials are the
 * to-be form.
 *
 * Like static-partials-w1a, this Node harness has no JTE compiler, so it asserts on the partial
 * SOURCE as text: it pins the token-driven styling (every colour reads a --lv-* var, never a
 * hardcoded hex), the rendered structure (the <svg role=img> + one shape per datum + axis labels;
 * the native date input with name/value/min/max/required wired + label association), the @param
 * API, the JTE comment syntax, and that no inline <script> / on* handler ships (the strict CSP
 * refuses them -- the regression class that motivated the pivot). The real-compiler golden runs
 * out of band via `npm run test:jte-compile` (gg.jte 3.2.4 precompileAll).
 */
import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const jteDir = join(import.meta.dirname, "..", "registry", "jte");
const read = (name: string) => readFileSync(join(jteDir, `${name}.jte`), "utf8");
/** A multi-part component's sub-partial (e.g. chart/legend.jte). */
const readSub = (component: string, part: string) =>
  readFileSync(join(jteDir, component, `${part}.jte`), "utf8");
/** The rendered MARKUP only: the doc comment may NAME the dropped tech for provenance. */
const markupOf = (src: string) => src.replace(/<%--[\s\S]*?--%>/g, "");

const PARTIALS = ["chart", "date-picker"];

describe("static partials w4 -- shared hygiene", () => {
  for (const name of PARTIALS) {
    const src = read(name);

    test(`${name}: ships and carries a usage-doc comment (<%-- --%> syntax) with the @param API + a call snippet`, () => {
      expect(src, "missing <%-- --%> jte comment block").toContain("<%--");
      expect(src, "comment block must close").toContain("--%>");
      expect(src, "must NOT use the @* *@ comment syntax").not.toMatch(/@\*/);
      expect(src, "missing Usage section").toMatch(/Usage:/);
      expect(src, "usage snippet must show the @template call").toContain(`@@template.lievit.${name}(`);
      expect(src, "missing param declaration").toMatch(/@param /);
    });

    test(`${name}: no inline <script> and ZERO inline on* handlers (strict CSP refuses them)`, () => {
      expect(src).not.toMatch(/<script/i);
      const inlineHandlers = src.match(/\son[a-z]+=/gi) ?? [];
      expect(inlineHandlers, `unexpected inline handlers: ${inlineHandlers.join(", ")}`).toEqual([]);
    });

    test(`${name}: no Lit residue in the markup (server-first, no island)`, () => {
      // The island is gone; the partial must not reach back into Lit. (The doc comment may
      // still NAME the removed <lv-*> island for provenance, so we check Lit code, not prose.)
      expect(src.toLowerCase()).not.toMatch(/customelement|litelement|adoptlightstyles|import .*\blit\b/);
    });

    test(`${name}: documents the escape-hatch seam (interactive/rich variant is opt-in, not shipped)`, () => {
      expect(src.toLowerCase()).toContain("escape-hatch");
    });
  }
});

describe("chart (server-rendered static SVG bar chart)", () => {
  const src = read("chart");

  test("typed data params: a String[] of categories, an int[] of values, an accessible label", () => {
    expect(src).toContain("@param String label");
    expect(src).toContain("@param String[] categories");
    expect(src).toContain("@param int[] values");
  });

  test("emits a server-rendered <svg role=img> with the accessible label and an in-SVG <title>", () => {
    expect(src).toMatch(/<svg\b/);
    expect(src).toContain('role="img"');
    expect(src).toContain('aria-label="${label}"');
    expect(src).toContain("<title>${label}</title>");
  });

  test("renders one bar (<rect>) per data point, looping the values array", () => {
    expect(src).toMatch(/@for\(int i = 0; i < values\.length; i\+\+\)/);
    expect(src).toMatch(/<rect\b/);
    expect(src).toContain('data-slot="chart-bar"');
    // each bar carries its own aria-label so the datum is reachable
    expect(src).toContain('aria-label="${cat}: ${v}"');
  });

  test("shadcn fidelity: the per-bar <rect> does NOT nest role=img inside the parent svg role=img", () => {
    // The accessible name stays per bar (aria-label); the redundant child role is dropped
    // (a nested role=img inside a role=img graphic, issue #463 ⑦). Only the <svg> carries the role.
    const rect = markupOf(src).match(/<rect[\s\S]*?<\/rect>/)?.[0] ?? "";
    expect(rect, "rect block not found").not.toBe("");
    expect(rect, "child <rect> must not carry its own role").not.toContain("role=");
    expect(rect, "the per-bar aria-label is kept").toContain('aria-label="${cat}: ${v}"');
    // the parent svg still owns the single img role
    expect(markupOf(src)).toContain('role="img"');
  });

  test("axis: category labels render under the plot (and are aria-hidden, not double-announced)", () => {
    expect(src).toContain("@param boolean showAxis");
    expect(src).toMatch(/<text\b/);
    expect(src).toMatch(/@if\(showAxis\)/);
    expect(src).toContain('aria-hidden="true"');
  });

  test("bar fill defaults to a --lv-color-chart token and stays token-driven (no JS, no canvas)", () => {
    expect(src).toContain('@param String color = "var(--lv-color-chart-1)"');
    // check the MARKUP (the doc comment names <canvas> only to say it is NOT used)
    expect(markupOf(src).toLowerCase()).not.toContain("<canvas");
    expect(src, "leaked a hardcoded hex colour").not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    // structural colours read tokens
    expect(src).toContain("var(--lv-color-border)");
    expect(src).toContain("var(--lv-color-muted)");
  });

  test("type param selects the geometry: bar (default) | line | area | pie", () => {
    expect(src).toContain('@param String type = "bar"');
    // each variant is branched on in the markup
    expect(src).toContain('"pie".equals(type)');
    expect(src).toContain('"line".equals(type)');
    expect(src).toContain('"area".equals(type)');
  });

  test("line variant: a server-computed <polyline> through the points + per-datum <circle> with aria-label", () => {
    expect(src).toMatch(/<polyline\b/);
    expect(src).toContain('data-slot="chart-line"');
    expect(src).toMatch(/<circle\b/);
    expect(src).toContain('data-slot="chart-point"');
    // the data point keeps the reachable per-datum aria-label
    expect(src).toContain('aria-label="${cat}: ${v}"');
    // the decorative line itself is aria-hidden (datum is announced on the point)
    expect(markupOf(src)).toMatch(/data-slot="chart-line"[\s\S]*?aria-hidden="true"/);
  });

  test("area variant: a filled <polygon> closed to the baseline, token fill, aria-hidden chrome", () => {
    expect(src).toMatch(/<polygon\b/);
    expect(src).toContain('data-slot="chart-area"');
    // the area fill is the same token-driven series colour
    expect(markupOf(src)).toMatch(/data-slot="chart-area"[\s\S]*?fill="\$\{color\}"/);
  });

  test("pie variant: one server-computed arc <path> per slice, palette-cycled, per-slice aria-label", () => {
    expect(src).toMatch(/<path\b/);
    expect(src).toContain('data-slot="chart-slice"');
    // the SVG arc command is computed in Java, not hardcoded
    expect(src).toContain('" A "');
    // pie cycles the five-step --lv-color-chart-N palette
    expect(src).toContain("var(--lv-color-chart-5)");
    expect(src).toMatch(/palette\[i % palette\.length\]/);
    // each slice is reachable
    expect(markupOf(src)).toMatch(/data-slot="chart-slice"[\s\S]*?aria-label="\$\{cat\}: \$\{v\}"/);
  });

  test("legend: an opt-in static legend sub-part is wired (data-slot chart-legend), aria-hidden swatch", () => {
    expect(src).toContain("@param boolean showLegend = false");
    expect(src).toMatch(/@if\(showLegend\)/);
    expect(src).toContain("@template.lievit.chart.legend(");
    // the legend partial itself
    const legend = readSub("chart", "legend");
    expect(legend, "legend missing Apache header").toContain("Apache License");
    expect(legend).toContain('data-slot="chart-legend"');
    expect(legend).toContain('data-slot="chart-legend-swatch"');
    // the swatch is decorative (the datum is already announced by the chart's role=img)
    expect(legend).toMatch(/data-slot="chart-legend-swatch"[\s\S]*?aria-hidden="true"/);
    // token-driven, no hardcoded hex, no inline script / on* handler
    expect(legend, "leaked a hardcoded hex colour").not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(legend).not.toMatch(/<script/i);
    expect(legend.match(/\son[a-z]+=/gi) ?? []).toEqual([]);
    expect(legend).toContain("var(--lv-color-muted-fg)");
  });
});

describe("date-picker (native <input type=date>)", () => {
  const src = read("date-picker");

  test("declares the documented param API (name/value/min/max/required/label)", () => {
    expect(src).toContain("@param String name");
    expect(src).toContain("@param String value");
    expect(src).toContain("@param String min");
    expect(src).toContain("@param String max");
    expect(src).toContain("@param boolean required");
    expect(src).toContain("@param String label");
  });

  test("renders the NATIVE date control (browser owns the calendar; no role=grid island)", () => {
    expect(src).toContain('type="date"');
    // check the MARKUP (the doc comment names role=grid / @floating-ui only to say they are gone)
    const markup = markupOf(src).toLowerCase();
    expect(markup).not.toContain('role="grid"');
    expect(markup).not.toContain("floating-ui");
  });

  test("wires name/value/min/max/required onto the native input", () => {
    expect(src).toContain('name="${name}"');
    expect(src).toContain('value="${value}"');
    expect(src).toContain('min="${min}"');
    expect(src).toContain('max="${max}"');
    expect(src).toContain('required="${required}"');
  });

  test("label is associated to the input via for=id (clicking the label focuses the control)", () => {
    expect(src).toContain('for="${inputId}"');
    expect(src).toContain('id="${inputId}"');
    expect(src).toMatch(/@if\(hasLabel\)/);
  });

  test("invalid toggles aria-invalid; the control + ring read tokens (no hardcoded hex)", () => {
    expect(src).toContain('aria-invalid="${invalid ? "true" : null}"');
    expect(src).toContain("border-[var(--lv-color-input)]");
    expect(src).toContain("focus-visible:shadow-[var(--lv-ring)]");
    expect(src, "leaked a hardcoded hex colour").not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  test("shadcn fidelity: invalid border uses the destructive token (not the legacy danger alias)", () => {
    // issue #463 ② -- the variant token is --lv-color-destructive library-wide.
    expect(src).toContain("aria-[invalid=true]:border-[var(--lv-color-destructive)]");
    expect(src).toContain("text-[var(--lv-color-destructive)]"); // the required-marker asterisk
    expect(src, "the legacy danger alias must be gone").not.toContain("--lv-color-danger");
  });

  test("shadcn fidelity: control baseline height is the 36px h-9 token (--lv-space-9)", () => {
    // issue #463 ④ -- the shadcn-faithful compact baseline (h-9), not the old 40px space-10.
    expect(src).toContain("h-[var(--lv-space-9)]");
    expect(src).not.toContain("h-[var(--lv-space-10)]");
  });

  test("binds to a wire field via l:model (the live cases) and POSTs the ISO date under name", () => {
    expect(src).toContain('l:model="${model}"');
  });

  test("mode param defaults to single; range mode is the documented alternative", () => {
    expect(src).toContain('@param String mode = "single"');
    expect(src).toContain('"range".equals(mode)');
  });

  test("range mode: a paired from/to control, role=group with a shared aria-label, native min/max keeps from<=to", () => {
    expect(src).toMatch(/@if\(isRange\)/);
    expect(src).toContain('data-slot="date-picker-range"');
    expect(src).toContain('role="group"');
    expect(src).toContain('aria-label="${groupName}"');
    // two bound native inputs, each its own data-slot
    expect(src).toContain('data-slot="date-picker-input-from"');
    expect(src).toContain('data-slot="date-picker-input-to"');
    expect(src).toContain('type="date"');
    // the from/to inputs POST under name / nameTo
    expect(src).toContain('@param String nameTo = null');
    expect(src).toContain('name="${toName}"');
    expect(src).toContain('@param String valueTo = null');
    expect(src).toContain('value="${valueTo}"');
    // native constraint: from.max defaults to the to value, to.min defaults to the from value
    expect(src).toContain('max="${valueTo != null ? valueTo : max}"');
    expect(src).toContain('min="${value != null ? value : min}"');
    // each input keeps a per-input aria-label suffix (from / to)
    expect(src).toContain('aria-label="${groupName} ${fromLabel}"');
    expect(src).toContain('aria-label="${groupName} ${toLabel}"');
    // the second input can bind its own wire field
    expect(src).toContain('l:model="${modelTo}"');
  });

  test("range mode stays token-driven (no hardcoded hex) and CSP-clean (no script / on* handler)", () => {
    // the shared input chrome is one token-driven declaration reused by every input
    expect(src).toContain("border-[var(--lv-color-input)]");
    expect(src).toContain("var(--lv-color-muted-fg)"); // the range separator
    expect(src, "leaked a hardcoded hex colour").not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});
