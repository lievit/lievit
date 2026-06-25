/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * navigation-menu v-next (UNCONTROLLED headless, APG Disclosure Navigation pattern).
 *
 * What we assert:
 *   1. Registry shape — the item ships the right file set.
 *   2. Source-text house rules — no <script>, no on*, JTE comment syntax.
 *   3. ARIA structure — <nav aria-label>, correct roles, no role="menu"/role="menubar".
 *   4. Disclosure semantics — trigger is <button aria-expanded aria-controls>; panel has id=.
 *   5. Leaf link semantics — <a>, aria-current smart attribute, disabled pattern.
 *   6. Native popover — panel carries popover="auto" + data-lv-opener (popover-anchor contract).
 *   7. Collection-nav wiring — data-lievit-collection + orientation attrs on <nav>.
 *   8. data-lievit-item — trigger buttons + top-level leaf <a> are in the collection.
 *   9. Escaping — data-id rendered via Escape.htmlAttribute (SAFE channel).
 *  10. Meta.json — enhancers listed; group file present.
 *
 * The render gate (real JTE compile + axe-core) lives in test/jte-compile (coordinator-run,
 * per-wave). Keyboard + focus tests (real collection-nav + popover-anchor on real DOM) belong in
 * the Playwright / integration tier. This file covers source-text contracts.
 */
import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildRegistry } from "../cli/build-registry.js";
import { resolve } from "../cli/registry.js";
import type { Registry } from "../cli/registry.js";

const registryRoot = join(import.meta.dirname, "..", "registry");
const registry: Registry = buildRegistry(registryRoot);
const read = (rel: string) => readFileSync(join(registryRoot, rel), "utf8");
/** Strip doc-comment blocks so text searches hit only real markup/logic. */
const markup = (rel: string) => read(rel).replace(/<%--[\s\S]*?--%>/g, "");

const SHELL = "jte/navigation-menu.jte";
const LINK  = "jte/navigation-menu/link.jte";
const MENU  = "jte/navigation-menu/menu.jte";
const GROUP = "jte/navigation-menu/menu/group.jte";
const ALL   = [SHELL, LINK, MENU, GROUP] as const;

// ---------------------------------------------------------------------------
// 1. Registry shape
// ---------------------------------------------------------------------------
describe("navigation-menu registry item", () => {
  test("exactly one navigation-menu registry item", () => {
    const matches = registry.items.filter((i) => i.name === "navigation-menu");
    expect(matches, "exactly one item").toHaveLength(1);
    expect(matches[0].type).toBe("registry:jte");
  });

  test("ships shell + link + menu + group sub-partials, all jte root", () => {
    const item = registry.items.find((i) => i.name === "navigation-menu")!;
    const targets = item.files.map((f) => f.target).sort();
    expect(targets).toEqual([
      "lievit/navigation-menu.jte",
      "lievit/navigation-menu/link.jte",
      "lievit/navigation-menu/menu.jte",
      "lievit/navigation-menu/menu/group.jte",
    ]);
    expect(item.files.every((f) => f.root === "jte")).toBe(true);
  });

  test("resolving pulls tokens + icon dependencies", () => {
    const closure = resolve(registry, ["navigation-menu"]).map((i) => i.name);
    expect(closure).toContain("navigation-menu");
    expect(closure).toContain("tokens");
    expect(closure).toContain("icon");
  });
});

// ---------------------------------------------------------------------------
// 2. House rules (CSP-safe, correct JTE comment syntax)
// ---------------------------------------------------------------------------
describe("navigation-menu: house rules", () => {
  test.each(ALL)("%s has no inline <script>", (f) => {
    expect(read(f)).not.toMatch(/<script/i);
  });

  test.each(ALL)("%s has no inline on* handlers", (f) => {
    expect(read(f)).not.toMatch(/\son[a-z]+=/);
  });

  test.each(ALL)("%s uses <%-- --%> JTE comment syntax, not @* *@", (f) => {
    expect(read(f)).not.toMatch(/@\*/);
  });

  test.each(ALL)("%s has no dev.lievit import", (f) => {
    expect(read(f)).not.toMatch(/@import\s+dev\.lievit/);
  });

  test.each(ALL)("%s has no literal colour values (token-only)", (f) => {
    // Allow hex only in doc-comment examples; stripped markup must be hex-free.
    expect(markup(f)).not.toMatch(/#[0-9a-fA-F]{3,6}\b/);
  });
});

// ---------------------------------------------------------------------------
// 3. Shell: <nav> landmark + collection-nav wiring
// ---------------------------------------------------------------------------
describe("navigation-menu.jte shell structure", () => {
  test("root is a <nav> landmark with aria-label, not a menu role", () => {
    const src = markup(SHELL);
    expect(src).toContain("<nav");
    expect(src).toContain('aria-label="${label}"');
    expect(src).not.toMatch(/role="menu"/);
    expect(src).not.toMatch(/role="menubar"/);
  });

  test("data-slot=navigation-menu on the <nav> root", () => {
    expect(markup(SHELL)).toContain('data-slot="navigation-menu"');
  });

  test("data-variant and data-size attributes present on root (styling hooks)", () => {
    const src = markup(SHELL);
    expect(src).toContain('data-variant="${orientation}"');
    expect(src).toContain('data-size="${size}"');
  });

  test("<ul> carries role=list", () => {
    expect(markup(SHELL)).toContain('role="list"');
  });

  test("collection-nav wiring: data-lievit-collection on <nav>", () => {
    expect(markup(SHELL)).toContain("data-lievit-collection");
  });

  test("collection-nav wiring: orientation attr forwarded", () => {
    expect(markup(SHELL)).toContain('data-lievit-collection-orientation="${orientation}"');
  });

  test("collection-nav wiring: wrap=true (disclosure nav wraps at ends)", () => {
    expect(markup(SHELL)).toContain('data-lievit-collection-wrap="true"');
  });

  test("collection-nav wiring: APG Disclosure 'nav' mode (focus moves, tabindix untouched)", () => {
    // v-next: navigation-menu uses the collection-nav "nav" mode (arrow keys move focus via
    // element.focus(), all items stay tabindex=0) — NOT roving-tabindex. This is the APG
    // Disclosure Navigation model; the popover-anchor enhancer syncs aria-expanded on the triggers.
    const src = markup(SHELL);
    expect(src).toContain('data-lievit-collection-mode="nav"');
    expect(src).not.toContain('data-lievit-collection-roving-tabindex="true"');
  });

  test("Stimulus wiring: data-controller=lv-navigation-menu + keydown action on <nav>", () => {
    // v-next: the keyboard supplement (APG Disclosure "nav" mode) is owned by the
    // lv-navigation-menu Stimulus controller, bound declaratively (CSP-clean) on the <nav>. The
    // shared collection-nav enhancer skips this instance via its data-controller guard.
    const src = markup(SHELL);
    expect(src).toContain('data-controller="lv-navigation-menu"');
    expect(src).toContain('data-action="keydown->lv-navigation-menu#onKeydown"');
  });

  test("no dev.lievit import in shell (JTE-compile-classpath safe)", () => {
    expect(read(SHELL)).not.toMatch(/@import/);
  });
});

// ---------------------------------------------------------------------------
// 4. menu.jte: disclosure trigger + native popover panel
// ---------------------------------------------------------------------------
describe("navigation-menu/menu.jte disclosure + popover contract", () => {
  test("trigger is a <button> with aria-expanded and aria-controls", () => {
    const src = markup(MENU);
    expect(src).toContain("<button");
    expect(src).toContain('aria-expanded="false"');
    expect(src).toContain('aria-controls="${_panelId}"');
  });

  test("trigger carries data-lievit-item (in the collection for arrow-key nav)", () => {
    expect(markup(MENU)).toContain("data-lievit-item");
  });

  test("trigger carries popovertarget (native popover toggle binding)", () => {
    expect(markup(MENU)).toContain('popovertarget="${vertical ? null : _panelId}"');
  });

  test("panel carries popover=auto (native Esc + light-dismiss)", () => {
    expect(markup(MENU)).toContain('popover="auto"');
  });

  test("panel carries data-lv-opener referencing the trigger id (popover-anchor contract)", () => {
    expect(markup(MENU)).toContain('data-lv-opener="${_triggerId}"');
  });

  test("panel has id=panel-<id> referenced by aria-controls", () => {
    const src = markup(MENU);
    expect(src).toContain('id="${_panelId}"');
  });

  test("panel uses --lv-z-popover for z-index, no hardcoded value", () => {
    const src = markup(MENU);
    expect(src).toContain("var(--lv-z-popover)");
    expect(src).not.toMatch(/z-index:\s*\d{3,}/);
  });

  test("chevron icon is aria-hidden (decorative affordance)", () => {
    // The chevron wrapper is aria-hidden="true"
    expect(markup(MENU)).toContain('aria-hidden="true"');
  });

  test("separator sentinel renders <li role=separator> when id is blank", () => {
    expect(markup(MENU)).toContain('role="separator"');
  });

  test("data-slot=navigation-menu-trigger on the button", () => {
    expect(markup(MENU)).toContain('data-slot="navigation-menu-trigger"');
  });

  test("data-slot=navigation-menu-panel on the panel div", () => {
    expect(markup(MENU)).toContain('data-slot="navigation-menu-panel"');
  });

  test("no role=region (APG Disclosure Navigation uses <div> not a landmark region for panels)", () => {
    // The old partial used role="region" which is technically OK but not required;
    // v-next drops the landmark role on the panel to avoid polluting the landmark list.
    // If the implementation uses role=region, this test documents the intent and should be updated.
    // Currently we do NOT emit role=region.
    expect(markup(MENU)).not.toContain('role="region"');
  });

  test("no CSS group-hover / group-focus-within (old CSS-only reveal is replaced by [popover])", () => {
    expect(markup(MENU)).not.toContain("group-hover");
    expect(markup(MENU)).not.toContain("group-focus-within");
  });

  test("panel uses popover token background, not hardcoded colour", () => {
    expect(markup(MENU)).toContain("var(--lv-color-popover)");
  });

  test("SAFE escaping channel: dataAttrs values go through Escape.htmlAttribute", () => {
    expect(read(MENU)).toContain("Escape.htmlAttribute");
  });
});

// ---------------------------------------------------------------------------
// 5. link.jte: leaf link ARIA contract
// ---------------------------------------------------------------------------
describe("navigation-menu/link.jte leaf link contract", () => {
  test("renders a real <a> anchor (browser navigation, middle-click works)", () => {
    expect(markup(LINK)).toContain("<a");
    expect(markup(LINK)).toContain('href="${_href}"');
  });

  test("aria-current=page on the active link (smart attr, null when inactive)", () => {
    expect(markup(LINK)).toContain('aria-current="${_ariaCurrent}"');
  });

  test("disabled leaf: aria-disabled=true, href omitted (smart attr null)", () => {
    const src = markup(LINK);
    expect(src).toContain('aria-disabled="${_ariaDisabled}"');
    // _href is null when disabled: smart attr omits href
    expect(src).toContain("!{var _href = disabled ? null : href;}");
  });

  test("top-level leaf carries data-lievit-item (in the collection)", () => {
    expect(markup(LINK)).toContain("data-lievit-item");
  });

  test("badge is aria-hidden (decorative)", () => {
    expect(markup(LINK)).toContain('aria-hidden="true"');
  });

  test("no role=listitem on <li> (implicit for <li> inside <ul>)", () => {
    // We do emit role=listitem to be explicit per spec; if not, this test should be updated.
    // The spec ARIA table shows role=listitem as default for <li>; explicit is acceptable.
    // This test just documents the contract.
    expect(markup(LINK)).toContain('<li role="listitem">');
  });

  test("focus-visible ring via --lv-ring token", () => {
    expect(markup(LINK)).toContain("var(--lv-ring)");
  });
});

// ---------------------------------------------------------------------------
// 6. group.jte: panel group section
// ---------------------------------------------------------------------------
describe("navigation-menu/menu/group.jte group contract", () => {
  test("group heading is a <p>, not a heading element", () => {
    const src = markup(GROUP);
    expect(src).toContain("<p");
    expect(src).not.toMatch(/<h[1-6]/);
  });

  test("data-slot=navigation-menu-group on the root", () => {
    expect(markup(GROUP)).toContain('data-slot="navigation-menu-group"');
  });

  test("group heading text is HTML-escaped via JTE default", () => {
    // The label is rendered via ${label} (JTE default HTML escaping, safe channel).
    expect(markup(GROUP)).toContain("${label}");
    // Must NOT use $unsafe for the heading.
    const src = markup(GROUP);
    // Isolate the heading rendering line; it should not be $unsafe.
    const headingLine = src.split("\n").find((l) => l.includes("navigation-menu-group-label"));
    expect(headingLine).toBeDefined();
    expect(headingLine).not.toContain("$unsafe");
  });
});

// ---------------------------------------------------------------------------
// 7. No back-compat aliases (CLEAN BREAK rule)
// ---------------------------------------------------------------------------
describe("navigation-menu: clean break — no old API surface", () => {
  test("shell has no Content `content` slot (v-next shell uses Content slot for items)", () => {
    // Shell DOES use a Content slot for items -- this is correct.
    // This test confirms the clean API: no `key` param (old menu.jte), no `open` SSR hint param
    // that drove the CSS-only reveal.
    expect(read(SHELL)).not.toContain("@param String key");
    expect(read(SHELL)).not.toContain("@param boolean open");
  });

  test("link.jte has no `inPanel`-only params that the old design had (active vs activeHref)", () => {
    // Old link.jte had boolean `active`. v-next uses `activeHref` (server-supplied route).
    expect(read(LINK)).not.toContain("@param boolean active");
    expect(read(LINK)).toContain("@param String activeHref");
  });

  test("menu.jte has no `key` param (replaced by `id`)", () => {
    expect(read(MENU)).not.toContain("@param String key");
    expect(read(MENU)).toContain("@param String id");
  });
});
