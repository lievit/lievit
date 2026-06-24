/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * accordion.jte + accordion/item.jte -- structural + a11y + security contract.
 *
 * The accordion is a PARTIAL tier controlled/uncontrolled component: native
 * <details>/<summary> pairs, zero JS, zero WIRE. This suite asserts on the PARTIAL SOURCE
 * as text (same discipline as alert.test.ts, badge.test.ts).
 *
 * What is pinned here:
 *   - Param API for accordion.jte (container) and accordion/item.jte (per-item).
 *   - PARTIAL tier invariants (no @Wire, no l:click, no List<Map> server params,
 *     no io.lievit imports, gg.jte.Content slot on both container and item).
 *   - APG Accordion a11y contract via native <details>/<summary>:
 *       * <details open="${open}"> is the controlled hook (boolean smart-attr, NOT ternary).
 *       * <details name="${name}"> is the single-mode exclusivity hook (platform).
 *       * <summary id="header-btn-${id}" aria-controls="panel-${id}"> trigger.
 *       * Panel <div id="panel-${id}" role="region" aria-labelledby="header-btn-${id}">.
 *       * Disabled: aria-disabled="true" + tabindex="-1" on the summary (smart-attrs).
 *   - Data-slot topology (accordion / accordion-item / accordion-trigger / accordion-panel).
 *   - Three variants (default / ghost / borderless) and their CSS expressions.
 *   - Token usage (no bare hex, all --lv-* vars).
 *   - Chevron: .lv-accordion-chevron + aria-hidden="true".
 *   - CSS file presence (accordion.css with details[open] selector).
 *   - CSP hygiene (no inline script, no on*, no <style>).
 *   - JTE template safety (no tag-name expressions, balanced @for/@if blocks, no nested
 *     JTE comments, no io.lievit import).
 *
 * The real JTE-compile + render gate lives in test/jte-compile (coordinator-run).
 * The browser-level interaction tests (keyboard, single-open group, disabled click) live
 * in lievit-kit Playwright/WTR suites against a real browser (native <details> requires it).
 */
import { describe, test, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const jteDir = join(import.meta.dirname, "..", "registry", "jte");
const metaDir = join(jteDir, "accordion");

const accSrc  = readFileSync(join(jteDir, "accordion.jte"), "utf8");
const itemSrc = readFileSync(join(metaDir, "item.jte"), "utf8");
const cssSrc  = readFileSync(join(jteDir, "accordion.css"), "utf8");

// Strip JTE doc-comment blocks so assertions do not fire on prose in the header.
const accMarkup  = accSrc.replace(/<%--[\s\S]*?--%>/g, "");
const itemMarkup = itemSrc.replace(/<%--[\s\S]*?--%>/g, "");

// ---------------------------------------------------------------------------
// File presence
// ---------------------------------------------------------------------------
describe("accordion -- file presence", () => {
  test("accordion.jte exists", () => {
    expect(existsSync(join(jteDir, "accordion.jte"))).toBe(true);
  });

  test("accordion/item.jte exists", () => {
    expect(existsSync(join(metaDir, "item.jte"))).toBe(true);
  });

  test("accordion.css exists (chevron rotation)", () => {
    expect(existsSync(join(jteDir, "accordion.css"))).toBe(true);
  });

  test("accordion/meta.json exists and declares registry:jte type (PARTIAL, not WIRE)", () => {
    expect(existsSync(join(metaDir, "meta.json"))).toBe(true);
    const meta = JSON.parse(readFileSync(join(metaDir, "meta.json"), "utf8"));
    expect(meta.type).toBe("registry:jte");
    expect(meta.name).toBe("accordion");
  });

  test("meta.json includes accordion/item.jte and accordion.css in files", () => {
    const meta = JSON.parse(readFileSync(join(metaDir, "meta.json"), "utf8"));
    const paths = meta.files.map((f: { path: string }) => f.path);
    expect(paths).toContain("jte/accordion/item.jte");
    expect(paths).toContain("jte/accordion.css");
  });

  test("Apache copyright header in accordion.jte", () => {
    expect(accSrc).toContain("Copyright 2026 Francesco Bilotta");
    expect(accSrc).toContain("Apache License");
  });

  test("Apache copyright header in accordion/item.jte", () => {
    expect(itemSrc).toContain("Copyright 2026 Francesco Bilotta");
    expect(itemSrc).toContain("Apache License");
  });

  test("Apache copyright header in accordion.css", () => {
    expect(cssSrc).toContain("Copyright 2026 Francesco Bilotta");
    expect(cssSrc).toContain("Apache License");
  });
});

// ---------------------------------------------------------------------------
// Doc-comment header (accordion.jte)
// ---------------------------------------------------------------------------
describe("accordion -- doc-comment header (accordion.jte)", () => {
  test("has JTE comment block with labelled sections", () => {
    expect(accSrc).toContain("<%--");
    expect(accSrc).toContain("--%>");
    expect(accSrc).toMatch(/TIER:/);
    expect(accSrc).toMatch(/STRUCTURE/);
    expect(accSrc).toMatch(/A11y/);
    expect(accSrc).toMatch(/Params:/);
    expect(accSrc).toMatch(/Usage:/);
  });

  test("cites WAI-ARIA APG Accordion source URL", () => {
    expect(accSrc).toContain("https://www.w3.org/WAI/ARIA/apg/patterns/accordion/");
  });

  test("usage block shows @@template.lievit.accordion( syntax", () => {
    expect(accSrc).toContain("@@template.lievit.accordion(");
  });
});

// ---------------------------------------------------------------------------
// Doc-comment header (accordion/item.jte)
// ---------------------------------------------------------------------------
describe("accordion-item -- doc-comment header", () => {
  test("has JTE comment block with labelled sections", () => {
    expect(itemSrc).toContain("<%--");
    expect(itemSrc).toContain("--%>");
    expect(itemSrc).toMatch(/TIER:/);
    expect(itemSrc).toMatch(/STRUCTURE/);
    expect(itemSrc).toMatch(/A11y/);
    expect(itemSrc).toMatch(/Params:/);
    expect(itemSrc).toMatch(/Usage:/);
  });

  test("cites WAI-ARIA APG Accordion source URL", () => {
    expect(itemSrc).toContain("https://www.w3.org/WAI/ARIA/apg/patterns/accordion/");
  });

  test("usage block shows @@template.lievit.accordion-item( syntax", () => {
    expect(itemSrc).toContain("@@template.lievit.accordion-item(");
  });
});

// ---------------------------------------------------------------------------
// Tier invariants -- PARTIAL (not WIRE)
// ---------------------------------------------------------------------------
describe("accordion -- PARTIAL tier invariants", () => {
  test("accordion.jte: no expandedIds / collapsible WIRE params", () => {
    expect(accMarkup).not.toMatch(/@param.*expandedIds/);
    expect(accMarkup).not.toMatch(/@param.*collapsible/);
  });

  test("accordion.jte: no List<Map> server param (old WIRE accordion API)", () => {
    expect(accMarkup).not.toMatch(/@param.*java\.util\.List/);
    expect(accMarkup).not.toMatch(/@param.*java\.util\.Set/);
  });

  test("accordion.jte: no l:click wire directive (no server round-trip to open)", () => {
    expect(accMarkup).not.toContain("l:click=");
  });

  test("accordion-item.jte: no l:click wire directive", () => {
    expect(itemMarkup).not.toContain("l:click=");
  });

  test("accordion.jte: no io.lievit import (JTE gate classpath has no io.lievit)", () => {
    expect(accSrc).not.toMatch(/@import io\.lievit/);
  });

  test("accordion-item.jte: no io.lievit import", () => {
    expect(itemSrc).not.toMatch(/@import io\.lievit/);
  });

  test("accordion.jte: has gg.jte.Content import and content @param (PARTIAL content slot)", () => {
    expect(accSrc).toContain("@import gg.jte.Content");
    expect(accSrc).toContain("@param gg.jte.Content content");
  });

  test("accordion-item.jte: has gg.jte.Content import and content @param (panel body slot)", () => {
    expect(itemSrc).toContain("@import gg.jte.Content");
    expect(itemSrc).toContain("@param gg.jte.Content content");
  });
});

// ---------------------------------------------------------------------------
// Param API (accordion.jte -- container)
// ---------------------------------------------------------------------------
describe("accordion -- param API (container)", () => {
  test("content: gg.jte.Content (the items slot)", () => {
    expect(accSrc).toContain("@param gg.jte.Content content");
  });

  test("variant defaults to default", () => {
    expect(accSrc).toContain('@param String variant = "default"');
  });

  test("cssClass and attrs present", () => {
    expect(accSrc).toContain('@param String cssClass = ""');
    expect(accSrc).toContain('@param String attrs = ""');
  });
});

// ---------------------------------------------------------------------------
// Param API (accordion/item.jte -- per-item)
// ---------------------------------------------------------------------------
describe("accordion-item -- param API", () => {
  test("label: String (trigger text)", () => {
    expect(itemSrc).toContain("@param String label");
  });

  test("content: gg.jte.Content (panel body)", () => {
    expect(itemSrc).toContain("@param gg.jte.Content content");
  });

  test("id defaults to lv-acc", () => {
    expect(itemSrc).toContain('@param String id = "lv-acc"');
  });

  test("name: nullable String (single-open grouping via platform <details name>)", () => {
    expect(itemSrc).toContain("@param String name = null");
  });

  test("open: boolean defaults to false (the controlled hook)", () => {
    expect(itemSrc).toContain("@param boolean open = false");
  });

  test("disabled: boolean defaults to false", () => {
    expect(itemSrc).toContain("@param boolean disabled = false");
  });

  test("panelRole: String defaults to region", () => {
    expect(itemSrc).toContain('@param String panelRole = "region"');
  });

  test("noDivider: boolean defaults to false", () => {
    expect(itemSrc).toContain("@param boolean noDivider = false");
  });

  test("cssClass and attrs present", () => {
    expect(itemSrc).toContain('@param String cssClass = ""');
    expect(itemSrc).toContain('@param String attrs = ""');
  });
});

// ---------------------------------------------------------------------------
// Data-slot topology
// ---------------------------------------------------------------------------
describe("accordion -- data-slot topology", () => {
  test('accordion root carries data-slot="accordion"', () => {
    expect(accMarkup).toContain('data-slot="accordion"');
  });

  test('accordion root carries data-variant for styling hooks and test selectors', () => {
    expect(accMarkup).toContain('data-variant="${variant}"');
  });

  test('accordion-item root carries data-slot="accordion-item"', () => {
    expect(itemMarkup).toContain('data-slot="accordion-item"');
  });

  test('summary (trigger) carries data-slot="accordion-trigger"', () => {
    expect(itemMarkup).toContain('data-slot="accordion-trigger"');
  });

  test('panel region carries data-slot="accordion-panel"', () => {
    expect(itemMarkup).toContain('data-slot="accordion-panel"');
  });
});

// ---------------------------------------------------------------------------
// Native <details>/<summary> -- the controlled/uncontrolled hook
// ---------------------------------------------------------------------------
describe("accordion-item -- native <details>/<summary> controlled/uncontrolled", () => {
  test("<details> uses open boolean smart-attribute open=\"${open}\" (NOT a String ternary)", () => {
    // Hard rule from brief: boolean smart-attr `open="${bool}"` NOT String ternary.
    // JTE emits the `open` attribute when the boolean is true; omits it when false.
    expect(itemMarkup).toContain('open="${open}"');
    // Confirm no ternary string form is present.
    expect(itemSrc).not.toMatch(/open="\$\{open\s*\?\s*"open"/);
    expect(itemSrc).not.toMatch(/open="\$\{open\s*\?\s*"true"/);
  });

  test("<details> uses name smart-attribute name=\"${name}\" (single-open grouping, platform)", () => {
    // name="${name}" emits the attribute when name is non-null, omits it when null.
    expect(itemMarkup).toContain('name="${name}"');
  });

  test("<details> is the root element of accordion-item", () => {
    expect(itemMarkup).toMatch(/<details\b/);
  });

  test("<summary> is the disclosure trigger inside <details>", () => {
    expect(itemMarkup).toMatch(/<summary\b/);
  });

  test("no <button> inside item template (summary is the trigger; no extra button needed)", () => {
    // The item uses <summary> as the trigger; a nested <button> would be incorrect for APG.
    expect(itemMarkup).not.toMatch(/<button\b/);
  });
});

// ---------------------------------------------------------------------------
// APG Accordion a11y contract (accordion-item.jte)
// ---------------------------------------------------------------------------
describe("accordion-item -- APG Accordion a11y contract", () => {
  test("summary id=header-btn-${id} forms the aria-labelledby anchor", () => {
    expect(itemSrc).toMatch(/id=.*header-btn-/);
    expect(itemSrc).toContain("triggerId");
  });

  test("summary aria-controls points to panel-${id}", () => {
    expect(itemSrc).toMatch(/aria-controls=.*panelId/);
  });

  test("panel region has id=panel-${id} matching the aria-controls target", () => {
    expect(itemSrc).toMatch(/id=.*panelId/);
  });

  test("panel region aria-labelledby wired to summary id (triggerId)", () => {
    expect(itemSrc).toMatch(/aria-labelledby=.*triggerId/);
  });

  test("panel region conditionally emits role using smart-attr (null suppresses)", () => {
    // role="${panelRole.isBlank() ? null : panelRole}" -- JTE omits the attr when null.
    expect(itemSrc).toMatch(/role=.*panelRole\.isBlank\(\)/);
  });

  test("panel aria-labelledby also conditional on panelRole (suppressed when blank)", () => {
    expect(itemSrc).toMatch(/aria-labelledby=.*panelRole\.isBlank\(\)/);
  });

  test("no hidden attribute on panel div (native <details> hides non-summary children)", () => {
    // The old WIRE version used hidden="${!isExpanded}" on the panel div.
    // The PARTIAL approach does not need this: <details> handles visibility natively.
    expect(itemMarkup).not.toContain('hidden="${');
  });

  test("disabled: aria-disabled smart-attr (\"true\" when disabled, null otherwise)", () => {
    // aria-disabled="${disabled ? "true" : null}"
    expect(itemSrc).toMatch(/aria-disabled=.*disabled.*"true".*null/);
  });

  test("disabled: tabindex smart-attr (\"-1\" when disabled, null otherwise)", () => {
    // tabindex="${disabled ? "-1" : null}"
    expect(itemSrc).toMatch(/tabindex=.*disabled.*"-1".*null/);
  });

  test("chevron span is aria-hidden=true (decorative)", () => {
    expect(itemMarkup).toContain('aria-hidden="true"');
  });

  test("chevron span has class=lv-accordion-chevron (CSS hook for rotation)", () => {
    expect(itemMarkup).toContain('class="lv-accordion-chevron"');
  });

  test("chevron uses @template.lievit.icon with name and size only (no extra params)", () => {
    expect(itemSrc).toMatch(/@template\.lievit\.icon\(name = "chevron-down", size = "1rem"\)/);
  });
});

// ---------------------------------------------------------------------------
// CSS companion
// ---------------------------------------------------------------------------
describe("accordion -- CSS companion (accordion.css)", () => {
  test("contains details[open] chevron rotation rule", () => {
    expect(cssSrc).toContain("details[open]");
    expect(cssSrc).toContain(".lv-accordion-chevron");
    expect(cssSrc).toContain("transform: rotate(180deg)");
  });

  test("contains WebKit details marker suppression rule", () => {
    expect(cssSrc).toContain("::-webkit-details-marker");
    expect(cssSrc).toContain("display: none");
  });

  test("CSS file contains copyright header", () => {
    expect(cssSrc).toContain("Copyright 2026 Francesco Bilotta");
  });
});

// ---------------------------------------------------------------------------
// Variants (accordion.jte container)
// ---------------------------------------------------------------------------
describe("accordion -- variants (container)", () => {
  test("default variant: references --lv-color-border, --lv-radius-md, --lv-shadow-xs", () => {
    expect(accSrc).toContain("var(--lv-color-border)");
    expect(accSrc).toContain("var(--lv-radius-md)");
    expect(accSrc).toContain("var(--lv-shadow-xs)");
  });

  test("ghost variant case: transparent background, no border", () => {
    expect(accSrc).toMatch(/case "ghost"\s*->\s*"background:transparent;border:0/);
  });

  test("borderless variant case: transparent background, no border", () => {
    expect(accSrc).toMatch(/case "borderless"\s*->\s*"background:transparent;border:0/);
  });

  test("variant drives variantStyle via switch (intent vocabulary)", () => {
    expect(accSrc).toContain("variantStyle");
    expect(accSrc).toContain("switch (variant)");
  });

  test("data-variant attribute on the root matches the active variant string", () => {
    expect(accMarkup).toContain('data-variant="${variant}"');
  });
});

// ---------------------------------------------------------------------------
// Token usage
// ---------------------------------------------------------------------------
describe("accordion -- token usage", () => {
  test("reads --lv-color-border for container border and item dividers", () => {
    const combined = accSrc + itemSrc;
    expect(combined).toContain("var(--lv-color-border)");
  });

  test("reads --lv-color-popover for default container background (accordion.jte)", () => {
    expect(accSrc).toContain("var(--lv-color-popover)");
  });

  test("reads --lv-color-popover-fg for header + body text (accordion/item.jte)", () => {
    expect(itemSrc).toContain("var(--lv-color-popover-fg)");
  });

  test("reads --lv-color-muted-fg for chevron colour", () => {
    expect(itemSrc).toContain("var(--lv-color-muted-fg)");
  });

  test("reads --lv-color-accent for summary hover background", () => {
    expect(itemSrc).toContain("var(--lv-color-accent)");
  });

  test("reads spacing tokens --lv-space-2/3/4/5 for padding", () => {
    expect(itemSrc).toContain("var(--lv-space-2)");
    expect(itemSrc).toContain("var(--lv-space-3)");
    expect(itemSrc).toContain("var(--lv-space-4)");
    expect(itemSrc).toContain("var(--lv-space-5)");
  });

  test("reads --lv-text-sm for text size", () => {
    expect(itemSrc).toContain("var(--lv-text-sm)");
  });

  test("reads --lv-font-medium for font weight", () => {
    expect(itemSrc).toContain("var(--lv-font-medium)");
  });

  test("reads --lv-font-sans for font family", () => {
    const combined = accSrc + itemSrc;
    expect(combined).toContain("var(--lv-font-sans)");
  });

  test("reads --lv-ring for focus-visible ring on the summary trigger", () => {
    expect(itemSrc).toContain("var(--lv-ring)");
  });

  test("reads --lv-shadow-xs for default variant shadow (accordion.jte)", () => {
    expect(accSrc).toContain("var(--lv-shadow-xs)");
  });

  test("reads --lv-radius-md for default variant border-radius (accordion.jte)", () => {
    expect(accSrc).toContain("var(--lv-radius-md)");
  });

  test("reads --lv-opacity-disabled for disabled item dimming", () => {
    expect(itemSrc).toContain("var(--lv-opacity-disabled)");
  });

  test("reads --lv-duration-fast for chevron transition timing", () => {
    expect(itemSrc).toContain("var(--lv-duration-fast)");
  });

  test("reads --lv-ease for chevron transition easing", () => {
    expect(itemSrc).toContain("var(--lv-ease)");
  });

  test("reads --lv-leading for panel body line-height", () => {
    expect(itemSrc).toContain("var(--lv-leading");
  });

  test("no bare hex colour literals in accordion.jte markup body", () => {
    expect(accMarkup).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  test("no bare hex colour literals in accordion-item.jte markup body", () => {
    expect(itemMarkup).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});

// ---------------------------------------------------------------------------
// CSP hygiene
// ---------------------------------------------------------------------------
describe("accordion -- CSP hygiene", () => {
  test("accordion.jte: no inline <script>", () => {
    expect(accMarkup).not.toMatch(/<script/i);
  });

  test("accordion-item.jte: no inline <script>", () => {
    expect(itemMarkup).not.toMatch(/<script/i);
  });

  test("accordion.jte: no inline on* event handler", () => {
    expect(accMarkup).not.toMatch(/\son[a-z]+=/i);
  });

  test("accordion-item.jte: no inline on* event handler", () => {
    expect(itemMarkup).not.toMatch(/\son[a-z]+=/i);
  });

  test("accordion.jte: no <style> block", () => {
    expect(accMarkup).not.toMatch(/<style[\s>]/i);
  });

  test("accordion-item.jte: no <style> block", () => {
    expect(itemMarkup).not.toMatch(/<style[\s>]/i);
  });

  test("attrs param emitted as $unsafe on the root (TRUSTED static channel only)", () => {
    expect(accSrc).toContain("$unsafe{attrs}");
    expect(itemSrc).toContain("$unsafe{attrs}");
  });
});

// ---------------------------------------------------------------------------
// JTE template safety (hard rules from brief)
// ---------------------------------------------------------------------------
describe("accordion -- JTE template safety", () => {
  test("accordion.jte: no @if in attribute NAME position", () => {
    expect(accMarkup).not.toMatch(/@if\([^)]+\)\s*[a-zA-Z-]+="|@if\([^)]+\)[a-zA-Z-]+=/);
  });

  test("accordion-item.jte: no @if in attribute NAME position", () => {
    expect(itemMarkup).not.toMatch(/@if\([^)]+\)\s*[a-zA-Z-]+="|@if\([^)]+\)[a-zA-Z-]+=/);
  });

  test("accordion.jte: no tag-name expression (<${var}> pattern)", () => {
    expect(accMarkup).not.toMatch(/<\$\{[^}]+\}/);
  });

  test("accordion-item.jte: no tag-name expression (<${var}> pattern)", () => {
    expect(itemMarkup).not.toMatch(/<\$\{[^}]+\}/);
  });

  test("accordion.jte: JTE comment blocks are balanced (no nested comments)", () => {
    const opens = (accSrc.match(/<%--/g) || []).length;
    const closes = (accSrc.match(/--%>/g) || []).length;
    expect(opens).toBe(closes);
    expect(opens).toBeGreaterThan(0);
  });

  test("accordion-item.jte: JTE comment blocks are balanced (no nested comments)", () => {
    const opens = (itemSrc.match(/<%--/g) || []).length;
    const closes = (itemSrc.match(/--%>/g) || []).length;
    expect(opens).toBe(closes);
    expect(opens).toBeGreaterThan(0);
  });

  test("accordion.jte: all @for blocks closed with @endfor", () => {
    const fors = (accMarkup.match(/@for\b/g) || []).length;
    const endFors = (accMarkup.match(/@endfor\b/g) || []).length;
    expect(fors).toBe(endFors);
  });

  test("accordion-item.jte: all @for blocks closed with @endfor", () => {
    const fors = (itemMarkup.match(/@for\b/g) || []).length;
    const endFors = (itemMarkup.match(/@endfor\b/g) || []).length;
    expect(fors).toBe(endFors);
  });

  test("accordion.jte: all @if blocks closed with @endif", () => {
    const ifs = (accMarkup.match(/@if\b/g) || []).length;
    const endIfs = (accMarkup.match(/@endif\b/g) || []).length;
    expect(ifs).toBe(endIfs);
  });

  test("accordion-item.jte: all @if blocks closed with @endif", () => {
    const ifs = (itemMarkup.match(/@if\b/g) || []).length;
    const endIfs = (itemMarkup.match(/@endif\b/g) || []).length;
    expect(ifs).toBe(endIfs);
  });
});
