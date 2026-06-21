/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * New static JTE partial (shadcn display/nav coverage): scroll-area. shadcn/ui's Scroll Area was
 * `missing` in the coverage audit; this ships a server-first, CSP-clean counterpart with a
 * token-styled native scrollbar, the four shadcn `type` modes, and the three orientations.
 *
 * Like the other static-partial suites this Node harness has no JTE compiler, so it asserts on the
 * partial SOURCE as text (the @param API, the type-mode -> scrollbar mapping, the orientation ->
 * overflow mapping, the a11y region/tabindex, token-driven styling, and that no inline script /
 * on* handler / <style> block ships). The real-compiler golden runs via `npm run test:jte-compile`.
 */
import { describe, test, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const jteDir = join(import.meta.dirname, "..", "registry", "jte");
const read = (name: string) => readFileSync(join(jteDir, `${name}.jte`), "utf8");

describe("scroll-area (server-first JTE partial; shadcn Scroll Area, previously missing)", () => {
  const src = read("scroll-area");

  test("ships + registers as a copy-in registry:jte item with a usage-doc comment + @param API", () => {
    expect(existsSync(join(jteDir, "scroll-area", "meta.json")), "meta.json so it registers").toBe(true);
    expect(src, "missing <%-- --%> jte comment block").toContain("<%--");
    expect(src, "comment block must close").toContain("--%>");
    expect(src, "must NOT use the @* *@ comment syntax").not.toMatch(/@\*/);
    expect(src, "missing Usage section").toMatch(/Usage:/);
    expect(src, "usage snippet must show the @template call").toContain("@@template.lievit.scroll-area(");
    expect(src).toContain("@param gg.jte.Content content");
  });

  test("declares the documented param API: content + orientation + type + label + maxHeight", () => {
    expect(src).toContain("@param gg.jte.Content content");
    expect(src).toContain("@param String orientation");
    expect(src).toContain("@param String type");
    expect(src).toContain("@param String label");
    expect(src).toContain("@param String maxHeight");
  });

  test("orientation maps to per-axis overflow (vertical default; horizontal; both)", () => {
    expect(src).toContain('var horizontal = "horizontal".equals(orientation);');
    expect(src).toContain('var both = "both".equals(orientation);');
    expect(src).toContain("var overflowX = horizontal || both ? \"auto\" : \"hidden\";");
    expect(src).toContain('var overflowY = horizontal ? "hidden" : "auto";');
    expect(src).toContain("overflow-x: ${overflowX}; overflow-y: ${overflowY}");
  });

  test("the four shadcn type modes drive scrollbar gutter + thumb visibility", () => {
    // always/hover/scroll reserve the gutter; hover/scroll start the thumb transparent
    expect(src).toContain('var reserveGutter = "always".equals(type) || "hover".equals(type) || "scroll".equals(type);');
    expect(src).toContain('var hideThumb = "hover".equals(type) || "scroll".equals(type);');
    expect(src).toContain('var thumbColor = hideThumb ? "transparent transparent" : "var(--lv-color-border) transparent";');
    expect(src).toContain("scrollbar-gutter: stable;");
  });

  test("uses the STANDARDISED scrollbar-* properties (no JS scrollbar, thumb reads the border token)", () => {
    expect(src).toContain("scrollbar-width: thin;");
    expect(src).toContain("scrollbar-color: ${thumbColor};");
    expect(src).toContain("var(--lv-color-border)");
  });

  test("a11y: a focusable scroll container, a named role=region only when label is set", () => {
    expect(src).toContain('tabindex="0"');
    expect(src).toContain('role="${hasLabel ? "region" : null}"');
    expect(src).toContain('aria-label="${label}"');
    expect(src).toContain("focus-visible:shadow-[var(--lv-ring)]");
  });

  test("CSP-clean + kit-consistent: no inline script, no on* handler, NO <style> block, no hardcoded hex", () => {
    const markup = src.replace(/<%--[\s\S]*?--%>/g, "");
    expect(src, "leaked a hardcoded hex colour").not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(markup).not.toMatch(/<script/i);
    expect(markup, "no <style> block (kept consistent with the rest of the kit)").not.toMatch(/<style[\s>]/i);
    expect(markup, "inline on* handler (CSP refuses them)").not.toMatch(/\son[a-z]+=/i);
    expect(src.toLowerCase()).not.toMatch(/customelement|litelement|adoptlightstyles|import .*\blit\b/);
  });
});
