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

  test("binds to a wire field via l:model (the live cases) and POSTs the ISO date under name", () => {
    expect(src).toContain('l:model="${model}"');
  });
});
