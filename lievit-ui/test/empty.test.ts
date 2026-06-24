/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * empty.jte -- full structural + a11y contract (spec §7).
 *
 * The empty partial is a static JTE source compiled in the Java world. This harness
 * asserts on the PARTIAL SOURCE as text (source-as-text golden pattern, mirrors alert.test.ts).
 * It pins: the full param API + defaults, the data-slot topology (empty, empty-illustration,
 * empty-title, empty-description, empty-action), the variant-to-icon switch (default/search/
 * error/offline), the size-to-class switch (sm/md/lg), iconOnly suppression, the
 * illustration escaping channels (imageUrl safe-escaped, image Content slot wins), the
 * aria-hidden contract on the illustration wrapper (decorative vs semantic), the XSS trust
 * split (attrs trusted raw, dataAttrs SAFE escaped), token-only styling (no bare hex),
 * and CSP hygiene (no inline script, no on* handlers). The real JTE compiler gate runs
 * out of band in test/jte-compile.
 */
import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const jteDir = join(import.meta.dirname, "..", "registry", "jte");
const src = readFileSync(join(jteDir, "empty.jte"), "utf8");

// Strip JTE comments so assertions do not hit doc-comment prose.
const markup = src.replace(/<%--[\s\S]*?--%>/g, "");

// ---------------------------------------------------------------------------
// Param API (spec §2)
// ---------------------------------------------------------------------------
describe("empty -- param API", () => {
  test("declares all documented params with their documented defaults", () => {
    expect(src).toContain('@param String variant = "default"');
    expect(src).toContain('@param String size = "md"');
    expect(src).toContain("@param String title = null");
    expect(src).toContain("@param String description = null");
    expect(src).toContain("@param String imageUrl = null");
    expect(src).toContain('@param String imageAlt = ""');
    expect(src).toContain("@param boolean iconOnly = false");
    expect(src).toContain('@param String cssClass = ""');
    expect(src).toContain('@param String attrs = ""');
    expect(src).toContain(
      "@param java.util.Map<String, String> dataAttrs = java.util.Map.of()",
    );
    expect(src).toContain("@param gg.jte.Content action = null");
    expect(src).toContain("@param gg.jte.Content image = null");
  });

  test("usage doc carries the @@template.lievit.empty call syntax", () => {
    expect(src).toContain("@@template.lievit.empty(");
  });

  test("imports gg.jte.Content for the action and image Content slots", () => {
    expect(src).toContain("@import gg.jte.Content");
  });
});

// ---------------------------------------------------------------------------
// data-slot topology (spec §6)
// ---------------------------------------------------------------------------
describe("empty -- data-slot topology", () => {
  test('root carries data-slot="empty"', () => {
    expect(markup).toContain('data-slot="empty"');
  });

  test("root carries data-variant set to the variant param", () => {
    expect(markup).toContain('data-variant="${variant}"');
  });

  test("root carries data-size set to the size param", () => {
    expect(markup).toContain('data-size="${size}"');
  });

  test('illustration wrapper carries data-slot="empty-illustration"', () => {
    expect(markup).toContain('data-slot="empty-illustration"');
  });

  test('title element carries data-slot="empty-title" (rendered only when title is non-null)', () => {
    expect(markup).toContain('data-slot="empty-title"');
    // Must be inside an @if(title != null) guard.
    expect(src).toMatch(/@if\(title != null\)/);
  });

  test('description element carries data-slot="empty-description" (rendered only when description is non-null)', () => {
    expect(markup).toContain('data-slot="empty-description"');
    expect(src).toMatch(/@if\(description != null\)/);
  });

  test('action wrapper carries data-slot="empty-action" (rendered only when action is non-null)', () => {
    expect(markup).toContain('data-slot="empty-action"');
    // action slot must be guarded by @if(action != null ...) (also && !iconOnly).
    expect(src).toContain("@if(action != null");
  });
});

// ---------------------------------------------------------------------------
// Variant-to-icon switch (spec §3)
// ---------------------------------------------------------------------------
describe("empty -- variant-to-icon switch", () => {
  test("default variant maps to the 'inbox' icon (the generic no-data icon)", () => {
    expect(src).toContain('"inbox"');
    // The default branch of the switch must emit "inbox".
    expect(src).toMatch(/default\s*->\s*"inbox"/);
  });

  test("search variant maps to 'search-x' (no results for query)", () => {
    expect(src).toContain('"search-x"');
    expect(src).toMatch(/case "search"\s*->\s*"search-x"/);
  });

  test("error variant maps to 'triangle-alert' (something went wrong)", () => {
    expect(src).toContain('"triangle-alert"');
    expect(src).toMatch(/case "error"\s*->\s*"triangle-alert"/);
  });

  test("offline variant maps to 'wifi-off' (connection unavailable)", () => {
    expect(src).toContain('"wifi-off"');
    expect(src).toMatch(/case "offline"\s*->\s*"wifi-off"/);
  });

  test("default icon is rendered via @template.lievit.icon (not a raw <svg>)", () => {
    expect(markup).toContain("@template.lievit.icon(");
    // The icon uses the derived _defaultIcon variable.
    expect(markup).toContain("_defaultIcon");
  });

  test("@template.lievit.icon is called WITHOUT an ariaHidden param (not a valid icon param)", () => {
    // The icon partial only accepts name, size, cssClass, label. ariaHidden is NOT a param.
    expect(markup).not.toMatch(/@template\.lievit\.icon\([^)]*ariaHidden/);
  });
});

// ---------------------------------------------------------------------------
// Size scale (spec §3)
// ---------------------------------------------------------------------------
describe("empty -- size scale", () => {
  test("sm size uses --lv-space-8 (32 px) for the icon glyph size", () => {
    expect(src).toContain('"var(--lv-space-8)"');
  });

  test("md size uses --lv-space-10 (40 px) for the icon glyph size (the default)", () => {
    expect(src).toContain('"var(--lv-space-10)"');
  });

  test("lg size uses --lv-space-16 (64 px) for the icon glyph size", () => {
    expect(src).toContain('"var(--lv-space-16)"');
  });

  test("illustration wrapper carries the size-appropriate token class", () => {
    // The illustration container class is derived from the size switch.
    expect(markup).toContain("${_illustrationSizeClass}");
  });

  test("title uses font-medium token at sm size", () => {
    expect(src).toContain("var(--lv-font-medium)");
  });

  test("title uses font-semibold token at lg size", () => {
    expect(src).toContain("var(--lv-font-semibold)");
  });

  test("title at sm uses --lv-text-sm", () => {
    expect(src).toContain("var(--lv-text-sm)");
  });

  test("title at md uses --lv-text-base", () => {
    expect(src).toContain("var(--lv-text-base)");
  });

  test("title at lg uses --lv-text-lg", () => {
    expect(src).toContain("var(--lv-text-lg)");
  });

  test("description at sm uses --lv-text-xs", () => {
    expect(src).toContain("var(--lv-text-xs)");
  });
});

// ---------------------------------------------------------------------------
// iconOnly mode (spec §2 + §3)
// ---------------------------------------------------------------------------
describe("empty -- iconOnly mode", () => {
  test("title and description elements are inside @if(!iconOnly) block", () => {
    expect(src).toMatch(/@if\(!iconOnly\)/);
  });

  test("action slot is suppressed when iconOnly=true (guarded by !iconOnly condition)", () => {
    // The action guard must include && !iconOnly.
    expect(src).toMatch(/@if\(action != null && !iconOnly\)/);
  });

  test("illustration element is NOT suppressed by iconOnly (still renders)", () => {
    // The illustration wrapper must NOT be inside any iconOnly guard.
    const illustrationIdx = src.indexOf('data-slot="empty-illustration"');
    const iconOnlyGuardIdx = src.lastIndexOf("@if(!iconOnly)", illustrationIdx);
    // iconOnlyGuardIdx must be -1 (no guard before the illustration) or at a position
    // that is already closed before the illustration.
    const iconOnlyEndIdx = src.indexOf("@endif", iconOnlyGuardIdx > -1 ? iconOnlyGuardIdx : 0);
    // If there is no !iconOnly guard before the illustration at all, that is correct.
    // If there is one, it must have ended before the illustration.
    expect(
      iconOnlyGuardIdx === -1 || iconOnlyEndIdx < illustrationIdx,
      "illustration must not be inside a !iconOnly guard",
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Illustration: image slot > imageUrl > default icon (spec §2 + §6)
// ---------------------------------------------------------------------------
describe("empty -- illustration priority", () => {
  test("image Content slot is rendered first (highest priority)", () => {
    // @if(image != null) must come before @elseif(imageUrl != null).
    const imageSlotIdx = src.indexOf("@if(image != null)");
    const imageUrlIdx = src.indexOf("@elseif(imageUrl != null)");
    expect(imageSlotIdx).toBeGreaterThan(-1);
    expect(imageUrlIdx).toBeGreaterThan(imageSlotIdx);
  });

  test("imageUrl is rendered as <img> inside @elseif(imageUrl != null) branch", () => {
    expect(src).toContain("@elseif(imageUrl != null)");
    expect(markup).toMatch(/<img/);
  });

  test("the <img> src uses the safe-escaped URL variable (not raw $unsafe{imageUrl})", () => {
    // The escaped URL must be built via Escape.htmlAttribute and emitted with $unsafe on
    // the pre-escaped variable -- never directly from the imageUrl param.
    expect(src).toContain("Escape.htmlAttribute(imageUrl, _escapedImageUrl_)");
    expect(src).toContain('$unsafe{_escapedImageUrl}');
    // Must NOT emit imageUrl directly into an attribute value position.
    expect(src).not.toMatch(/src="\$\{imageUrl\}"/);
    expect(src).not.toMatch(/src="\$unsafe\{imageUrl\}"/);
  });

  test("<img> alt attribute uses the imageAlt param (not hardcoded)", () => {
    expect(markup).toContain('alt="${imageAlt}"');
  });

  test("default icon path is the @else branch (no imageUrl, no image slot)", () => {
    // The @else branch renders the @template.lievit.icon call.
    const elseIdx = src.indexOf("@else");
    const iconTemplateIdx = src.indexOf("@template.lievit.icon(", elseIdx);
    expect(iconTemplateIdx).toBeGreaterThan(elseIdx);
  });

  test("image Content slot is rendered via ${image} (the gg.jte.Content JTE interpolation)", () => {
    expect(markup).toContain("${image}");
  });
});

// ---------------------------------------------------------------------------
// Accessibility: aria-hidden on illustration wrapper (spec §4)
// ---------------------------------------------------------------------------
describe("empty -- a11y: illustration wrapper aria-hidden contract", () => {
  test("illustration wrapper conditionally emits aria-hidden using a smart attribute (null => omitted)", () => {
    // Smart attribute: aria-hidden="${... ? "true" : null}" -- JTE omits when null.
    expect(markup).toMatch(/aria-hidden="\$\{[^}]*\? "true" : null\}"/);
  });

  test("aria-hidden condition: decorative when image slot is null AND imageAlt is blank", () => {
    // The condition must check both image == null and imageAlt blank/null.
    expect(src).toMatch(/_wrapperDecorativeAriaHidden\s*=\s*\(image == null\)/);
    expect(src).toMatch(/imageAlt == null \|\| imageAlt\.isBlank\(\)/);
  });

  test("title and description are <p> elements (not headings -- spec §4 + §8 anti-pattern)", () => {
    expect(markup).toMatch(/<p\s[^>]*data-slot="empty-title"/);
    expect(markup).toMatch(/<p\s[^>]*data-slot="empty-description"/);
    expect(markup).not.toMatch(/<h[1-6]\s[^>]*data-slot="empty-title"/);
    expect(markup).not.toMatch(/<h[1-6]\s[^>]*data-slot="empty-description"/);
  });

  test("root element is a plain <div> with no role override (spec §4: presentational region)", () => {
    // The root div must NOT hardcode a role attribute.
    // The caller may pass role via attrs; the partial never emits a fixed role.
    const rootSlice = markup.slice(markup.indexOf('data-slot="empty"'), markup.indexOf(">", markup.indexOf('data-slot="empty"')) + 1);
    expect(rootSlice).not.toMatch(/\brole="[^"]+"/);
  });

  test("no tabindex on illustration or text elements (non-interactive, spec §4)", () => {
    expect(markup).not.toContain("tabindex=");
  });
});

// ---------------------------------------------------------------------------
// Token-driven styling (spec §5 + §7)
// ---------------------------------------------------------------------------
describe("empty -- token-driven styling", () => {
  test("muted-fg token used for icon colour and description text", () => {
    expect(markup).toContain("var(--lv-color-muted-fg)");
  });

  test("fg token used for title text (higher-contrast than muted-fg)", () => {
    expect(markup).toContain("var(--lv-color-fg)");
  });

  test("font-sans token used for all text (not a hardcoded font stack)", () => {
    expect(markup).toContain("var(--lv-font-sans)");
  });

  test("space tokens used for gaps and padding (not hardcoded px values)", () => {
    // At least the --lv-space-6 vertical padding token must be present.
    expect(markup).toContain("var(--lv-space-6)");
    // And the gap between illustration and text block.
    expect(markup).toContain("var(--lv-space-2)");
  });

  test("radius-lg token used for the root corner radius", () => {
    expect(markup).toContain("var(--lv-radius-lg)");
  });

  test("no bare hex colour leaks into the markup", () => {
    expect(markup, "leaked a hardcoded hex colour").not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});

// ---------------------------------------------------------------------------
// Security / CSP hygiene (house rule)
// ---------------------------------------------------------------------------
describe("empty -- security and CSP hygiene", () => {
  test("no inline <script> tag", () => {
    expect(src).not.toMatch(/<script/i);
  });

  test("no inline on* event handler attributes", () => {
    const inlineHandlers = markup.match(/\son[a-z]+=/gi) ?? [];
    expect(inlineHandlers, `unexpected inline handlers: ${inlineHandlers.join(", ")}`).toEqual([]);
  });

  test("uses JTE comment syntax <%-- --%>, not @* *@", () => {
    expect(src).not.toMatch(/@\*/);
  });

  test("no em-dash (house rule)", () => {
    expect(src).not.toContain("—"); // U+2014 EM DASH
  });

  test("no io.lievit import (JTE-compile gate classpath rule)", () => {
    // The gate classpath is JDK + jte + registry/icons only; io.lievit fails to resolve.
    expect(src).not.toMatch(/@import\s+io\.lievit/);
  });

  test("no nested JTE comments inside the doc-comment block (would close the outer block early)", () => {
    // Nested comments inside the HEADER doc-block: an inner --%> closes the outer <%-- early.
    // Strategy: extract only the header doc comment block and verify no <%-- appears inside it.
    const firstOpen = src.indexOf("<%--");
    const firstClose = src.indexOf("--%>", firstOpen);
    const docBlock = src.slice(firstOpen + 4, firstClose);
    expect(docBlock, "nested <%-- found inside the header doc-comment block").not.toContain("<%--");
  });
});

// ---------------------------------------------------------------------------
// XSS trust split: attrs (trusted raw) + dataAttrs (SAFE escaped) (spec §2 + §6)
// ---------------------------------------------------------------------------
describe("empty -- XSS trust split: attrs + dataAttrs channels", () => {
  test("imports StringOutput and the Escape.htmlAttribute escaper for the dataAttrs channel", () => {
    expect(src).toContain("@import gg.jte.output.StringOutput");
    expect(src).toContain("@import gg.jte.html.escape.Escape");
  });

  test("dataAttrs VALUE is routed through Escape.htmlAttribute (never emitted raw)", () => {
    expect(src).toMatch(/Escape\.htmlAttribute\(\s*e\.getValue\(\)/);
    expect(src, "dataAttrs value must not be $unsafe").not.toMatch(/\$unsafe\{[^}]*getValue/);
  });

  test("dataAttrs KEY is allowlisted to simple identifiers", () => {
    expect(src).toMatch(/getKey\(\)\.matches\("\[A-Za-z\]\[A-Za-z0-9-\]\*"\)/);
  });

  test("imageUrl is routed through Escape.htmlAttribute (safe-escaped, not raw)", () => {
    expect(src).toContain("Escape.htmlAttribute(imageUrl, _escapedImageUrl_)");
  });

  test("the $unsafe sinks are: pre-escaped imageUrl, pre-escaped dataAttrs fragment, and the trusted attrs string", () => {
    const sinks = src.match(/\$unsafe\{[^}]*\}/g) ?? [];
    // Must include the three expected sinks (order in the template may vary).
    expect(sinks).toContain("$unsafe{_escapedImageUrl}");
    expect(sinks).toContain("$unsafe{_dataAttrsMarkup}");
    expect(sinks).toContain("$unsafe{attrs}");
    // Must not contain any other unexpected sink.
    expect(sinks.length, `unexpected extra $unsafe sinks: ${sinks.join(", ")}`).toBe(3);
  });

  test("attrs param is declared as a trusted raw channel (doc comment mentions TRUSTED)", () => {
    expect(src).toContain('@param String attrs = ""');
    expect(src.toUpperCase()).toMatch(/TRUSTED/);
  });
});

// ---------------------------------------------------------------------------
// Action slot (spec §2 + §7)
// ---------------------------------------------------------------------------
describe("empty -- action slot", () => {
  test("action slot is rendered via ${action} inside the empty-action wrapper", () => {
    expect(markup).toContain("${action}");
    const actionIdx = markup.indexOf('data-slot="empty-action"');
    const actionEnd = markup.indexOf("</div>", actionIdx);
    expect(markup.slice(actionIdx, actionEnd)).toContain("${action}");
  });

  test("action is an opaque Content slot -- the partial does not inspect or modify it", () => {
    // The action param is declared as gg.jte.Content (opaque rendering).
    expect(src).toContain("@param gg.jte.Content action = null");
    // No manipulation of the action Content (no conditional inside the action emit).
    expect(markup).toContain("${action}");
  });
});
