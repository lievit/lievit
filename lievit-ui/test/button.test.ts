/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * Filament-grade button sizing + icon-only mode.
 *
 * The button is a presentational .jte partial compiled in the Java world, so -- as with the
 * other static-partials suites -- this harness asserts on the partial SOURCE as text: it pins
 * the height-based size scale that ALIGNS the button to the form controls in a toolbar (the
 * whole point: an [input][native-select][button] row lines up with no per-call height hacks),
 * that every variant composes with every size, the square accessible icon-only mode, and the
 * a11y / CSP contract (real <button>/<a>, focus ring, no inline script / on* handlers).
 * A render/golden in the Java runtime is out of scope for the JS suite; the real-compiler smoke
 * lives in test/jte-compile. This is the equivalent structural golden.
 */
import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const jteDir = join(import.meta.dirname, "..", "registry", "jte");
const src = readFileSync(join(jteDir, "button.jte"), "utf8");

/**
 * The form controls this button must align to read these exact height tokens, so the button's
 * per-size height MUST match for a toolbar row to line up:
 *   input.jte           -> h-[var(--lv-space-10)]                      (the default control height)
 *   native-select.jte   -> sm h-8 / default h-10 / lg h-12
 * Each entry: [size, heightToken, horizontalPaddingToken, textToken].
 */
const SIZE_SCALE: ReadonlyArray<readonly [string, string, string, string]> = [
  ["sm", "--lv-space-8", "--lv-space-3", "--lv-text-xs"],
  ["md", "--lv-space-10", "--lv-space-4", "--lv-text-sm"],
  ["lg", "--lv-space-12", "--lv-space-6", "--lv-text-base"],
];

const VARIANTS = ["primary", "secondary", "danger", "ghost", "outline"] as const;

describe("button -- params & docs API (Filament parity)", () => {
  test("declares the size + iconOnly + ariaLabel params with the documented defaults", () => {
    expect(src, "size param missing").toContain('@param String size = "md"');
    expect(src, "iconOnly param missing").toContain("@param boolean iconOnly = false");
    expect(src, "ariaLabel param missing").toContain("@param String ariaLabel = null");
    // the pre-existing API stays
    expect(src).toContain('@param String variant = "primary"');
    expect(src).toContain('@param String type = "button"');
    expect(src).toContain("@param String href = null");
    expect(src).toContain("@param boolean disabled = false");
    expect(src).toContain("@param gg.jte.Content content");
  });

  test("usage doc shows a sized call + an iconOnly call, with <%-- --%> syntax (not @* *@)", () => {
    expect(src).toContain("<%--");
    expect(src).toContain("--%>");
    expect(src, "must NOT use @* *@ comment syntax").not.toMatch(/@\*/);
    expect(src).toMatch(/Usage:/);
    expect(src).toContain("@@template.lievit.button(");
    expect(src).toContain("size = ");
    expect(src).toContain("iconOnly = true");
  });
});

describe("button -- extra-attributes channels (XSS trust split)", () => {
  test("declares both channels: trusted attrs (String) + safe dataAttrs (Map)", () => {
    expect(src, "trusted attrs param missing").toContain('@param String attrs = ""');
    expect(src, "safe dataAttrs param missing").toContain(
      "@param java.util.Map<String, String> dataAttrs = java.util.Map.of()",
    );
  });

  test("dataAttrs VALUE is escaped via JTE's own attribute escaper (Escape.htmlAttribute), NOT a bare interpolation", () => {
    // JTE's HTML parser forbids a raw @for in attribute-NAME position, so the fragment is
    // built once with each value routed through gg.jte.html.escape.Escape.htmlAttribute --
    // the SAME escaper ContentType.Html applies to a ${} in attribute-value position.
    expect(src).toContain("@import gg.jte.html.escape.Escape");
    expect(src).toMatch(/Escape\.htmlAttribute\(\s*e\.getValue\(\)/);
    // The value must NEVER be emitted raw (no $unsafe wrapping a getValue()).
    expect(src, "dataAttrs value must not be $unsafe").not.toMatch(/\$unsafe\{[^}]*getValue/);
  });

  test("only the escaped fragment + the trusted attrs reach $unsafe (no raw user value)", () => {
    // Exactly two sinks per branch: the pre-escaped dataAttrs fragment and the trusted attrs.
    const unsafeSinks = src.match(/\$unsafe\{[^}]*\}/g) ?? [];
    expect(unsafeSinks, `unexpected $unsafe sinks: ${unsafeSinks.join(", ")}`).toEqual([
      "$unsafe{dataAttrsMarkup}",
      "$unsafe{attrs}",
      "$unsafe{dataAttrsMarkup}", // <button> branch
      "$unsafe{attrs}",
    ]);
    expect(src.toLowerCase()).toMatch(/trusted/);
  });

  test("keys are validated as simple identifiers (a non-identifier key cannot inject markup)", () => {
    // The key sits in attribute-NAME position (unescaped), so it is allowlisted to an identifier.
    expect(src).toMatch(/getKey\(\)\.matches\("\[A-Za-z\]\[A-Za-z0-9-\]\*"\)/);
  });

  test("both branches (<a> and <button>) emit the escaped dataAttrs fragment", () => {
    const sinks = src.match(/\$unsafe\{dataAttrsMarkup\}/g) ?? [];
    expect(sinks.length, "dataAttrs fragment must be in both branches").toBe(2);
  });

  test("usage doc shows a SAFE dynamic example via dataAttrs with a user-supplied value", () => {
    expect(src).toContain("dataAttrs = java.util.Map.of(");
    expect(src.toLowerCase()).toMatch(/userSuppliedText/i);
  });
});

describe("button -- height-based size scale aligns to the form controls", () => {
  for (const [size, heightToken, padToken, textToken] of SIZE_SCALE) {
    test(`size="${size}" pins height h-[var(${heightToken})] (no py-based height that breaks alignment)`, () => {
      expect(src, `size ${size} must set height ${heightToken}`).toContain(`h-[var(${heightToken})]`);
    });

    test(`size="${size}" sets horizontal padding px-[var(${padToken})] and text-[length:var(${textToken})]`, () => {
      expect(src, `size ${size} missing horizontal padding ${padToken}`).toContain(`px-[var(${padToken})]`);
      expect(src, `size ${size} missing text size ${textToken}`).toContain(`text-[length:var(${textToken})]`);
    });
  }

  test("md is the default height AND equals the input/native-select default height (toolbar baseline)", () => {
    // the input.jte + native-select(default) both render h-[var(--lv-space-10)]; the md button must match.
    const input = readFileSync(join(jteDir, "input.jte"), "utf8");
    const nativeSelect = readFileSync(join(jteDir, "native-select.jte"), "utf8");
    expect(input, "input height token drifted").toContain("h-[var(--lv-space-10)]");
    expect(nativeSelect, "native-select default height token drifted").toContain("data-[size=default]:h-[var(--lv-space-10)]");
    // the button's default branch (md) carries the SAME token.
    expect(src).toContain("h-[var(--lv-space-10)]");
  });

  test("height is NOT expressed as vertical padding (py-*), which would break flush alignment", () => {
    expect(src, "button must be height-based, not py-based").not.toMatch(/\bpy-\[/);
  });
});

describe("button -- variants compose with every size", () => {
  for (const variant of VARIANTS) {
    test(`variant "${variant}" has a styling branch (composes with the size classes)`, () => {
      expect(src, `variant ${variant} branch missing`).toContain(`"${variant}"`);
    });
  }

  test("variant + size + shape classes are all interpolated together onto the element", () => {
    // base + sizeClass + shapeClass + variantClass + cssClass all land on the one class attr.
    expect(src).toMatch(/\$\{base\} \$\{sizeClass\} \$\{shapeClass\} \$\{variantClass\} \$\{cssClass\}/);
  });

  test("uses token-backed colours per variant (no bare hex)", () => {
    expect(src, "leaked a hardcoded hex colour").not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(src).toContain("var(--lv-color-primary)");
    expect(src).toContain("var(--lv-color-secondary)");
    expect(src).toContain("var(--lv-color-danger)");
    expect(src).toContain("var(--lv-color-border)"); // outline
  });
});

describe("button -- icon-only is a square, accessible, real control", () => {
  test("iconOnly sets width == height (square) per size and drops horizontal padding", () => {
    // sm square: w-8 + p-0 ; md square: w-10 + p-0 ; lg square: w-12 + p-0.
    expect(src).toContain("w-[var(--lv-space-8)] p-0");
    expect(src).toContain("w-[var(--lv-space-10)] p-0");
    expect(src).toContain("w-[var(--lv-space-12)] p-0");
  });

  test("icon-only carries an aria-label for the accessible name (no visible text label)", () => {
    expect(src).toContain('aria-label="${ariaLabel}"');
    // the doc must state ariaLabel is required for iconOnly.
    expect(src.toLowerCase()).toMatch(/required.*iconly|required.*icononly|arialabel is required|required when icononly/i);
  });

  test("icon-only stays the SAME real <button>/<a> element (role/keyboard/disabled for free)", () => {
    expect(src).toMatch(/<button\b/);
    expect(src).toMatch(/<a\b/);
    // it is NOT a div-with-role hand-roll.
    expect(src).not.toMatch(/<div[^>]*role="button"/);
  });
});

describe("button -- a11y, links, and CSP hygiene preserved", () => {
  test("href renders a real <a> link; disabled link drops href + gets aria-disabled", () => {
    expect(src).toContain("@if(href != null)");
    expect(src).toContain('href="${disabled ? null : href}"');
    expect(src).toContain('aria-disabled="${disabled ? "true" : null}"');
  });

  test("native <button> keeps type + disabled; focus-visible ring via the --lv-ring token", () => {
    expect(src).toContain('type="${type}"');
    expect(src).toContain('disabled="${disabled}"');
    expect(src).toContain("focus-visible:shadow-[var(--lv-ring)]");
  });

  test("no inline <script> and no inline on* handlers (CSP-clean)", () => {
    expect(src).not.toMatch(/<script/i);
    const inlineHandlers = src.match(/\son[a-z]+=/gi) ?? [];
    expect(inlineHandlers, `unexpected inline handlers: ${inlineHandlers.join(", ")}`).toEqual([]);
  });

  test("never reaches for Font Awesome / wa-icon", () => {
    expect(src.toLowerCase()).not.toMatch(/font-?awesome|wa-icon|fa-/);
  });
});
