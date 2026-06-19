/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * Block: app-shell (issue #460). The canonical authenticated-application shell, expressed
 * as a JTE BLOCK -- a composition of EXISTING lievit-ui components (<lv-sidebar>,
 * <lv-dropdown-menu>, the avatar + input-group partials, the breadcrumb slot), not a new
 * primitive. As with the static-partials suites, this block is compiled in the Java world,
 * so the harness asserts on the block SOURCE as text: it pins the token-driven styling
 * (every colour/space/radius reads a --lv-* var, never a hardcoded value), the WAI-ARIA
 * landmark structure (skip-link + <header> + the sidebar's <nav> + <main>), the param API
 * (data DOWN, no hardcoded menu items), that it COMPOSES the islands rather than rebuilding
 * them, that icons route through the Lucide partial (never Font Awesome), and the correct
 * comment syntax (<%-- --%>, not @* *@). A Java-runtime render/golden is out of scope for
 * the JS suite; this is the structural golden the planning DONE criteria asks for.
 */
import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const blockPath = join(import.meta.dirname, "..", "registry", "jte", "blocks", "app-shell.jte");
const src = readFileSync(blockPath, "utf8");

/** The rendered markup only: strip the <%-- --%> usage-doc comment, which legitimately
 *  MENTIONS `<script type="application/json">` data payloads in prose/usage snippets. The
 *  "no inline script" hygiene applies to what the template EMITS, not to its documentation. */
const body = src.replace(/<%--[\s\S]*?--%>/g, "");

/** Tailwind utilities that legitimately carry a fixed geometry value. */
const HARDCODE_EXCEPTIONS = /tracking-tight|leading-snug|leading-none|space-x-2/;

describe("block app-shell -- hygiene", () => {
  test("ships with a usage-doc comment (<%-- --%> syntax) carrying the @param API + a call snippet", () => {
    expect(src, "missing <%-- --%> jte comment block").toContain("<%--");
    expect(src, "comment block must close").toContain("--%>");
    expect(src, "must NOT use the @* *@ comment syntax").not.toMatch(/@\*/);
    expect(src, "missing Usage section").toMatch(/Usage:/);
    expect(src, "usage snippet must show the @@template call").toContain("@@template.blocks.app-shell(");
    expect(src, "missing param declaration").toMatch(/@param /);
  });

  test("never reaches for Font Awesome / wa-icon", () => {
    expect(src.toLowerCase()).not.toMatch(/font-?awesome|wa-icon|fa-/);
  });

  test("emits no inline <script> and no inline on* handlers (CSP-safe)", () => {
    expect(body, "rendered markup must not inline a <script>").not.toMatch(/<script/i);
    const inlineHandlers = body.match(/\son[a-z]+=/gi) ?? [];
    expect(inlineHandlers, `unexpected inline handlers: ${inlineHandlers.join(", ")}`).toEqual([]);
  });

  test("every icon goes through the Lucide partial (no raw inline <svg>)", () => {
    const rawSvg = body.match(/<svg\b/gi) ?? [];
    expect(rawSvg, "raw <svg> found; route icons through @template.icon").toEqual([]);
    expect(src, "must use the Lucide icon partial").toContain("@template.icon(");
  });

  test("styling is token-driven (no bare hex colours, no raw px spacing)", () => {
    expect(src, "leaked a hardcoded hex colour").not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    // Strip arbitrary-value brackets (h-[var(--lv-space-16)], text-[length:var(--lv-text-sm)])
    // and fractions so their inner token names / fractions are not mistaken for scale utilities.
    // What remains must contain NO Tailwind numeric scale utility: every dimension reads a --lv-* var.
    const stripped = src
      .replace(/\[[^\]]*\]/g, "[]")
      .replace(/-\d+\/\d+/g, "")
      .replace(/\bmin-w-0\b/g, ""); // min-w-0 == min-width:0, a dimensionless layout primitive
    const numericUtils = (stripped.match(/\b(?:p|px|py|pt|pb|pl|pr|m|mx|my|mb|mt|gap|h|w|text|size|space)-[1-9]/g) ?? [])
      .filter((u) => !HARDCODE_EXCEPTIONS.test(u));
    expect(numericUtils, `non-token numeric utilities: ${numericUtils.join(", ")}`).toEqual([]);
  });
});

describe("block app-shell -- composition (no rebuild)", () => {
  test("is built AROUND the <lv-sidebar> island for navigation", () => {
    expect(body).toMatch(/<lv-sidebar\b/);
    // the sidebar IS the page's <nav>; the block must not also hand-roll a <nav> landmark
    expect(body, "the sidebar island owns the <nav> landmark; do not duplicate it").not.toMatch(/<nav\b/);
  });

  test("composes the <lv-dropdown-menu> island for the user menu", () => {
    expect(body).toMatch(/<lv-dropdown-menu\b/);
  });

  test("composes the existing avatar + input-group partials (not reimplemented)", () => {
    expect(src).toContain("@template.avatar(");
    expect(src).toContain("@template.input-group(");
  });

  test("accepts a breadcrumb slot rather than rebuilding a breadcrumb here", () => {
    expect(src).toContain("@param gg.jte.Content breadcrumb");
  });
});

describe("block app-shell -- data down (no hardcoded nav data)", () => {
  test("navigation groups arrive via a param, never hardcoded in the block", () => {
    expect(src, "nav data must be a param").toContain("@param gg.jte.Content navGroups");
    // the block must pass nav data DOWN to the island, not enumerate items itself
    expect(body, "nav data must be slotted into the sidebar, not inlined").toContain("${navGroups}");
  });

  test("the user-menu items arrive via a param too", () => {
    expect(src).toContain("@param gg.jte.Content userMenu");
    expect(body).toContain("${userMenu}");
  });

  test("the user, app name, page title and active nav are all parameters", () => {
    for (const p of [
      "@param String appName",
      "@param String userName",
      "@param String pageTitle",
      "@param String activeNav",
      "@param gg.jte.Content content",
    ]) {
      expect(src).toContain(p);
    }
  });
});

describe("block app-shell -- a11y landmark structure", () => {
  test("a skip-link is the first focusable, targeting the main region", () => {
    const skipIdx = body.indexOf("Skip to main content");
    expect(skipIdx, "missing skip-to-main link").toBeGreaterThan(-1);
    expect(body).toMatch(/href="#\$\{mainId\}"/);
    // the skip-link precedes the header in DOM order so it is reachable first
    expect(skipIdx).toBeLessThan(body.indexOf("<header"));
  });

  test("exposes the <header> banner and the <main> content landmarks", () => {
    expect(body).toMatch(/<header\b/);
    expect(body).toMatch(/<main\b/);
    // the main carries an id so the skip-link can target it, and a page <h1>
    expect(body).toMatch(/<main[^>]*id="\$\{mainId\}"/);
    expect(body).toMatch(/<h1\b/);
  });

  test("the navigation landmark comes from the sidebar island, not a duplicate <nav>", () => {
    // already pinned in composition; restated here as the landmark contract
    expect(body).toMatch(/<lv-sidebar\b/);
    expect(body).not.toMatch(/<nav\b/);
  });

  test("the sidebar toggle names + controls the sidebar (aria-controls + aria-expanded)", () => {
    expect(body).toMatch(/data-lv-sidebar-toggle/);
    expect(body).toMatch(/aria-controls="\$\{sidebarId\}"/);
    expect(body).toMatch(/aria-expanded=/);
    expect(body).toMatch(/aria-label="Toggle navigation sidebar"/);
  });

  test("focus-visible ring on interactive chrome reads the --lv-ring token", () => {
    expect(body).toContain("focus-visible:shadow-[var(--lv-ring)]");
  });
});
