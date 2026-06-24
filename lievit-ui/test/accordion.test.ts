/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * accordion.jte -- structural + a11y + security contract (spec §7, JS-layer assertions).
 *
 * The accordion is a WIRE tier template compiled in the Java world. This suite asserts on
 * the PARTIAL SOURCE as text (the same discipline as alert.test.ts, switch.test.ts, etc.).
 * It pins: the param API, the APG Accordion ARIA contract (role/aria-expanded/aria-controls/
 * aria-labelledby + hidden-attribute collapsed state), the data-slot topology, the three
 * variants (default/ghost/borderless), the disabled-panel and non-collapsible-expanded ARIA
 * contracts, wire action wiring (l:click="toggle" + data-id safe channel), token-driven
 * styling (no bare hex, all --lv-* vars), and CSP hygiene (no inline script, no on* handler).
 *
 * The real-runtime IT (LievitRuntime mount + toggle round-trip) lives in lievit-kit
 * (the CollapsibleComponentIT pattern); the JTE compile + render gate lives in test/jte-compile.
 */
import { describe, test, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const jteDir = join(import.meta.dirname, "..", "registry", "jte");
const metaDir = join(jteDir, "accordion");
const src = readFileSync(join(jteDir, "accordion.jte"), "utf8");

// Strip JTE comment blocks so assertions do not fire on doc-comment prose.
const markup = src.replace(/<%--[\s\S]*?--%>/g, "");

// ---------------------------------------------------------------------------
// File presence
// ---------------------------------------------------------------------------
describe("accordion -- file presence", () => {
  test("accordion.jte exists", () => {
    expect(existsSync(join(jteDir, "accordion.jte"))).toBe(true);
  });

  test("accordion/meta.json exists and declares registry:wire type", () => {
    expect(existsSync(join(metaDir, "meta.json"))).toBe(true);
    const meta = JSON.parse(readFileSync(join(metaDir, "meta.json"), "utf8"));
    expect(meta.type).toBe("registry:wire");
    expect(meta.name).toBe("accordion");
  });

  test("Apache copyright header present", () => {
    expect(src).toContain("Copyright 2026 Francesco Bilotta");
    expect(src).toContain("Apache License");
  });
});

// ---------------------------------------------------------------------------
// Doc-comment header
// ---------------------------------------------------------------------------
describe("accordion -- doc-comment header", () => {
  test("has JTE comment block with labelled sections", () => {
    expect(src).toContain("<%--");
    expect(src).toContain("--%>");
    expect(src).toMatch(/TIER:/);
    expect(src).toMatch(/STRUCTURE/);
    expect(src).toMatch(/A11y/);
    expect(src).toMatch(/Params:/);
    expect(src).toMatch(/Usage:/);
  });

  test("usage block shows @@template.lievit.accordion( syntax", () => {
    expect(src).toContain("@@template.lievit.accordion(");
  });

  test("cites the WAI-ARIA APG Accordion source URL", () => {
    expect(src).toContain("https://www.w3.org/WAI/ARIA/apg/patterns/accordion/");
  });
});

// ---------------------------------------------------------------------------
// Param API (spec §2)
// ---------------------------------------------------------------------------
describe("accordion -- param API", () => {
  test("panels: List<Map<String,String>>", () => {
    expect(src).toContain("@param java.util.List<java.util.Map<String,String>> panels");
  });

  test("expandedIds: Set<String>", () => {
    expect(src).toContain("@param java.util.Set<String> expandedIds");
  });

  test("mode defaults to single", () => {
    expect(src).toContain('@param String mode = "single"');
  });

  test("collapsible defaults to true", () => {
    expect(src).toContain("@param boolean collapsible = true");
  });

  test("variant defaults to default", () => {
    expect(src).toContain('@param String variant = "default"');
  });

  test("panelRole defaults to region", () => {
    expect(src).toContain('@param String panelRole = "region"');
  });

  test("cssClass and attrs present", () => {
    expect(src).toContain('@param String cssClass = ""');
    expect(src).toContain('@param String attrs = ""');
  });

  test("no gg.jte.Content slot (WIRE tier has no Content slot per server-first blueprint)", () => {
    // WIRE templates have no Content slot; panel body is owned markup in the template.
    expect(markup).not.toMatch(/@param gg\.jte\.Content/);
  });

  test("no io.lievit import (JTE gate classpath has no io.lievit)", () => {
    expect(src).not.toMatch(/@import io\.lievit/);
  });
});

// ---------------------------------------------------------------------------
// Data-slot topology (spec §8)
// ---------------------------------------------------------------------------
describe("accordion -- data-slot topology", () => {
  test('root carries data-slot="accordion"', () => {
    expect(markup).toContain('data-slot="accordion"');
  });

  test('root carries data-variant for styling hooks and test selectors', () => {
    expect(markup).toContain("data-variant=");
  });

  test('panel item carries data-slot="accordion-item"', () => {
    expect(markup).toContain('data-slot="accordion-item"');
  });

  test('header button carries data-slot="accordion-header"', () => {
    expect(markup).toContain('data-slot="accordion-header"');
  });

  test('panel region carries data-slot="accordion-panel"', () => {
    expect(markup).toContain('data-slot="accordion-panel"');
  });
});

// ---------------------------------------------------------------------------
// APG Accordion a11y contract (spec §4)
// ---------------------------------------------------------------------------
describe("accordion -- APG Accordion a11y contract", () => {
  test("header element is rendered as role=heading + aria-level (no tag-name expression)", () => {
    // JTE forbids <h${n}>; the correct approach is role="heading" + aria-level on a div.
    expect(markup).toContain('role="heading"');
    expect(markup).toContain("aria-level=");
    // Confirm no dynamic tag-name expression is present.
    expect(markup).not.toMatch(/<\$\{.*\}/);
  });

  test("header button is a native <button type=button>", () => {
    expect(markup).toContain('<button');
    expect(markup).toContain('type="button"');
  });

  test("header button has aria-expanded reflecting server state", () => {
    // The expression: aria-expanded="${isExpanded ? "true" : "false"}"
    expect(src).toMatch(/aria-expanded=.*isExpanded.*"true".*"false"/);
  });

  test("header button has aria-controls pointing to panel-${id}", () => {
    expect(src).toMatch(/aria-controls=.*panel-/);
  });

  test("header button has a unique id for aria-labelledby reference", () => {
    expect(src).toMatch(/id=.*header-btn-/);
  });

  test("panel region has id matching header aria-controls target", () => {
    expect(src).toMatch(/id=.*panel-/);
  });

  test("panel region has role and aria-labelledby wired to header button id", () => {
    expect(src).toMatch(/aria-labelledby=.*header-btn-/);
    // panelRole is rendered conditionally -- the param + the expression are both present.
    expect(src).toContain("panelRole");
  });

  test("collapsed panel uses hidden attribute (not just CSS; removes from a11y tree)", () => {
    // v-next: the template uses hidden="${!isExpanded}" (JTE boolean smart attribute);
    // JTE renders this as the `hidden` attribute when !isExpanded is true (i.e. collapsed),
    // and omits it entirely when the panel is expanded. This is the canonical JTE boolean form.
    // The old form hidden="${isExpanded ? null : 'hidden'}" was equivalent but less idiomatic.
    expect(src).toContain('hidden="${!isExpanded}"');
  });

  test("disabled panel: native disabled attribute present in template", () => {
    expect(src).toMatch(/disabled=.*pdisabled/);
  });

  test("aria-disabled covers both truly-disabled and non-collapsible-expanded states", () => {
    // The ariaDisabled var covers pdisabled || isNonCollapsibleExpanded.
    expect(src).toContain("ariaDisabled");
    expect(src).toContain("pdisabled");
    expect(src).toContain("isNonCollapsibleExpanded");
    expect(markup).toContain("aria-disabled=");
  });

  test("non-collapsible-expanded derived correctly: single mode + collapsible=false + panel is expanded", () => {
    expect(src).toContain("isNonCollapsibleExpanded");
    expect(src).toMatch(/isExpanded.*!collapsible.*"single"\.equals\(mode\)/);
  });

  test("chevron is aria-hidden (decorative)", () => {
    // The chevron span must have aria-hidden="true".
    expect(markup).toMatch(/class="lv-accordion-chevron"[\s\S]{0,100}aria-hidden="true"|aria-hidden="true"[\s\S]{0,100}class="lv-accordion-chevron"/);
  });

  test("chevron icon uses @template.lievit.icon with name/size only (no extra params)", () => {
    // icon takes only name, size, cssClass, label -- no ariaHidden param.
    expect(src).toMatch(/@template\.lievit\.icon\(name = "chevron-down", size = "1rem"\)/);
  });
});

// ---------------------------------------------------------------------------
// Wire action wiring (spec §6)
// ---------------------------------------------------------------------------
describe("accordion -- wire action wiring", () => {
  test('header button has l:click="toggle"', () => {
    expect(markup).toContain('l:click="toggle"');
  });

  test("header button has data-id using the SAFE-escaped safeDataId variable", () => {
    // The data-id value must be the safe-escaped id, not a raw ${pid} interpolation.
    expect(src).toContain('data-id="$unsafe{safeDataId}"');
  });

  test("safeDataId is produced by Escape.htmlAttribute (the SAFE XSS channel)", () => {
    expect(src).toContain("Escape.htmlAttribute(pid, dataIdOut)");
    expect(src).toContain("safeDataId = dataIdOut.toString()");
  });

  test("attrs param is emitted as $unsafe (trusted static-only channel on root)", () => {
    expect(src).toContain("$unsafe{attrs}");
  });
});

// ---------------------------------------------------------------------------
// Variants (spec §3)
// ---------------------------------------------------------------------------
describe("accordion -- variants", () => {
  test('default variant: has --lv-color-border, --lv-radius-md, --lv-shadow-xs in variant style', () => {
    expect(src).toContain("var(--lv-color-border)");
    expect(src).toContain("var(--lv-radius-md)");
    expect(src).toContain("var(--lv-shadow-xs)");
  });

  test('ghost variant: no outer border (transparent outer, dividers only)', () => {
    // ghost branch: border:0;background:transparent
    expect(src).toMatch(/case "ghost"\s*->\s*"border:0;background:transparent/);
  });

  test('borderless variant: no outer border and no dividers', () => {
    expect(src).toMatch(/case "borderless"\s*->\s*"border:0;background:transparent/);
    // Borderless suppresses inter-panel dividers: the dividerStyle variable resolves to ""
    // for borderless (the ternary or switch in the source checks for "borderless").
    expect(src).toContain('"borderless"');
    expect(src).toMatch(/"borderless".*?""|\"\"\s*:.*divider/s);
  });

  test("inter-panel divider is suppressed for borderless, present for default and ghost", () => {
    expect(src).toContain("dividerStyle");
    expect(src).toContain('"borderless".equals(variant)');
  });

  test("variant param drives data-variant on the root (test selector + styling hook)", () => {
    expect(markup).toContain('data-variant="${variant}"');
  });
});

// ---------------------------------------------------------------------------
// Token usage (spec §5)
// ---------------------------------------------------------------------------
describe("accordion -- token usage", () => {
  test("reads --lv-color-border for borders and dividers", () => {
    expect(src).toContain("var(--lv-color-border)");
  });

  test("reads --lv-color-popover and --lv-color-popover-fg for surfaces and text", () => {
    expect(src).toContain("var(--lv-color-popover)");
    expect(src).toContain("var(--lv-color-popover-fg)");
  });

  test("reads --lv-color-muted-fg for collapsed header text (de-emphasis)", () => {
    expect(src).toContain("var(--lv-color-muted-fg)");
  });

  test("reads --lv-color-accent for header hover background", () => {
    expect(src).toContain("var(--lv-color-accent)");
  });

  test("reads spacing tokens for padding (--lv-space-2/3/4/5)", () => {
    expect(src).toContain("var(--lv-space-2)");
    expect(src).toContain("var(--lv-space-3)");
    expect(src).toContain("var(--lv-space-4)");
    expect(src).toContain("var(--lv-space-5)");
  });

  test("reads --lv-text-sm for header label text size", () => {
    expect(src).toContain("var(--lv-text-sm)");
  });

  test("reads --lv-font-medium for header label font weight", () => {
    expect(src).toContain("var(--lv-font-medium)");
  });

  test("reads --lv-font-sans for font family", () => {
    expect(src).toContain("var(--lv-font-sans)");
  });

  test("reads --lv-ring for focus-visible ring on the header button", () => {
    expect(src).toContain("var(--lv-ring)");
  });

  test("reads --lv-shadow-xs for default variant container shadow", () => {
    expect(src).toContain("var(--lv-shadow-xs)");
  });

  test("reads --lv-radius-md for default variant border-radius", () => {
    expect(src).toContain("var(--lv-radius-md)");
  });

  test("reads --lv-opacity-disabled for disabled panel opacity", () => {
    expect(src).toContain("var(--lv-opacity-disabled)");
  });

  test("reads --lv-duration-fast and --lv-ease for chevron transition", () => {
    expect(src).toContain("var(--lv-duration-fast)");
    expect(src).toContain("var(--lv-ease)");
  });

  test("no bare hex colour literals in the template body (all colours are --lv-* vars)", () => {
    // Strip comments first, then check the markup body.
    expect(markup).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});

// ---------------------------------------------------------------------------
// CSP hygiene (spec §8 hard rules)
// ---------------------------------------------------------------------------
describe("accordion -- CSP hygiene", () => {
  test("no inline <script> element", () => {
    expect(markup).not.toMatch(/<script/i);
  });

  test("no inline on* event handler attribute", () => {
    expect(markup).not.toMatch(/\son[a-z]+=/i);
  });

  test("no <style> block", () => {
    expect(markup).not.toMatch(/<style[\s>]/i);
  });

  test("no Lit / LitElement island", () => {
    expect(src.toLowerCase()).not.toMatch(/customelement|litelement|import .*\blit\b/);
  });
});

// ---------------------------------------------------------------------------
// JTE template safety (hard rules from brief)
// ---------------------------------------------------------------------------
describe("accordion -- JTE template safety", () => {
  test("no @if in attribute NAME position (smart attributes only)", () => {
    // Smart-attribute pattern: attr="${cond ? val : null}"; @if inside attr name is forbidden.
    expect(markup).not.toMatch(/@if\([^)]+\)\s*[a-zA-Z-]+="|@if\([^)]+\)[a-zA-Z-]+=/);
  });

  test("no tag-name expression (<${var}> pattern is forbidden by JTE gate)", () => {
    expect(markup).not.toMatch(/<\$\{[^}]+\}/);
  });

  test("no nested JTE comments (inner --%> would close outer early)", () => {
    // Count comment open/close markers -- they must be balanced and non-nested.
    const opens = (src.match(/<%--/g) || []).length;
    const closes = (src.match(/--%>/g) || []).length;
    expect(opens).toBe(closes);
    expect(opens).toBeGreaterThan(0);
  });

  test("all @for blocks are closed with @endfor", () => {
    const fors = (markup.match(/@for\b/g) || []).length;
    const endFors = (markup.match(/@endfor\b/g) || []).length;
    expect(fors).toBe(endFors);
  });

  test("all @if blocks are closed with @endif", () => {
    const ifs = (markup.match(/@if\b/g) || []).length;
    const endIfs = (markup.match(/@endif\b/g) || []).length;
    expect(ifs).toBe(endIfs);
  });
});
