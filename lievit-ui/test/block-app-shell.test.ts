/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * Block: app-shell (issue #460). The canonical authenticated-application shell, expressed
 * as a JTE BLOCK -- a composition of the SERVER-FIRST lievit-ui partials (ADR-0012, Wave 4):
 * the sidebar partial for navigation, the dropdown-menu partial for the user menu, the
 * breadcrumb / avatar / input-group partials for the header. The former Lit-island tags
 * (<lv-sidebar>, <lv-dropdown-menu>) are GONE; every island is now a @template.* composition
 * rendered on the server, data DOWN via typed @param. The .jte is compiled in the Java world,
 * so the harness asserts on the block SOURCE as text: it pins the token-driven styling, the
 * WAI-ARIA landmark structure (skip-link + <header> + the sidebar partial's <nav> + <main>),
 * the param API (typed nav/menu data DOWN, no hardcoded items), that it COMPOSES the partials
 * (and emits NO custom-element <lv-*> tag), and the correct comment syntax (<%-- --%>).
 */
import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const blockPath = join(import.meta.dirname, "..", "registry", "jte", "blocks", "app-shell.jte");
const src = readFileSync(blockPath, "utf8");

/** The rendered markup only: strip the <%-- --%> usage-doc comment. The "no inline script"
 *  and "no island tag" hygiene applies to what the template EMITS, not to its documentation. */
const body = src.replace(/<%--[\s\S]*?--%>/g, "");

/** Tailwind utilities that legitimately carry a fixed geometry value. */
const HARDCODE_EXCEPTIONS = /tracking-tight|leading-snug|leading-none|space-x-2/;

describe("block app-shell -- hygiene", () => {
  test("ships with a usage-doc comment (<%-- --%> syntax) carrying the @param API + a call snippet", () => {
    expect(src, "missing <%-- --%> jte comment block").toContain("<%--");
    expect(src, "comment block must close").toContain("--%>");
    expect(src, "must NOT use the @* *@ comment syntax").not.toMatch(/@\*/);
    expect(src, "missing Usage section").toMatch(/Usage/);
    expect(src, "usage snippet must show the @@template call").toContain("@@template.lievit.blocks.app-shell(");
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
    expect(src, "must use the Lucide icon partial").toContain("@template.lievit.icon(");
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

describe("block app-shell -- server-first composition (ADR-0012: no island tags)", () => {
  test("emits NO Lit-island custom-element tag (the pivot dropped them)", () => {
    const islandTags = body.match(/<lv-[a-z-]+/gi) ?? [];
    expect(islandTags, `island tags must be gone: ${islandTags.join(", ")}`).toEqual([]);
    // explicitly: the two former islands this block mounted
    expect(body, "<lv-sidebar> island must be replaced by the sidebar partial").not.toMatch(/<lv-sidebar\b/);
    expect(body, "<lv-dropdown-menu> island must be replaced by the dropdown-menu partial").not.toMatch(/<lv-dropdown-menu\b/);
  });

  test("navigation is the SIDEBAR partial, composed from sidebar group/item sub-partials", () => {
    expect(body, "must compose the sidebar partial").toMatch(/@template\.lievit\.sidebar\(/);
    expect(body, "groups come from the sidebar.group sub-partial").toContain("@template.lievit.sidebar.group(");
    expect(body, "items come from the sidebar.item sub-partial").toContain("@template.lievit.sidebar.item(");
  });

  test("the user menu is the DROPDOWN-MENU partial, composed from its item/separator sub-partials", () => {
    expect(body, "must compose the dropdown-menu partial").toMatch(/@template\.lievit\.dropdown-menu\(/);
    expect(body, "menu entries come from dropdown-menu.item").toContain("@template.lievit.dropdown-menu.item(");
    expect(body, "dividers come from dropdown-menu.separator").toContain("@template.lievit.dropdown-menu.separator(");
  });

  test("the header trail is the BREADCRUMB partial (not rebuilt here)", () => {
    expect(body, "must compose the breadcrumb partial").toMatch(/@template\.lievit\.breadcrumb\(/);
  });

  test("composes the existing avatar + input-group partials (not reimplemented)", () => {
    expect(src).toContain("@template.lievit.avatar(");
    expect(src).toContain("@template.lievit.input-group(");
  });
});

describe("block app-shell -- data down (typed params, no hardcoded nav data)", () => {
  test("navigation groups arrive as typed data, iterated DOWN into the sidebar partial", () => {
    expect(src, "nav data must be a typed List param").toContain("@param List<Map<String, String>> navGroups");
    // the block iterates the typed nav data into the sidebar sub-partials, never enumerating literal items
    expect(body).toContain("@for(var gi = 0; gi < labels.size(); gi++)");
    expect(body).toContain('item.getOrDefault("label", "")');
    expect(body).toContain('item.getOrDefault("href", "")');
  });

  test("the user-menu items arrive as typed data too, iterated into dropdown items", () => {
    expect(src).toContain("@param List<Map<String, String>> userMenu");
    expect(body).toContain("@for(Map<String, String> mi : userMenu)");
    expect(body).toContain('mi.getOrDefault("label", "")');
  });

  test("the breadcrumb trail arrives as typed data passed to the breadcrumb partial", () => {
    expect(src).toContain("@param List<Map<String, String>> breadcrumb");
    expect(body).toContain("@template.lievit.breadcrumb(items = breadcrumb)");
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

  test("the navigation landmark comes from the sidebar partial (its own <nav>), not a duplicate", () => {
    // the sidebar partial renders the page's single <nav>; the block must not hand-roll one
    expect(body, "the sidebar partial owns the <nav> landmark; do not duplicate it").not.toMatch(/<nav\b/);
    expect(body).toMatch(/@template\.lievit\.sidebar\(/);
  });

  test("focus ring on the block's own chrome (the skip-link) reads the --lv-ring token", () => {
    // the composed partials (sidebar trigger, dropdown trigger, input-group) carry their own
    // focus-visible rings; the only interactive chrome the BLOCK itself owns is the skip-link.
    expect(body).toContain("focus:shadow-[var(--lv-ring)]");
  });
});
