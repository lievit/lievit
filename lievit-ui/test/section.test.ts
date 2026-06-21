/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * New static JTE LAYOUT primitive: section. The server-first counterpart of shadcn's
 * Card-with-Collapsible + Filament's Section (the schema / infolist container the kit's SectionView
 * renders through). Collapse is a native <details>/<summary> (zero JS, CSP-clean); the initial state
 * is the server's `collapsed` flag.
 *
 * Like the other static-partial suites this Node harness has no JTE compiler, so it asserts on the
 * partial SOURCE as text (the @param API, the data-slot set, the collapsible <details> vs plain
 * <section> branching, the Filament traits, the a11y labelling, token-driven styling, and that no
 * inline script / on* handler / <style> block / hardcoded hex ships). The real-compiler golden runs
 * via `npm run test:jte-compile`.
 */
import { describe, test, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const jteDir = join(import.meta.dirname, "..", "registry", "jte");
const read = (name: string) => readFileSync(join(jteDir, `${name}.jte`), "utf8");

describe("section (server-first JTE layout primitive; shadcn Card+Collapsible / Filament Section)", () => {
  const src = read("section");

  test("ships + registers as a copy-in registry:jte item with a usage-doc comment + @param API", () => {
    expect(existsSync(join(jteDir, "section", "meta.json")), "meta.json so it registers").toBe(true);
    expect(src, "missing <%-- --%> jte comment block").toContain("<%--");
    expect(src, "comment block must close").toContain("--%>");
    expect(src, "must NOT use the @* *@ comment syntax").not.toMatch(/@\*/);
    expect(src, "missing Usage section").toMatch(/Usage:/);
    expect(src, "usage snippet must show the @template call").toContain("@@template.lievit.section(");
    expect(src).toContain("@param gg.jte.Content content");
  });

  test("declares the documented param API: heading + description + content + aside + the 4 Filament traits", () => {
    expect(src).toContain("@param String heading = null");
    expect(src).toContain("@param String headingId");
    expect(src).toContain("@param gg.jte.Content description = null");
    expect(src).toContain("@param gg.jte.Content content");
    expect(src).toContain("@param gg.jte.Content aside = null");
    expect(src).toContain("@param boolean collapsible = false");
    expect(src).toContain("@param boolean collapsed = false");
    expect(src).toContain("@param boolean compact = false");
    expect(src).toContain("@param boolean divided = false");
  });

  test("carries the shadcn data-slot set (section / section-header / section-title / section-description / section-content)", () => {
    expect(src).toContain('data-slot="section"');
    expect(src).toContain('data-slot="section-header"');
    expect(src).toContain('data-slot="section-title"');
    expect(src).toContain('data-slot="section-description"');
    expect(src).toContain('data-slot="section-content"');
  });

  test("collapse is a NATIVE <details>/<summary> driven by the server collapsed flag (zero JS)", () => {
    // collapsible (no aside) => <details open=...> + <summary>; the open state is !collapsed
    expect(src).toContain("var asExpander = collapsible && aside == null;");
    expect(src).toContain("var startOpen = !collapsed;");
    expect(src).toContain("<details");
    expect(src).toContain('open="${startOpen}"');
    expect(src).toContain("<summary");
    // a non-collapsible section is a plain <section> (no disclosure affordance)
    expect(src).toContain("<section");
  });

  test("Filament traits map to server-pure styling: compact padding, divided rule, aside grid", () => {
    expect(src).toContain('var pad = compact ? "var(--lv-space-4)" : "var(--lv-space-6)";');
    expect(src).toContain("divided ? \" border-top: 1px solid var(--lv-color-border);\"");
    expect(src).toContain("aside != null ? \" display: grid; grid-template-columns:");
  });

  test("a11y: a heading makes it a labelled section (aria-labelledby -> the title id)", () => {
    expect(src).toContain("var hasTitle = heading != null && !heading.isBlank();");
    expect(src).toContain('aria-labelledby="${hasTitle ? headingId : null}"');
    expect(src).toContain('id="${headingId}"');
  });

  test("token fidelity (shadcn card): the surface reads the card + border + radius + shadow tokens", () => {
    expect(src).toContain("var(--lv-color-card)");
    expect(src).toContain("var(--lv-color-card-fg)");
    expect(src).toContain("var(--lv-color-border)");
    expect(src).toContain("var(--lv-radius-xl)");
    expect(src).toContain("var(--lv-shadow-sm)");
  });

  test("CSP-clean: no inline script, no on* handler, NO <style> block, no hardcoded hex", () => {
    const markup = src.replace(/<%--[\s\S]*?--%>/g, "");
    expect(src, "leaked a hardcoded hex colour").not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(markup).not.toMatch(/<script/i);
    expect(markup, "no <style> block").not.toMatch(/<style[\s>]/i);
    expect(markup, "inline on* handler (CSP refuses them)").not.toMatch(/\son[a-z]+=/i);
    expect(src.toLowerCase()).not.toMatch(/customelement|litelement|import .*\blit\b/);
  });

  test("Apache header is present", () => {
    expect(src).toContain("Copyright 2026 Francesco Bilotta");
    expect(src).toContain("Apache License");
  });
});
