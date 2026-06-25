/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * menubar (v-next) -- structural + a11y contract (REFORGE-AGENT-BRIEF tier doctrine).
 *
 * The uncontrolled bar partial is compiled in the Java world; this harness asserts on the
 * PARTIAL SOURCE as text (structural golden). It pins: the param API (id, ariaLabel, size,
 * content slot, cssClass), the ARIA wiring (role=menubar, aria-label, aria-orientation=horizontal),
 * the collection-nav enhancer data-attr contract (data-lievit-collection, horizontal roving-tabindex,
 * wrap), size scale mapping (sm/md/lg to --lv-space-8/9/10), token-driven styling, and CSP hygiene.
 * Real-runtime + keyboard tests live in the IT suite; this suite is the static contract gate,
 * equivalent to the JTE-compile golden.
 */
import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const jteDir = join(import.meta.dirname, "..", "registry", "jte");
const src = readFileSync(join(jteDir, "menubar.jte"), "utf8");
const metaRaw = readFileSync(join(jteDir, "menubar", "meta.json"), "utf8");

// Strip JTE comments so assertions do not accidentally hit doc-comment prose.
const markup = src.replace(/<%--[\s\S]*?--%>/g, "");

// ---------------------------------------------------------------------------
// Param API
// ---------------------------------------------------------------------------
describe("menubar -- param API", () => {
  test("declares id param with default 'lv-menubar'", () => {
    expect(src).toContain('@param String id = "lv-menubar"');
  });

  test("declares ariaLabel as required String (no default)", () => {
    expect(src).toContain("@param String ariaLabel");
    // Must NOT have a default value -- it is required
    expect(src).not.toContain("@param String ariaLabel =");
  });

  test("declares size param with default 'md'", () => {
    expect(src).toContain('@param String size = "md"');
  });

  test("declares content as gg.jte.Content (the slot)", () => {
    expect(src).toContain("@param gg.jte.Content content");
  });

  test("declares cssClass with empty default", () => {
    expect(src).toContain('@param String cssClass = ""');
  });

  test("usage doc shows the @@template.lievit.menubar call syntax", () => {
    expect(src).toContain("@@template.lievit.menubar(");
  });
});

// ---------------------------------------------------------------------------
// Bar container: element + landmark
// ---------------------------------------------------------------------------
describe("menubar -- bar container element + landmark", () => {
  test('bar root is a <nav> element (landmark; role=menubar supplements it)', () => {
    expect(markup).toContain("<nav");
  });

  test('bar carries role="menubar" (APG Menubar pattern)', () => {
    expect(markup).toContain('role="menubar"');
  });

  test('bar carries aria-label bound to ariaLabel param (required accessible name)', () => {
    expect(markup).toContain('aria-label="${ariaLabel}"');
  });

  test('bar carries aria-orientation="horizontal" (explicit; default is vertical, so this is load-bearing)', () => {
    expect(markup).toContain('aria-orientation="horizontal"');
  });

  test('bar carries id bound to id param', () => {
    expect(markup).toContain('id="${id}"');
  });

  test('bar carries data-slot="menubar"', () => {
    expect(markup).toContain('data-slot="menubar"');
  });

  test('bar carries data-size reflecting the size param', () => {
    expect(markup).toContain('data-size="${size}"');
  });

  test('bar carries data-controller="lv-menubar" (Stimulus drives the roving-tabindex keyboard model)', () => {
    expect(markup).toContain('data-controller="lv-menubar"');
  });

  test("bar renders the content Content slot (${content} interpolation)", () => {
    expect(markup).toContain("${content}");
  });

  test("cssClass is appended to the bar class", () => {
    expect(markup).toContain("${cssClass}");
  });
});

// ---------------------------------------------------------------------------
// Size scale: bar height tokens
// ---------------------------------------------------------------------------
describe("menubar -- size scale", () => {
  test("size=sm maps to --lv-space-8 bar height", () => {
    expect(src).toContain('"sm" -> "var(--lv-space-8)"');
  });

  test("size=md (default) maps to --lv-space-9 bar height", () => {
    expect(src).toContain('"var(--lv-space-9)"');
  });

  test("size=lg maps to --lv-space-10 bar height", () => {
    expect(src).toContain('"lg" -> "var(--lv-space-10)"');
  });

  test("size=sm maps text to --lv-text-xs", () => {
    expect(src).toContain('"sm" -> "text-[length:var(--lv-text-xs)]"');
  });

  test("size=md maps text to --lv-text-sm", () => {
    expect(src).toContain('"text-[length:var(--lv-text-sm)]"');
  });

  test("size=lg maps text to --lv-text-base", () => {
    expect(src).toContain('"lg" -> "text-[length:var(--lv-text-base)]"');
  });

  test("bar height is applied via barHeight derived variable in inline style", () => {
    expect(markup).toContain("height:${barHeight}");
  });
});

// ---------------------------------------------------------------------------
// collection-nav enhancer: horizontal roving-tabindex
// ---------------------------------------------------------------------------
describe("menubar -- collection-nav enhancer contract (horizontal roving)", () => {
  test("bar carries data-lievit-collection (activates the enhancer)", () => {
    expect(markup).toContain("data-lievit-collection");
  });

  test("bar carries data-lievit-collection-roving-tabindex='true' (roving model, not aria-activedescendant)", () => {
    expect(markup).toContain('data-lievit-collection-roving-tabindex="true"');
  });

  test("bar carries data-lievit-collection-orientation='horizontal' (Left/Right Arrow navigation)", () => {
    expect(markup).toContain('data-lievit-collection-orientation="horizontal"');
  });

  test("bar carries data-lievit-collection-wrap='true' (Right Arrow wraps from last to first; Left Arrow wraps to last)", () => {
    expect(markup).toContain('data-lievit-collection-wrap="true"');
  });

  test("no data-lievit-collection-escape-action on the bar (no server action -- uncontrolled)", () => {
    // The bar is uncontrolled: there is no wire action to call on Escape at the bar level.
    // Each individual dropdown-menu inside manages its own close via its popover seam.
    expect(markup).not.toContain('data-lievit-collection-escape-action');
  });
});

// ---------------------------------------------------------------------------
// Token-driven styling: bar
// ---------------------------------------------------------------------------
describe("menubar -- token-driven bar styling", () => {
  test("bar background uses --lv-color-bg", () => {
    expect(markup).toContain("background:var(--lv-color-bg)");
  });

  test("bar text uses --lv-color-fg", () => {
    expect(markup).toContain("color:var(--lv-color-fg)");
  });

  test("bar font family uses --lv-font-sans", () => {
    expect(markup).toContain("font-family:var(--lv-font-sans)");
  });

  test("no bare hex colour in bar markup", () => {
    expect(markup).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  test("bar layout uses flex row (items flow horizontally)", () => {
    expect(markup).toContain("flex flex-row");
  });

  test("bar uses items-stretch so triggers fill the full bar height", () => {
    expect(markup).toContain("items-stretch");
  });
});

// ---------------------------------------------------------------------------
// JTE gate rules: no dev.lievit imports, no nested comments, no inline script
// ---------------------------------------------------------------------------
describe("menubar -- JTE gate rules", () => {
  test("no @import dev.lievit (forbidden in the JTE classpath)", () => {
    expect(src).not.toContain("@import dev.lievit");
  });

  test("no nested JTE comments (inner --%> would close outer comment early)", () => {
    const commentBodies = (src.match(/<%--[\s\S]*?--%>/g) ?? []).map((m) =>
      m.slice(4, m.length - 4),
    );
    for (const body of commentBodies) {
      expect(body, "nested <%-- inside JTE comment").not.toContain("<%--");
      expect(body, "nested --%> inside JTE comment").not.toContain("--%>");
    }
  });

  test("no inline <script> (CSP-safe)", () => {
    expect(src).not.toMatch(/<script/i);
  });

  test("no inline on* event handler attributes (CSP-safe)", () => {
    const handlers = markup.match(/\son[a-z]+=/gi) ?? [];
    expect(handlers).toEqual([]);
  });

  test("no em-dash in the source (house rule)", () => {
    expect(src).not.toContain("—"); // U+2014 EM DASH
  });

  test("no @if in HTML attribute NAME position (JTE hard rule)", () => {
    // The template must not contain @if inside an attribute name position.
    // Heuristic: no "@if" directly preceded by a space after an attribute context.
    expect(markup).not.toMatch(/\s@if\([^)]+\)\s*[a-zA-Z-]+=/)
  });

  test("no expression in HTML tag name (JTE hard rule)", () => {
    // No <${...}> patterns
    expect(markup).not.toMatch(/<\$\{/);
  });
});

// ---------------------------------------------------------------------------
// No back-compat aliases
// ---------------------------------------------------------------------------
describe("menubar -- clean API (no aliases)", () => {
  test("no dual param names (only one name per concept)", () => {
    // The REFORGE-AGENT-BRIEF forbids back-compat aliases. The bar has one name
    // for each concept: id, ariaLabel, size, content, cssClass.
    const paramLines = src.match(/@param [^\n]+/g) ?? [];
    const paramNames = paramLines.map((l) => l.replace(/@param\s+\S+\s+(\S+).*/, "$1").split("=")[0].trim());
    const unique = new Set(paramNames);
    expect(unique.size).toBe(paramNames.length);
  });
});

// ---------------------------------------------------------------------------
// meta.json
// ---------------------------------------------------------------------------
describe("menubar -- meta.json", () => {
  test("meta.json is valid JSON", () => {
    expect(() => JSON.parse(metaRaw)).not.toThrow();
  });

  const meta = JSON.parse(metaRaw) as Record<string, unknown>;

  test("name is 'menubar'", () => {
    expect(meta.name).toBe("menubar");
  });

  test("type is 'registry:jte'", () => {
    expect(meta.type).toBe("registry:jte");
  });

  test("registryDependencies includes 'tokens' and 'dropdown-menu'", () => {
    const deps = meta.registryDependencies as string[];
    expect(deps).toContain("tokens");
    expect(deps).toContain("dropdown-menu");
  });

  test("enhancers field lists collection-nav", () => {
    const enhancers = meta.enhancers as string[];
    expect(enhancers).toContain("collection-nav.enhancer.ts");
  });

  test("files array includes jte/menubar.jte", () => {
    const files = (meta.files as Array<{ path: string }>).map((f) => f.path);
    expect(files).toContain("jte/menubar.jte");
  });
});

// ---------------------------------------------------------------------------
// ENHANCER_NEEDED surface tests: document what the enhancer cannot do yet
// ---------------------------------------------------------------------------
describe("menubar -- ENHANCER_NEEDED documentation (informational)", () => {
  test("doc comment mentions ENHANCER_NEEDED for Down Arrow submenu-open on horizontal bar", () => {
    // The comment must document that Down Arrow to open submenus requires an enhancer update.
    expect(src).toContain("ENHANCER_NEEDED");
  });

  test("bar does NOT emit a data-lievit-collection-down-opens attribute (not yet in enhancer API)", () => {
    // This attribute does not exist yet. If it appears, the test should be updated to expect it.
    expect(markup).not.toContain("data-lievit-collection-down-opens");
  });
});
