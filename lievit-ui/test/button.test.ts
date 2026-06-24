/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * Filament-grade button sizing + icon-only mode + v-next loading state.
 *
 * The button is a presentational .jte partial compiled in the Java world, so -- as with the
 * other static-partials suites -- this harness asserts on the partial SOURCE as text: it pins
 * the height-based size scale that ALIGNS the button to the form controls in a toolbar row (the
 * whole point: an [input][native-select][button] row lines up with no per-call height hacks),
 * that every variant composes with every size, the square accessible icon-only mode, the
 * net-new loading state (aria-busy + spinner + activation blocked), and the
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
 * shadcn fidelity (issue #463 ④): the baseline is shadcn's h-9 (36px). The height-based size
 * scale a button uses to align to the form controls in a toolbar row:
 *   sm -> --lv-space-8  (32px)
 *   md -> --lv-space-9  (36px, the shadcn h-9 baseline + default)
 *   lg -> --lv-space-10 (40px)
 * Each entry: [size, heightToken, horizontalPaddingToken, textToken].
 */
const SIZE_SCALE: ReadonlyArray<readonly [string, string, string, string]> = [
  ["sm", "--lv-space-8", "--lv-space-3", "--lv-text-xs"],
  ["md", "--lv-space-9", "--lv-space-4", "--lv-text-sm"],
  ["lg", "--lv-space-10", "--lv-space-6", "--lv-text-base"],
];

const VARIANTS = [
  "primary",
  "secondary",
  "destructive",
  "destructive-outline",
  "destructive-ghost",
  "ghost",
  "outline",
] as const;

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

  test("declares the net-new loading param with default false", () => {
    expect(src, "loading param missing").toContain("@param boolean loading = false");
  });

  test("usage doc shows a sized call + an iconOnly call + a loading call, with <%-- --%> syntax (not @* *@)", () => {
    expect(src).toContain("<%--");
    expect(src).toContain("--%>");
    expect(src, "must NOT use @* *@ comment syntax").not.toMatch(/@\*/);
    expect(src).toMatch(/Usage:/);
    expect(src).toContain("@@template.lievit.button(");
    expect(src).toContain("size = ");
    expect(src).toContain("iconOnly = true");
    expect(src).toContain("loading = true");
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

  test("md is the default height, pinned to the shadcn h-9 baseline (--lv-space-9 = 36px)", () => {
    // shadcn fidelity (issue #463 ④): the button md baseline is h-9 (--lv-space-9, 36px).
    // The form controls (input / native-select, owned by the text-inputs wave) migrate to the
    // same 36px baseline separately; this assertion pins the button side of that shared decision.
    expect(src, "md default branch must pin the shadcn h-9 baseline").toContain("h-[var(--lv-space-9)]");
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
    expect(src).toContain("var(--lv-color-destructive)"); // shadcn destructive variant
    expect(src).toContain("var(--lv-color-border)"); // outline
  });
});

describe("button -- destructive-but-not-solid variants (red outline / red ghost)", () => {
  test("destructive-outline is a red-OUTLINED button: transparent bg, destructive text + border", () => {
    // shadcn outline shape (transparent fill, bordered, shadow-xs) but in the destructive tone --
    // the red action that is not the page's primary CTA.
    expect(src).toContain(
      'case "destructive-outline" -> "bg-transparent text-[var(--lv-color-destructive)] border-[var(--lv-color-destructive)] shadow-[var(--lv-shadow-xs)]',
    );
  });

  test("destructive-ghost is a red-PLAIN button: transparent bg, no border, destructive text", () => {
    expect(src).toContain(
      'case "destructive-ghost"   -> "bg-transparent text-[var(--lv-color-destructive)] border-transparent',
    );
  });

  test("both red-but-not-solid variants tint the hover from the destructive token (no bare hex)", () => {
    // a subtle destructive-tinted hover, faithful to shadcn's ghost/outline hover-accent pattern.
    const matches = src.match(
      /color-mix\(in_srgb,var\(--lv-color-destructive\)_10%,transparent\)/g,
    );
    expect(matches?.length, "both destructive-* hovers must tint from the destructive token").toBe(2);
  });

  test("docs surface the red-but-not-solid variants in the variant param + a usage example", () => {
    expect(src).toContain("destructive-outline");
    expect(src).toContain("destructive-ghost");
    expect(src, "usage example for the not-solid destructive action").toMatch(
      /variant = "destructive-outline"/,
    );
  });
});

describe("button -- icon-only is a square, accessible, real control", () => {
  test("iconOnly sets width == height (square) per size and drops horizontal padding", () => {
    // sm square: w-8 + p-0 ; md square: w-9 + p-0 ; lg square: w-10 + p-0 (shadcn h-9 baseline).
    expect(src).toContain("w-[var(--lv-space-8)] p-0");
    expect(src).toContain("w-[var(--lv-space-9)] p-0");
    expect(src).toContain("w-[var(--lv-space-10)] p-0");
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

describe("button -- loading state (net-new v-next)", () => {
  test("sets aria-busy=true when loading in both branches", () => {
    // WAI-ARIA: aria-busy signals the element is updating; the APG button pattern supports it.
    const ariaBusyMatches = src.match(/aria-busy="\$\{loading \? "true" : null\}"/g) ?? [];
    expect(ariaBusyMatches.length, "aria-busy must appear in both <a> and <button> branches").toBe(2);
  });

  test("renders an inline self-contained spinner in both branches when loading", () => {
    // The spinner is an inline CSS-spin ring (border-current), NOT the shared spinner partial:
    // keeps the button self-contained with no cross-partial dependency. Decorative (aria-hidden)
    // because the button already carries aria-busy.
    const spinnerMatches = src.match(/data-slot="button-spinner"/g) ?? [];
    expect(spinnerMatches.length, "inline spinner must be in both <a> and <button> branches").toBe(2);
    expect(src).toContain("animate-spin");
    expect(src).toContain('aria-hidden="true"');
    expect(src, "spinner must not pull the shared partial").not.toContain("@template.lievit.spinner(");
  });

  test("blocks activation: <button> uses isBlocked (disabled || loading), <a> drops href", () => {
    // isBlocked combines disabled + loading so the button is inert while loading.
    expect(src).toContain("boolean isBlocked = disabled || loading");
    expect(src).toContain("disabled=\"${isBlocked}\"");
    expect(src).toContain("href=\"${isBlocked ? null : href}\"");
  });

  test("loading is independent of disabled: aria-disabled covers both blocked states on <a>", () => {
    // <a> cannot be natively disabled; aria-disabled fires for isBlocked (either disabled or loading).
    expect(src).toContain('aria-disabled="${isBlocked ? "true" : null}"');
  });

  test("data-loading attribute is emitted on both branches for test-targeting and CSS hooks", () => {
    const dataLoadingMatches = src.match(/data-loading="\$\{loading\}"/g) ?? [];
    expect(dataLoadingMatches.length, "data-loading must be in both <a> and <button> branches").toBe(2);
  });

  test("loading param is documented in the params block with its activation-blocking semantics", () => {
    expect(src.toLowerCase()).toMatch(/loading.*spinner|spinner.*loading/i);
    expect(src.toLowerCase()).toMatch(/aria-busy/i);
    expect(src).toContain("@param boolean loading = false");
  });

  test("loading state does NOT introduce a new $unsafe sink (existing 4-sink count preserved)", () => {
    const unsafeSinks = src.match(/\$unsafe\{[^}]*\}/g) ?? [];
    expect(unsafeSinks, `unexpected $unsafe sinks: ${unsafeSinks.join(", ")}`).toEqual([
      "$unsafe{dataAttrsMarkup}",
      "$unsafe{attrs}",
      "$unsafe{dataAttrsMarkup}",
      "$unsafe{attrs}",
    ]);
  });
});

describe("button -- a11y, links, and CSP hygiene preserved", () => {
  test("href renders a real <a> link; blocked link (disabled or loading) drops href + gets aria-disabled", () => {
    expect(src).toContain("@if(href != null)");
    expect(src).toContain("href=\"${isBlocked ? null : href}\"");
    expect(src).toContain('aria-disabled="${isBlocked ? "true" : null}"');
  });

  test("native <button> keeps type + disabled; focus-visible ring via the --lv-ring token", () => {
    expect(src).toContain('type="${type}"');
    expect(src).toContain('disabled="${isBlocked}"');
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
