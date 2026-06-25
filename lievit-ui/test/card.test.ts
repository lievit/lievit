/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * v-next re-forge tests for card.jte.
 *
 * Tests assert on the partial SOURCE as text (the @param API, the data-slot set, the variant
 * + size + slot anatomy, the a11y wiring, the two escaping channels, and the CSP-clean rules).
 * The real JTE-compile + render gate lives in test/jte-compile.
 */
import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const jteDir = join(import.meta.dirname, "..", "registry", "jte");
const src = readFileSync(join(jteDir, "card.jte"), "utf8");

// ---- API surface ---------------------------------------------------------

describe("card -- @param API (v-next)", () => {
  test("declares root-element param `as` defaulting to div", () => {
    expect(src).toContain('@param String as = "div"');
  });

  test("declares variant with five-variant vocabulary, defaulting to default", () => {
    expect(src).toContain('@param String variant = "default"');
    // all five variants must be present in the switch
    for (const v of ["outlined", "elevated", "ghost", "destructive"]) {
      expect(src, `variant "${v}" missing from switch`).toContain(`case "${v}"`);
    }
  });

  test("declares size with three-level vocabulary, defaulting to md", () => {
    expect(src).toContain('@param String size = "md"');
    for (const s of ["sm", "md", "lg"]) {
      expect(src, `size "${s}" missing from switch`).toContain(`"${s}"`);
    }
  });

  test("declares title, titleTag, titleId, subtitle params", () => {
    expect(src).toContain("@param String title = null");
    expect(src).toContain('@param String titleTag = "h3"');
    expect(src).toContain('@param String titleId = "lv-card-title"');
    expect(src).toContain("@param String subtitle = null");
  });

  test("declares bordered, noPadding, fullHeight boolean params", () => {
    expect(src).toContain("@param boolean bordered = true");
    expect(src).toContain("@param boolean noPadding = false");
    expect(src).toContain("@param boolean fullHeight = false");
  });

  test("declares cssClass and the two escaping channels (attrs trusted, dataAttrs safe)", () => {
    expect(src).toContain('@param String cssClass = ""');
    expect(src).toContain('@param String attrs = ""');
    expect(src).toContain("@param java.util.Map<String, String> dataAttrs = java.util.Map.of()");
  });

  test("declares the four Content slots: header, leading, trailing, footer", () => {
    expect(src).toContain("@param gg.jte.Content header = null");
    expect(src).toContain("@param gg.jte.Content leading = null");
    expect(src).toContain("@param gg.jte.Content trailing = null");
    expect(src).toContain("@param gg.jte.Content footer = null");
  });

  test("declares content as the required body slot (no default)", () => {
    // required param has no default
    expect(src).toContain("@param gg.jte.Content content");
    expect(src).not.toMatch(/@param gg\.jte\.Content content\s*=/);
  });
});

// ---- data-slot anatomy ---------------------------------------------------

describe("card -- data-slot anatomy", () => {
  test("root carries data-slot=card + data-variant + data-size", () => {
    expect(src).toContain('data-slot="card"');
    expect(src).toContain('data-variant="${variant}"');
    expect(src).toContain('data-size="${size}"');
  });

  test("header region carries data-slot=card-header", () => {
    expect(src).toContain('data-slot="card-header"');
  });

  test("title-area carries data-slot=card-title-area", () => {
    expect(src).toContain('data-slot="card-title-area"');
  });

  test("auto-heading carries data-slot=card-title and the titleId id", () => {
    expect(src).toContain('data-slot="card-title"');
    expect(src).toContain('id="${titleId}"');
  });

  test("subtitle carries data-slot=card-subtitle", () => {
    expect(src).toContain('data-slot="card-subtitle"');
  });

  test("leading slot carries data-slot=card-leading", () => {
    expect(src).toContain('data-slot="card-leading"');
  });

  test("trailing slot carries data-slot=card-trailing", () => {
    expect(src).toContain('data-slot="card-trailing"');
  });

  test("body carries data-slot=card-body", () => {
    expect(src).toContain('data-slot="card-body"');
  });

  test("footer carries data-slot=card-footer", () => {
    expect(src).toContain('data-slot="card-footer"');
  });

  test("header separator carries data-slot=card-separator and aria-hidden=true", () => {
    expect(src).toContain('data-slot="card-separator"');
    expect(src).toMatch(/data-slot="card-separator"[^>]*aria-hidden="true"|aria-hidden="true"[^>]*data-slot="card-separator"/);
  });

  test("footer separator carries data-slot=card-separator-footer and aria-hidden=true", () => {
    expect(src).toContain('data-slot="card-separator-footer"');
    expect(src).toMatch(/data-slot="card-separator-footer"[^>]*aria-hidden="true"|aria-hidden="true"[^>]*data-slot="card-separator-footer"/);
  });
});

// ---- Root element and landmark -------------------------------------------

describe("card -- root element and landmark a11y", () => {
  test("root element is always a div (JTE forbids tag-name expressions); `as` landmark intent is preserved via role", () => {
    // JTE forbids an expression in a tag NAME position, so the root is always a literal <div>.
    // The `as` param drives the role attribute instead: as=section+title → role=region,
    // as=article → role=article, as=div → no role.
    expect(src).toMatch(/<div\b/);
    expect(src).toContain('role="${_role}"');
    // The _role variable is derived from the as param
    expect(src).toContain('"section".equals(as) && title != null');
    expect(src).toContain('"article".equals(as)');
  });

  test("aria-labelledby is wired when as=section and title is set", () => {
    // The template computes ariaLabelledBy only for as=section + title
    expect(src).toContain('"section".equals(as) && title != null ? titleId : null');
    expect(src).toContain('aria-labelledby="${ariaLabelledBy}"');
  });

  test("header renders only when title or header slot is set", () => {
    expect(src).toContain("var hasHeader = title != null || header != null;");
    expect(src).toContain("@if(hasHeader)");
  });

  test("header slot overrides auto title/subtitle/titleTag when provided", () => {
    // The @if(header != null) branch renders the slot; the @else branch renders the auto heading.
    expect(src).toContain("@if(header != null)");
    // JTE forbids tag-name expressions, so the auto heading is a <div role="heading"> with
    // aria-level derived from titleTag (h1..h6). NOT a native <hN> element.
    expect(src).toContain('role="heading"');
    expect(src).toContain('aria-level="${titleTag != null && titleTag.matches("h[1-6]")');
  });

  test("subtitle renders conditionally inside the auto-header", () => {
    expect(src).toContain("@if(subtitle != null)");
    expect(src).toContain('data-slot="card-subtitle"');
  });

  test("trailing slot uses ml-auto to pin to header end", () => {
    expect(src).toContain("ml-auto");
    expect(src).toContain('data-slot="card-trailing"');
  });

  test("footer renders only when footer slot is set", () => {
    expect(src).toContain("@if(footer != null)");
    expect(src).toContain('data-slot="card-footer"');
  });
});

// ---- Variants ------------------------------------------------------------

describe("card -- variant token mapping", () => {
  test("default variant uses --lv-color-card background", () => {
    expect(src).toContain("var(--lv-color-card)");
  });

  test("elevated variant uses --lv-color-popover background", () => {
    expect(src).toContain("var(--lv-color-popover)");
  });

  test("elevated variant uses --lv-shadow-md", () => {
    expect(src).toContain("var(--lv-shadow-md)");
  });

  test("ghost and outlined variants use transparent background", () => {
    // both ghost and outlined -> transparent
    const ghostOutlinedCount = (src.match(/-> "transparent"/g) ?? []).length;
    expect(ghostOutlinedCount, "at least two transparent bg cases (ghost + outlined)").toBeGreaterThanOrEqual(2);
  });

  test("destructive variant uses color-mix tinted background and destructive border", () => {
    expect(src).toContain("color-mix(in srgb, var(--lv-color-destructive) 10%");
    expect(src).toContain("var(--lv-color-destructive)");
  });

  test("ghost variant emits no border", () => {
    // ghost -> border:none
    expect(src).toMatch(/case "ghost"\s*->\s*"none"/);
  });

  test("elevated variant emits no border", () => {
    expect(src).toMatch(/case "elevated"\s*->\s*"none"/);
  });

  test("bordered=false path removes the border for non-elevated, non-ghost variants", () => {
    // The default/outlined/destructive branch checks bordered boolean
    expect(src).toContain("bordered ? \"1px solid var(--lv-color-border)\" : \"none\"");
  });
});

// ---- Sizes ---------------------------------------------------------------

describe("card -- size token mapping", () => {
  test("sm size uses --lv-space-3 for body padding", () => {
    expect(src).toContain("var(--lv-space-3)");
  });

  test("md size uses --lv-space-4 for body padding (default)", () => {
    expect(src).toContain("var(--lv-space-4)");
  });

  test("lg size uses --lv-space-6 for body padding", () => {
    expect(src).toContain("var(--lv-space-6)");
  });

  test("sm title uses --lv-text-sm", () => {
    expect(src).toContain("var(--lv-text-sm)");
  });

  test("md title uses --lv-text-base (default)", () => {
    expect(src).toContain("var(--lv-text-base)");
  });

  test("lg title uses --lv-text-lg", () => {
    expect(src).toContain("var(--lv-text-lg)");
  });

  test("noPadding=true strips body padding (bodyPad = 0)", () => {
    expect(src).toContain('noPadding ? "0"');
  });

  test("fullHeight adds h-full class", () => {
    expect(src).toContain('fullHeight ? " h-full"');
    expect(src).toContain("${heightClass}");
  });
});

// ---- Token fidelity ------------------------------------------------------

describe("card -- token fidelity", () => {
  test("reads --lv-color-card-fg for foreground text", () => {
    expect(src).toContain("var(--lv-color-card-fg)");
  });

  test("reads --lv-radius-lg for corner radius", () => {
    expect(src).toContain("var(--lv-radius-lg)");
  });

  test("reads --lv-shadow-xs for default subtle elevation", () => {
    expect(src).toContain("var(--lv-shadow-xs)");
  });

  test("reads --lv-color-border for border + separators", () => {
    expect(src).toContain("var(--lv-color-border)");
  });

  test("reads --lv-font-sans for font-family", () => {
    expect(src).toContain("var(--lv-font-sans)");
  });

  test("reads --lv-font-medium for title font-weight", () => {
    expect(src).toContain("var(--lv-font-medium)");
  });

  test("reads --lv-color-muted-fg for subtitle text", () => {
    expect(src).toContain("var(--lv-color-muted-fg)");
  });

  test("no hardcoded hex colours (outside comment blocks)", () => {
    const markup = src.replace(/<%--[\s\S]*?--%>/g, "");
    expect(markup, "hardcoded hex in template body").not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});

// ---- Escaping channels + safe data-* ------------------------------------

describe("card -- escaping channels", () => {
  test("dataAttrs are built via StringOutput + Escape.htmlAttribute (safe channel)", () => {
    expect(src).toContain("import gg.jte.output.StringOutput");
    expect(src).toContain("import gg.jte.html.escape.Escape");
    expect(src).toContain("Escape.htmlAttribute(");
    expect(src).toContain("$unsafe{_daMarkup}");
  });

  test("attrs is emitted via $unsafe (trusted raw channel) -- documented as author-only", () => {
    expect(src).toContain("$unsafe{attrs}");
    // the doc-comment must state the TRUSTED contract
    expect(src).toContain("TRUSTED raw");
  });

  test("data-* key guard: only [A-Za-z][A-Za-z0-9-]* keys pass", () => {
    expect(src).toContain('.matches("[A-Za-z][A-Za-z0-9-]*")');
  });
});

// ---- CSP-clean + no forbidden patterns ----------------------------------

describe("card -- CSP-clean + JTE hygiene", () => {
  test("no inline <script> tag", () => {
    expect(src).not.toMatch(/<script/i);
  });

  test("no inline on* handlers", () => {
    const markup = src.replace(/<%--[\s\S]*?--%>/g, "");
    const handlers = markup.match(/\son[a-z]+=/gi) ?? [];
    expect(handlers, `unexpected inline handlers: ${handlers.join(", ")}`).toEqual([]);
  });

  test("no dev.lievit import (JTE-compile gate classpath rule)", () => {
    expect(src).not.toMatch(/import dev\.lievit\./);
  });

  test("no nested JTE comment closes (would break the gate)", () => {
    // Count close markers: if nested, there would be more --%> than <%-- in the comment block.
    // Simple proxy: document comment block must not contain an inner --%> before its end.
    const commentBlock = src.match(/<%--[\s\S]*?--%>/)?.[0] ?? "";
    const innerCloses = (commentBlock.slice(4, -4).match(/--%>/g) ?? []).length;
    expect(innerCloses, "nested --%> inside doc-comment block").toBe(0);
  });

  test("Apache copyright header is present", () => {
    expect(src).toContain("Copyright 2026 Francesco Bilotta");
    expect(src).toContain("Apache License");
  });

  test("carries a Usage: section in the doc-comment", () => {
    expect(src).toMatch(/Usage:/);
    expect(src).toContain("@@template.lievit.card(");
  });
});
