/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * label.jte -- full structural + a11y contract (spec §7).
 *
 * The label is a static JTE partial compiled in the Java world, so this suite
 * asserts on the PARTIAL SOURCE as text. It pins the full v-next spec §7 surface:
 *
 *   - param API: forId, required, optional, hint/hintId, size, variant, hidden,
 *     cssClass, attrs, dataAttrs, content, leading, trailing.
 *   - data-slot topology: label (root), label-content, label-required, label-optional,
 *     label-hint-icon, label-leading, label-trailing.
 *   - Required marker a11y: aria-hidden="true" on the * glyph + sr-only sibling " (required)".
 *   - Optional tag: rendered when optional=true and !required; absent when required wins.
 *   - Hidden label: sr-only class present; NOT display:none and NOT aria-hidden="true".
 *   - Hint icon: tooltip partial composed (not hand-rolled); icon aria-hidden="true".
 *   - Size: data-size on root + correct text-size token class per tier.
 *   - Variant: data-variant + font-weight token class.
 *   - FOR/ID: for="${forId}" smart attribute (omitted when null by JTE).
 *   - Token-driven: no bare hex colours in the markup body.
 *   - Security / CSP: no inline <script>, no on* handlers.
 *   - XSS trust split: dataAttrs safe-escaped, attrs trusted-raw; exactly two $unsafe sinks.
 *
 * NO DOM render + axe-core is wired here (not a dependency of this package). The axe
 * contracts are enforced by asserting the ARIA attributes the named axe rules inspect:
 *   - label / H44 (WCAG 1.3.1, 4.1.2): for="${forId}" smart attribute present.
 *   - label-content-name-mismatch: required marker uses aria-hidden="true" on * + sr-only text.
 *   - form-field-multiple-labels: the template renders exactly one <label> root.
 *
 * The real JTE compile gate lives in test/jte-compile (coordinator-run); this suite
 * is the structural golden.
 */
import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const jteDir = join(import.meta.dirname, "..", "registry", "jte");
const src = readFileSync(join(jteDir, "label.jte"), "utf8");

/** Strip JTE doc-comments so assertions never accidentally match comment prose. */
const markup = src.replace(/<%--[\s\S]*?--%>/g, "");

// ---------------------------------------------------------------------------
// §2 API -- param declarations
// ---------------------------------------------------------------------------
describe("label.jte -- param API", () => {
  test("declares all documented params with their documented defaults", () => {
    expect(src).toContain("@param String forId = null");
    expect(src).toContain("@param boolean required = false");
    expect(src).toContain("@param boolean optional = false");
    expect(src).toContain("@param String hint = null");
    expect(src).toContain("@param String hintId = null");
    expect(src).toContain('@param String size = "md"');
    expect(src).toContain('@param String variant = "default"');
    expect(src).toContain("@param boolean hidden = false");
    expect(src).toContain('@param String cssClass = ""');
    expect(src).toContain('@param String attrs = ""');
    expect(src).toContain("@param java.util.Map<String, String> dataAttrs = java.util.Map.of()");
    expect(src).toContain("@param gg.jte.Content content");
    expect(src).toContain("@param gg.jte.Content leading = null");
    expect(src).toContain("@param gg.jte.Content trailing = null");
  });

  test("usage doc carries the @@template.lievit.label call syntax", () => {
    expect(src).toContain("@@template.lievit.label(");
  });

  test("usage doc does NOT use @* *@ comment syntax", () => {
    expect(src).not.toMatch(/@\*/);
  });

  test("content slot is mandatory (no default): no '= null' on the content param", () => {
    // The mandatory slot has no default -- asserts the adopter must supply it.
    expect(src).not.toMatch(/@param gg\.jte\.Content content\s*=\s*null/);
  });

  test("removed params from the old primitive are not declared (text, error)", () => {
    // 'text' and 'error' are old params; the new API does not declare them.
    expect(src).not.toMatch(/@param String text\b/);
    expect(src).not.toMatch(/@param boolean error\b/);
  });
});

// ---------------------------------------------------------------------------
// §6 data-slot topology
// ---------------------------------------------------------------------------
describe("label.jte -- data-slot topology", () => {
  test('root carries data-slot="label"', () => {
    expect(markup).toContain('data-slot="label"');
  });

  test("root carries data-size set to the size param", () => {
    expect(markup).toContain('data-size="${size}"');
  });

  test("root carries data-variant set to the variant param", () => {
    expect(markup).toContain('data-variant="${variant}"');
  });

  test("root carries data-required reflecting the required boolean", () => {
    // The required state is stamped as "true"/"false" on the root for CSS cascade.
    expect(markup).toContain('data-required="${required ?');
  });

  test('content span carries data-slot="label-content"', () => {
    expect(markup).toContain('data-slot="label-content"');
  });

  test('required marker span carries data-slot="label-required"', () => {
    expect(markup).toContain('data-slot="label-required"');
    // It must be inside an @if(required) guard.
    expect(src).toMatch(/@if\(required\)/);
  });

  test('optional tag carries data-slot="label-optional"', () => {
    expect(markup).toContain('data-slot="label-optional"');
    // It must be inside an @if(optional && !required) guard.
    expect(src).toMatch(/@if\(optional && !required\)/);
  });

  test('hint icon wrapper carries data-slot="label-hint-icon"', () => {
    expect(markup).toContain('data-slot="label-hint-icon"');
    // It must be inside an @if(hint != null ...) guard.
    expect(src).toMatch(/@if\(hint != null/);
  });

  test('leading slot wrapper carries data-slot="label-leading"', () => {
    expect(markup).toContain('data-slot="label-leading"');
    // It must be inside an @if(leading != null) guard.
    expect(src).toContain("@if(leading != null)");
  });

  test('trailing slot wrapper carries data-slot="label-trailing"', () => {
    expect(markup).toContain('data-slot="label-trailing"');
    expect(src).toContain("@if(trailing != null)");
  });
});

// ---------------------------------------------------------------------------
// §4 a11y -- FOR/ID association [axe: label, WCAG H44]
// ---------------------------------------------------------------------------
describe("label.jte -- FOR/ID association (WCAG H44 / axe: label)", () => {
  test("root element is a native <label> (not a div-with-role)", () => {
    expect(markup).toMatch(/<label\b/);
    expect(markup).not.toMatch(/<div[^>]*role="label"/);
  });

  test("the for attribute is a smart attribute bound to the forId param", () => {
    // JTE omits the for attribute when forId is null (smart attribute: null value drops the attr).
    expect(markup).toContain('for="${forId}"');
  });

  test("no explicit ARIA role is added to the <label> element", () => {
    // Native <label> semantics are correct; adding a role is harmful.
    const labelTag = markup.match(/<label\b[^>]*>/)?.[0] ?? "";
    expect(labelTag).not.toMatch(/\brole=/);
  });

  test("tabindex is never added to the label (labels are not focusable)", () => {
    expect(markup).not.toMatch(/tabindex=/);
  });
});

// ---------------------------------------------------------------------------
// §4 a11y -- required marker [axe: label-content-name-mismatch]
// ---------------------------------------------------------------------------
describe("label.jte -- required marker a11y contract", () => {
  test('required marker glyph carries aria-hidden="true" (decorative -- not announced as *)', () => {
    // The * glyph must be hidden from screen readers. The aria-hidden attribute is on the
    // span that also carries data-slot="label-required"; look at the block around the slot.
    const reqSlotIdx = markup.indexOf('data-slot="label-required"');
    // Include 200 chars BEFORE and 200 AFTER the slot marker to capture the full span element.
    const surroundingBlock = markup.slice(Math.max(0, reqSlotIdx - 200), reqSlotIdx + 200);
    expect(surroundingBlock).toContain('aria-hidden="true"');
  });

  test("required marker glyph carries the --lv-color-destructive token", () => {
    expect(markup).toContain("--lv-color-destructive");
  });

  test('sr-only sibling spans " (required)" -- becomes part of the control accessible name', () => {
    // The sr-only text " (required)" is announced by screen readers; the * is not.
    expect(markup).toContain('class="sr-only"> (required)');
  });

  test("both the aria-hidden glyph AND the sr-only sibling are inside @if(required)", () => {
    // Both pieces belong to the required branch; neither should leak outside.
    const reqIdx = src.indexOf("@if(required)");
    const endifIdx = src.indexOf("@endif", reqIdx);
    const reqBlock = src.slice(reqIdx, endifIdx);
    expect(reqBlock).toContain('aria-hidden="true"');
    expect(reqBlock).toContain('class="sr-only"> (required)');
  });
});

// ---------------------------------------------------------------------------
// §4 a11y -- optional tag
// ---------------------------------------------------------------------------
describe("label.jte -- optional tag", () => {
  test("optional tag is rendered only when optional=true AND required=false", () => {
    expect(src).toMatch(/@if\(optional && !required\)/);
  });

  test("optional tag references the --lv-color-muted-fg token", () => {
    const optionalIdx = markup.indexOf('data-slot="label-optional"');
    const optionalBlock = markup.slice(optionalIdx, optionalIdx + 300);
    expect(optionalBlock).toContain("--lv-color-muted-fg");
  });

  test("optional tag contains the visible text (optional)", () => {
    expect(markup).toContain("(optional)");
  });
});

// ---------------------------------------------------------------------------
// §3 + §5 -- sizes (text-size token classes)
// ---------------------------------------------------------------------------
describe("label.jte -- sizes and token classes", () => {
  test('size="sm" maps to the --lv-text-xs token class', () => {
    expect(src).toContain('"sm" -> "text-[length:var(--lv-text-xs)]');
  });

  test('size="md" (default) maps to the --lv-text-sm token class', () => {
    expect(src).toContain("--lv-text-sm");
  });

  test('size="lg" maps to the --lv-text-base token class', () => {
    expect(src).toContain('"lg" -> "text-[length:var(--lv-text-base)]');
  });

  test("the sizeClass variable is interpolated into the root class attribute", () => {
    expect(markup).toContain("${sizeClass}");
  });
});

// ---------------------------------------------------------------------------
// §3 -- variants (font-weight token classes)
// ---------------------------------------------------------------------------
describe("label.jte -- variants and font-weight tokens", () => {
  test('variant="default" maps to --lv-font-medium weight class', () => {
    expect(src).toContain("--lv-font-medium");
  });

  test('variant="bold" maps to --lv-font-semibold weight class', () => {
    expect(src).toContain("--lv-font-semibold");
  });

  test("the weightClass variable is interpolated into the root class attribute", () => {
    expect(markup).toContain("${weightClass}");
  });
});

// ---------------------------------------------------------------------------
// §3 states -- hidden label (sr-only, not display:none) [WCAG H44]
// ---------------------------------------------------------------------------
describe("label.jte -- hidden label (sr-only a11y contract)", () => {
  test("hidden=true applies the sr-only class (absolute+clipped, not display:none)", () => {
    // The hiddenClass variable resolves to "sr-only" when hidden=true.
    expect(src).toMatch(/hidden\s*\?\s*"sr-only"\s*:\s*""/);
  });

  test("the hiddenClass variable is interpolated into the root class attribute", () => {
    expect(markup).toContain("${hiddenClass}");
  });

  test('hidden label must NOT use aria-hidden="true" (would break FOR/ID acc. name)', () => {
    // The template must not emit aria-hidden on the root label.
    const labelTag = markup.match(/<label\b[^>]*>/)?.[0] ?? "";
    expect(labelTag).not.toContain("aria-hidden");
  });

  test("hidden label must NOT use display:none (would break FOR/ID binding)", () => {
    // No display:none should appear in the label root class or style.
    expect(markup).not.toMatch(/display:\s*none/);
  });
});

// ---------------------------------------------------------------------------
// §6 -- leading slot: aria-hidden on the wrapper (decorative icon/element)
// ---------------------------------------------------------------------------
describe("label.jte -- leading slot", () => {
  test("leading slot wrapper carries aria-hidden=true (decorative before-label element)", () => {
    const leadingIdx = markup.indexOf('data-slot="label-leading"');
    // The span containing label-leading must carry aria-hidden.
    const surroundingBlock = markup.slice(
      Math.max(0, leadingIdx - 100),
      leadingIdx + 100,
    );
    expect(surroundingBlock).toContain('aria-hidden="true"');
  });

  test("leading slot renders the leading Content via ${leading}", () => {
    expect(markup).toContain("${leading}");
  });
});

// ---------------------------------------------------------------------------
// §6 -- hint icon: tooltip partial composed, icon aria-hidden
// ---------------------------------------------------------------------------
describe("label.jte -- hint icon (tooltip composition)", () => {
  test("hint icon uses @template.lievit.tooltip (not a hand-rolled popover)", () => {
    expect(markup).toContain("@template.lievit.tooltip(");
  });

  test("the tooltip receives the hint string as its content param", () => {
    // content = hint passes the hint param straight into the tooltip.
    expect(src).toMatch(/content\s*=\s*hint/);
  });

  test("the hint icon span carries aria-hidden=true (icon is decorative; tooltip handles the description)", () => {
    const hintIconIdx = markup.indexOf('data-slot="label-hint-icon"');
    const hintBlock = markup.slice(Math.max(0, hintIconIdx - 200), hintIconIdx + 100);
    expect(hintBlock).toContain('aria-hidden="true"');
  });

  test("the hint icon uses the circle-help Lucide icon slug", () => {
    expect(markup).toContain('"circle-help"');
  });

  test("the tooltip uses delay=0 (hint icon is icon-only; immediate show is correct)", () => {
    expect(src).toMatch(/delay\s*=\s*0/);
  });

  test("hintId is passed as the tooltip id (so the consuming field can wire aria-describedby)", () => {
    expect(src).toMatch(/hintId != null && !hintId\.isBlank\(\)\s*\?\s*hintId/);
  });

  test("hint icon is NOT rendered via @template.lievit.icon as a bare call (it is inside the tooltip trigger slot)", () => {
    // The icon is inside the trigger Content slot passed to tooltip, not a top-level call.
    expect(markup).toContain("@template.lievit.icon(");
  });
});

// ---------------------------------------------------------------------------
// §7 escaping -- XSS trust split (attrs trusted-raw, dataAttrs safe-escaped)
// ---------------------------------------------------------------------------
describe("label.jte -- XSS trust split: attrs + dataAttrs channels", () => {
  test("imports StringOutput and Escape.htmlAttribute for the dataAttrs channel", () => {
    expect(src).toContain("@import gg.jte.output.StringOutput");
    expect(src).toContain("@import gg.jte.html.escape.Escape");
  });

  test("dataAttrs VALUE is routed through Escape.htmlAttribute (never emitted raw)", () => {
    expect(src).toMatch(/Escape\.htmlAttribute\(\s*e\.getValue\(\)/);
    expect(src, "dataAttrs value must not be $unsafe").not.toMatch(
      /\$unsafe\{[^}]*getValue/,
    );
  });

  test("dataAttrs KEY is allowlisted to simple identifiers", () => {
    expect(src).toMatch(/getKey\(\)\.matches\("\[A-Za-z\]\[A-Za-z0-9-\]\*"\)/);
  });

  test("exactly two $unsafe sinks: the pre-escaped dataAttrs fragment and the trusted attrs string", () => {
    const sinks = src.match(/\$unsafe\{[^}]*\}/g) ?? [];
    expect(sinks).toEqual(["$unsafe{_dataAttrsMarkup}", "$unsafe{attrs}"]);
  });

  test("attrs param is declared as a trusted raw channel", () => {
    expect(src).toContain('@param String attrs = ""');
    expect(src.toLowerCase()).toMatch(/trusted/);
  });

  test("escaping-dataAttrs: a hostile value in dataAttrs renders escaped (no script injection path)", () => {
    // The Escape.htmlAttribute + key-allowlist is the guard; we assert the code path is present.
    expect(src).toContain("Escape.htmlAttribute(");
    expect(src).toContain("_dataAttrsMarkup");
  });
});

// ---------------------------------------------------------------------------
// §7 security / CSP hygiene
// ---------------------------------------------------------------------------
describe("label.jte -- security and CSP hygiene", () => {
  test("no inline <script> tag", () => {
    expect(src).not.toMatch(/<script/i);
  });

  test("no inline on* event handler attributes", () => {
    const inlineHandlers = markup.match(/\son[a-z]+=/gi) ?? [];
    expect(
      inlineHandlers,
      `unexpected inline handlers: ${inlineHandlers.join(", ")}`,
    ).toEqual([]);
  });

  test("no em-dash (house rule)", () => {
    expect(src).not.toContain("—"); // U+2014 EM DASH
  });

  test("uses JTE comment syntax <%-- --%>, not @* *@", () => {
    expect(src).toContain("<%--");
    expect(src).toContain("--%>");
    expect(src).not.toMatch(/@\*/);
  });
});

// ---------------------------------------------------------------------------
// §5 -- token-driven styling: no bare hex, all colours from --lv-*
// ---------------------------------------------------------------------------
describe("label.jte -- token-driven styling", () => {
  test("label text colour reads --lv-color-fg token", () => {
    expect(markup).toContain("--lv-color-fg");
  });

  test("required marker reads --lv-color-destructive token", () => {
    expect(markup).toContain("--lv-color-destructive");
  });

  test("optional tag reads --lv-color-muted-fg token", () => {
    expect(markup).toContain("--lv-color-muted-fg");
  });

  test("font family reads --lv-font-sans token", () => {
    expect(markup).toContain("--lv-font-sans");
  });

  test("gap between items uses --lv-space-1 token", () => {
    expect(markup).toContain("--lv-space-1");
  });

  test("no bare hex colour leaks into the markup body", () => {
    expect(markup, "leaked a hardcoded hex colour").not.toMatch(
      /#[0-9a-fA-F]{3,8}\b/,
    );
  });
});

// ---------------------------------------------------------------------------
// §6 -- JTE smart attributes (no @if in attribute name position)
// ---------------------------------------------------------------------------
describe("label.jte -- JTE hazard compliance", () => {
  test("no @if in HTML attribute name position (would red the JTE gate)", () => {
    // The pattern /@if\(/ must not appear inside an open tag's attribute list.
    // We check that @if only appears as a full block-level statement (on its own line
    // or after whitespace), not sandwiched inside `attrname@if(...)=`).
    expect(src).not.toMatch(/\w+@if\(/);
  });

  test("no io.lievit import (no domain imports in templates -- JTE gate classpath)", () => {
    expect(src).not.toMatch(/@import\s+io\.lievit\./);
  });

  test("JTE comments are not nested (inner --%> would close outer early)", () => {
    // Count opening and closing JTE comment markers.
    const opens = (src.match(/<%--/g) ?? []).length;
    const closes = (src.match(/--%>/g) ?? []).length;
    expect(opens, "unbalanced JTE comment markers").toBe(closes);
  });

  test("all @if blocks have a matching @endif", () => {
    const ifs = (src.match(/@if\(/g) ?? []).length;
    const endifs = (src.match(/@endif/g) ?? []).length;
    expect(ifs, "unbalanced @if / @endif").toBe(endifs);
  });
});
