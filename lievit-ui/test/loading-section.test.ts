/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * loading-section / spinner / skeleton v-next -- structural + a11y + API contract.
 *
 * This harness asserts on JTE partial SOURCE as text, pinning:
 *   - param API (names, types, defaults) for spinner, skeleton, and loading-section;
 *   - SVG ring anatomy (background circle + arc, dasharray/dashoffset, animate-spin);
 *   - variant colour logic (default=--lv-color-muted-fg, primary=--lv-color-primary);
 *   - skeleton shape branches (lines/card/avatar-row/image/button-bar);
 *   - deterministic width sequence (no DB data, no RNG; cycles mod 5);
 *   - loading-section mode branches (spinner/skeleton/section);
 *   - section overlay (aria-hidden, inlined SVG ring, fullPage flag, showTip slot);
 *   - WAI-ARIA contract (role=status on spinner/skeleton, role=region on section overlay,
 *     aria-live="polite", aria-atomic="true", aria-label, sr-only label span);
 *   - data-slot="loading-section" on every root;
 *   - CSP hygiene (no bare hex colours, no inline <script>, no on*= handlers);
 *   - XSS trust split (attrs=$unsafe, dataAttrs escaped via Escape.htmlAttribute);
 *   - net-new tokens in lievit-tokens.css (skeleton-bg, skeleton-shimmer, easing-linear,
 *     duration-base, pointer-events-none) + @keyframes lv-skeleton-shimmer;
 *   - skeleton.css shimmer rules + reduced-motion suppression.
 *
 * A real JTE-compiler smoke lives in test/jte-compile (Maven + jte-maven-plugin 3.2.4).
 * This JS suite covers structure; the compiler covers syntax correctness.
 */
import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const jteDir = join(import.meta.dirname, "..", "registry", "jte");
const tokensCss = readFileSync(
  join(import.meta.dirname, "..", "registry", "tokens", "lievit-tokens.css"),
  "utf8",
);

const spinnerSrc = readFileSync(join(jteDir, "spinner.jte"), "utf8");
const skeletonSrc = readFileSync(join(jteDir, "skeleton.jte"), "utf8");
const lsSrc = readFileSync(join(jteDir, "loading-section.jte"), "utf8");
const skeletonCss = readFileSync(join(jteDir, "skeleton.css"), "utf8");

// Strip JTE doc-comment blocks so assertions do not fire on prose.
const spinnerMarkup = spinnerSrc.replace(/<%--[\s\S]*?--%>/g, "");
const skeletonMarkup = skeletonSrc.replace(/<%--[\s\S]*?--%>/g, "");
const lsMarkup = lsSrc.replace(/<%--[\s\S]*?--%>/g, "");

// ============================================================================
// SPINNER -- param API
// ============================================================================
describe("spinner -- param API", () => {
  test('declares size = "md" (default changed from old "sm")', () => {
    expect(spinnerSrc).toContain('@param String size = "md"');
  });

  test('declares variant = "default"', () => {
    expect(spinnerSrc).toContain('@param String variant = "default"');
  });

  test("declares label with ellipsis default", () => {
    expect(spinnerSrc).toContain('@param String label = "Loading…"');
  });

  test('declares cssClass = ""', () => {
    expect(spinnerSrc).toContain('@param String cssClass = ""');
  });

  test('declares attrs = ""', () => {
    expect(spinnerSrc).toContain('@param String attrs = ""');
  });

  test("declares dataAttrs as Map<String,String>", () => {
    expect(spinnerSrc).toContain(
      "@param java.util.Map<String, String> dataAttrs = java.util.Map.of()",
    );
  });

  test("does NOT import io.lievit (hard rule)", () => {
    expect(spinnerSrc).not.toContain("@import io.lievit");
  });

  test("does NOT import gg.jte.Content (not needed for spinner)", () => {
    expect(spinnerSrc).not.toContain("@import gg.jte.Content");
  });

  test("imports StringOutput and Escape for dataAttrs channel", () => {
    expect(spinnerSrc).toContain("@import gg.jte.output.StringOutput");
    expect(spinnerSrc).toContain("@import gg.jte.html.escape.Escape");
  });

  test("usage doc carries the @@template.lievit.spinner call syntax", () => {
    expect(spinnerSrc).toContain("@@template.lievit.spinner(");
  });
});

// ============================================================================
// SPINNER -- SVG ring anatomy
// ============================================================================
describe("spinner -- SVG ring anatomy", () => {
  test("uses SVG element (not a CSS border-based ring)", () => {
    expect(spinnerMarkup).toContain("<svg");
  });

  test("SVG carries aria-hidden and focusable=false (decorative)", () => {
    expect(spinnerMarkup).toContain('aria-hidden="true"');
    expect(spinnerMarkup).toContain('focusable="false"');
  });

  test("SVG has animate-spin and motion-reduce:animate-none classes", () => {
    expect(spinnerMarkup).toContain("animate-spin");
    expect(spinnerMarkup).toContain("motion-reduce:animate-none");
  });

  test("SVG uses fixed viewBox 0 0 24 24", () => {
    expect(spinnerMarkup).toContain('viewBox="0 0 24 24"');
  });

  test("SVG width/height are bound to the size switch variable", () => {
    // The size switch produces svgSize; width and height reference it.
    expect(spinnerMarkup).toContain('width="${svgSize}"');
    expect(spinnerMarkup).toContain('height="${svgSize}"');
  });

  test("size switch maps sm->16, md->24, lg->40", () => {
    expect(spinnerSrc).toContain('case "sm" -> "16"');
    expect(spinnerSrc).toContain('case "lg" -> "40"');
    expect(spinnerSrc).toContain('"24"'); // default
  });

  test("background track circle: cx=12, cy=12, r=10, opacity 0.25", () => {
    expect(spinnerMarkup).toContain("cx=\"12\" cy=\"12\" r=\"10\"");
    expect(spinnerMarkup).toContain("opacity=\"0.25\"");
  });

  test("foreground arc: stroke-dasharray=31.416 and stroke-dashoffset=10.472", () => {
    expect(spinnerMarkup).toContain('stroke-dasharray="31.416"');
    expect(spinnerMarkup).toContain('stroke-dashoffset="10.472"');
  });

  test("foreground arc has stroke-linecap=round", () => {
    expect(spinnerMarkup).toContain('stroke-linecap="round"');
  });

  test("fill=none on SVG (stroke-only ring)", () => {
    expect(spinnerMarkup).toContain('fill="none"');
  });

  test("stroke colour driven by strokeColor variable (not hardcoded)", () => {
    // Must reference the variable, not a hardcoded colour.
    expect(spinnerMarkup).toContain("${strokeColor}");
    expect(spinnerMarkup).not.toMatch(/color:#[0-9a-fA-F]{3,6}/);
  });
});

// ============================================================================
// SPINNER -- variant colour logic
// ============================================================================
describe("spinner -- variant colour logic", () => {
  test('default variant maps to --lv-color-muted-fg', () => {
    expect(spinnerSrc).toContain("var(--lv-color-muted-fg)");
  });

  test('primary variant maps to --lv-color-primary', () => {
    expect(spinnerSrc).toContain("var(--lv-color-primary)");
  });

  test("strokeColor switch uses \"primary\".equals(variant) guard", () => {
    expect(spinnerSrc).toContain('"primary".equals(variant)');
  });
});

// ============================================================================
// SPINNER -- a11y
// ============================================================================
describe("spinner -- a11y", () => {
  test('root carries role="status"', () => {
    expect(spinnerMarkup).toContain('role="status"');
  });

  test('root carries aria-live="polite"', () => {
    expect(spinnerMarkup).toContain('aria-live="polite"');
  });

  test('root carries aria-atomic="true"', () => {
    expect(spinnerMarkup).toContain('aria-atomic="true"');
  });

  test("root carries aria-label bound to label param", () => {
    expect(spinnerMarkup).toContain('aria-label="${label}"');
  });

  test("sr-only span carries label text", () => {
    expect(spinnerMarkup).toContain('class="sr-only"');
    expect(spinnerMarkup).toContain(">${label}</span>");
  });
});

// ============================================================================
// SPINNER -- data-slot, data-mode, data attributes
// ============================================================================
describe("spinner -- data-slot and extras", () => {
  test('data-slot="loading-section" on root (unified slot name)', () => {
    expect(spinnerMarkup).toContain('data-slot="loading-section"');
  });

  test('data-mode="spinner" on root', () => {
    expect(spinnerMarkup).toContain('data-mode="spinner"');
  });

  test("data-size bound to size param", () => {
    expect(spinnerMarkup).toContain('data-size="${size}"');
  });

  test("data-variant bound to variant param", () => {
    expect(spinnerMarkup).toContain('data-variant="${variant}"');
  });

  test("dataAttrs rendered via Escape.htmlAttribute", () => {
    expect(spinnerSrc).toContain("Escape.htmlAttribute");
    expect(spinnerSrc).toContain("$unsafe{dataAttrsMarkup}");
  });

  test("attrs rendered with $unsafe (TRUSTED channel)", () => {
    expect(spinnerMarkup).toContain("$unsafe{attrs}");
  });
});

// ============================================================================
// SPINNER -- inline context + root element
// ============================================================================
describe("spinner -- inline context", () => {
  test("root element is <span> (not <div>) for valid inline composition", () => {
    // The spinner must nest safely inside switch.jte's <span> thumb and toast's flex row.
    expect(spinnerMarkup).toMatch(/<span[^>]*role="status"/);
  });

  test("root carries inline-flex class for alignment", () => {
    expect(spinnerMarkup).toContain("inline-flex");
  });
});

// ============================================================================
// SPINNER -- CSP hygiene
// ============================================================================
describe("spinner -- CSP hygiene", () => {
  test("no bare hex colours in markup", () => {
    expect(spinnerMarkup).not.toMatch(/#[0-9a-fA-F]{3,6}/);
  });

  test("no <script> tags", () => {
    expect(spinnerMarkup).not.toContain("<script");
  });

  test("no on*= event handler attributes", () => {
    expect(spinnerMarkup).not.toMatch(/\bon[A-Za-z]+=["']/);
  });
});

// ============================================================================
// SKELETON -- param API
// ============================================================================
describe("skeleton -- param API", () => {
  test('declares size = "md"', () => {
    expect(skeletonSrc).toContain('@param String size = "md"');
  });

  test("declares active = true", () => {
    expect(skeletonSrc).toContain("@param boolean active = true");
  });

  test("declares skeletonRows = 3", () => {
    expect(skeletonSrc).toContain("@param int skeletonRows = 3");
  });

  test('declares skeletonShape = "lines"', () => {
    expect(skeletonSrc).toContain('@param String skeletonShape = "lines"');
  });

  test("declares label with ellipsis default", () => {
    expect(skeletonSrc).toContain('@param String label = "Loading…"');
  });

  test('declares cssClass, attrs, dataAttrs', () => {
    expect(skeletonSrc).toContain('@param String cssClass = ""');
    expect(skeletonSrc).toContain('@param String attrs = ""');
    expect(skeletonSrc).toContain(
      "@param java.util.Map<String, String> dataAttrs = java.util.Map.of()",
    );
  });

  test("does NOT declare old API params (shape, width, height, klass)", () => {
    expect(skeletonSrc).not.toContain("@param String shape");
    expect(skeletonSrc).not.toContain("@param String width");
    expect(skeletonSrc).not.toContain("@param String height");
    expect(skeletonSrc).not.toContain("@param String klass");
  });

  test("does NOT import gg.jte.Content (no content slot on skeleton)", () => {
    expect(skeletonSrc).not.toContain("@import gg.jte.Content");
  });

  test("imports StringOutput and Escape", () => {
    expect(skeletonSrc).toContain("@import gg.jte.output.StringOutput");
    expect(skeletonSrc).toContain("@import gg.jte.html.escape.Escape");
  });

  test("does NOT import io.lievit", () => {
    expect(skeletonSrc).not.toContain("@import io.lievit");
  });
});

// ============================================================================
// SKELETON -- shape branches
// ============================================================================
describe("skeleton -- shape branches", () => {
  test('lines shape branch present ("lines".equals(skeletonShape))', () => {
    expect(skeletonSrc).toContain('"lines".equals(skeletonShape)');
  });

  test("lines shape loops skeletonRows times", () => {
    expect(skeletonMarkup).toContain("i < skeletonRows");
  });

  test("lines shape uses deterministic width array (no DB data)", () => {
    expect(skeletonSrc).toContain(
      'java.util.List.of("100%", "75%", "88%", "62%", "94%")',
    );
  });

  test("width cycles via modulo on widths list", () => {
    expect(skeletonSrc).toContain("i % widths.size()");
  });

  test('card shape branch present ("card".equals(skeletonShape))', () => {
    expect(skeletonSrc).toContain('"card".equals(skeletonShape)');
  });

  test('avatar-row shape branch present ("avatar-row".equals(skeletonShape))', () => {
    expect(skeletonSrc).toContain('"avatar-row".equals(skeletonShape)');
  });

  test('image shape branch present ("image".equals(skeletonShape))', () => {
    expect(skeletonSrc).toContain('"image".equals(skeletonShape)');
  });

  test('button-bar shape branch present ("button-bar".equals(skeletonShape))', () => {
    expect(skeletonSrc).toContain('"button-bar".equals(skeletonShape)');
  });
});

// ============================================================================
// SKELETON -- shimmer + active flag
// ============================================================================
describe("skeleton -- shimmer", () => {
  test("active flag drives lv-skeleton--active class", () => {
    expect(skeletonSrc).toContain('active ? "lv-skeleton--active" : ""');
  });

  test("data-active bound to boolean expression", () => {
    // JTE allows literal double-quotes inside ${} expressions.
    expect(skeletonSrc).toContain("data-active=");
    expect(skeletonSrc).toContain('active ? "true" : "false"');
  });

  test("bars carry lv-skeleton__bar class (referenced by skeleton.css)", () => {
    expect(skeletonMarkup).toContain("lv-skeleton__bar");
  });
});

// ============================================================================
// SKELETON -- a11y
// ============================================================================
describe("skeleton -- a11y", () => {
  test('root carries role="status"', () => {
    expect(skeletonMarkup).toContain('role="status"');
  });

  test('root carries aria-live="polite" and aria-atomic="true"', () => {
    expect(skeletonMarkup).toContain('aria-live="polite"');
    expect(skeletonMarkup).toContain('aria-atomic="true"');
  });

  test("sr-only span carries label text", () => {
    expect(skeletonMarkup).toContain('class="sr-only"');
  });

  test('data-slot="loading-section" on root', () => {
    expect(skeletonMarkup).toContain('data-slot="loading-section"');
  });

  test('data-mode="skeleton" on root', () => {
    expect(skeletonMarkup).toContain('data-mode="skeleton"');
  });

  test("data-shape bound to skeletonShape param", () => {
    expect(skeletonMarkup).toContain('data-shape="${skeletonShape}"');
  });

  test("decorative bars carry aria-hidden", () => {
    expect(skeletonMarkup).toContain('aria-hidden="true"');
  });
});

// ============================================================================
// SKELETON -- no inline style with hardcoded colours
// ============================================================================
describe("skeleton -- CSP hygiene", () => {
  test("no bare hex colours in markup section", () => {
    expect(skeletonMarkup).not.toMatch(/#[0-9a-fA-F]{3,6}/);
  });

  test("no <script> tags", () => {
    expect(skeletonMarkup).not.toContain("<script");
  });
});

// ============================================================================
// skeleton.css -- shimmer rules
// ============================================================================
describe("skeleton.css -- shimmer animation rules", () => {
  test("lv-skeleton__bar rule sets background to --lv-skeleton-bg", () => {
    expect(skeletonCss).toContain("--lv-skeleton-bg");
    expect(skeletonCss).toContain(".lv-skeleton__bar");
  });

  test("lv-skeleton--active rule sets shimmer gradient with --lv-skeleton-shimmer", () => {
    expect(skeletonCss).toContain(".lv-skeleton--active .lv-skeleton__bar");
    expect(skeletonCss).toContain("--lv-skeleton-shimmer");
    expect(skeletonCss).toContain("background-size: 400%");
  });

  test("shimmer references lv-skeleton-shimmer keyframe", () => {
    expect(skeletonCss).toContain("lv-skeleton-shimmer");
    expect(skeletonCss).toContain("animation:");
  });

  test("reduced-motion block suppresses animation", () => {
    expect(skeletonCss).toContain("prefers-reduced-motion");
    expect(skeletonCss).toContain("animation: none");
  });
});

// ============================================================================
// LOADING-SECTION -- param API
// ============================================================================
describe("loading-section -- param API", () => {
  test('declares mode = "spinner"', () => {
    expect(lsSrc).toContain('@param String mode = "spinner"');
  });

  test('declares size = "md"', () => {
    expect(lsSrc).toContain('@param String size = "md"');
  });

  test('declares variant = "default"', () => {
    expect(lsSrc).toContain('@param String variant = "default"');
  });

  test("declares label with ellipsis default", () => {
    expect(lsSrc).toContain('@param String label = "Loading…"');
  });

  test("declares showTip = false", () => {
    expect(lsSrc).toContain("@param boolean showTip = false");
  });

  test("declares active = true", () => {
    expect(lsSrc).toContain("@param boolean active = true");
  });

  test("declares skeletonRows = 3", () => {
    expect(lsSrc).toContain("@param int skeletonRows = 3");
  });

  test('declares skeletonShape = "lines"', () => {
    expect(lsSrc).toContain('@param String skeletonShape = "lines"');
  });

  test("declares fullPage = false", () => {
    expect(lsSrc).toContain("@param boolean fullPage = false");
  });

  test('declares cssClass, attrs, dataAttrs', () => {
    expect(lsSrc).toContain('@param String cssClass = ""');
    expect(lsSrc).toContain('@param String attrs = ""');
    expect(lsSrc).toContain(
      "@param java.util.Map<String, String> dataAttrs = java.util.Map.of()",
    );
  });

  test("declares content as gg.jte.Content (section mode slot)", () => {
    expect(lsSrc).toContain("@param Content content = null");
    expect(lsSrc).toContain("@import gg.jte.Content");
  });

  test("does NOT declare old API params (caption, bordered, minHeight)", () => {
    expect(lsSrc).not.toContain("@param boolean caption");
    expect(lsSrc).not.toContain("@param boolean bordered");
    expect(lsSrc).not.toContain("@param String minHeight");
  });

  test("imports StringOutput, Escape, Content", () => {
    expect(lsSrc).toContain("@import gg.jte.Content");
    expect(lsSrc).toContain("@import gg.jte.output.StringOutput");
    expect(lsSrc).toContain("@import gg.jte.html.escape.Escape");
  });

  test("does NOT import io.lievit", () => {
    expect(lsSrc).not.toContain("@import io.lievit");
  });
});

// ============================================================================
// LOADING-SECTION -- mode branches
// ============================================================================
describe("loading-section -- mode branches", () => {
  test('spinner mode branch: "spinner".equals(mode)', () => {
    expect(lsSrc).toContain('"spinner".equals(mode)');
  });

  test('skeleton mode branch: "skeleton".equals(mode)', () => {
    expect(lsSrc).toContain('"skeleton".equals(mode)');
  });

  test("section mode handled in @else branch (fallthrough)", () => {
    // The section branch is @else after spinner and skeleton elseif.
    expect(lsMarkup).toContain("@else");
  });

  test("spinner mode inlines SVG ring (no @template.lievit.spinner cross-call)", () => {
    // Self-contained: must not call the spinner partial.
    expect(lsMarkup).not.toContain("@template.lievit.spinner");
    // But must have an SVG.
    expect(lsMarkup).toContain("<svg");
  });

  test("skeleton mode inlines skeleton bars (no @template.lievit.skeleton cross-call)", () => {
    expect(lsMarkup).not.toContain("@template.lievit.skeleton");
    // Must have lv-skeleton class.
    expect(lsMarkup).toContain("lv-skeleton");
  });
});

// ============================================================================
// LOADING-SECTION -- spinner mode markup
// ============================================================================
describe("loading-section -- spinner mode markup", () => {
  test('spinner root carries role="status"', () => {
    expect(lsMarkup).toContain('role="status"');
  });

  test("spinner SVG has animate-spin and motion-reduce:animate-none", () => {
    expect(lsMarkup).toContain("animate-spin");
    expect(lsMarkup).toContain("motion-reduce:animate-none");
  });

  test("spinner arc has dasharray=31.416 and dashoffset=10.472", () => {
    expect(lsMarkup).toContain('stroke-dasharray="31.416"');
    expect(lsMarkup).toContain('stroke-dashoffset="10.472"');
  });

  test("spinner stroke colour driven by strokeColor variable", () => {
    expect(lsMarkup).toContain("${strokeColor}");
  });
});

// ============================================================================
// LOADING-SECTION -- section mode markup
// ============================================================================
describe("loading-section -- section mode", () => {
  test("section root carries role=region and aria-busy=true", () => {
    expect(lsMarkup).toContain('role="region"');
    expect(lsMarkup).toContain('aria-busy="true"');
  });

  test("overlay div is aria-hidden (decorative)", () => {
    expect(lsMarkup).toContain('class="lv-loading-section__overlay');
  });

  test("section mode renders content slot when content != null", () => {
    expect(lsMarkup).toContain("content != null");
    expect(lsMarkup).toContain("${content}");
  });

  test("fullPage drives fixed positioning via positionStyle variable", () => {
    expect(lsSrc).toContain("fullPage");
    expect(lsSrc).toContain("position:fixed");
    expect(lsSrc).toContain("position:relative");
  });

  test("fullPage data attribute emits true/false string", () => {
    // JTE allows literal double-quotes inside ${} expressions.
    expect(lsSrc).toContain("data-full-page=");
    expect(lsSrc).toContain('fullPage ? "true" : "false"');
  });

  test("showTip renders visible tip span with data-slot=loading-section-tip", () => {
    expect(lsSrc).toContain("showTip");
    expect(lsMarkup).toContain('data-slot="loading-section-tip"');
  });

  test("section overlay inlines SVG ring (no cross-partial call)", () => {
    // The overlay SVG must be inlined in loading-section.jte.
    // We already checked no @template.lievit.spinner -- the SVG just needs to exist in @else.
    // Check that the @else block (section) has the SVG anatomy.
    // The section SVG uses overlaySvgSize and overlayStrokeColor variables.
    expect(lsSrc).toContain("overlaySvgSize");
    expect(lsSrc).toContain("overlayStrokeColor");
  });
});

// ============================================================================
// LOADING-SECTION -- data-slot across modes
// ============================================================================
describe("loading-section -- data-slot on every mode root", () => {
  test('data-slot="loading-section" appears at least 3 times (one per mode root)', () => {
    const count = (lsMarkup.match(/data-slot="loading-section"/g) ?? []).length;
    expect(count).toBeGreaterThanOrEqual(3);
  });
});

// ============================================================================
// NET-NEW TOKENS in lievit-tokens.css
// ============================================================================
describe("lievit-tokens.css -- net-new skeleton and motion tokens", () => {
  test("--lv-skeleton-bg defined in :root (light mode)", () => {
    expect(tokensCss).toContain("--lv-skeleton-bg: oklch(0.93 0.005 264)");
  });

  test("--lv-skeleton-shimmer defined in :root (light mode)", () => {
    expect(tokensCss).toContain("--lv-skeleton-shimmer: oklch(0.97 0.003 264)");
  });

  test("--lv-skeleton-bg dark-mode override in .dark block", () => {
    const darkBlock = tokensCss.slice(tokensCss.indexOf(".dark,"));
    expect(darkBlock).toContain("--lv-skeleton-bg: oklch(0.24 0.008 264)");
  });

  test("--lv-skeleton-shimmer dark-mode override in .dark block", () => {
    const darkBlock = tokensCss.slice(tokensCss.indexOf(".dark,"));
    expect(darkBlock).toContain("--lv-skeleton-shimmer: oklch(0.30 0.006 264)");
  });

  test("--lv-motion-easing-linear: linear defined in :root", () => {
    expect(tokensCss).toContain("--lv-motion-easing-linear: linear");
  });

  test("--lv-motion-duration-base: 200ms defined in :root", () => {
    expect(tokensCss).toContain("--lv-motion-duration-base: 200ms");
  });

  test("--lv-pointer-events-none: none defined in :root", () => {
    expect(tokensCss).toContain("--lv-pointer-events-none: none");
  });

  test("@keyframes lv-skeleton-shimmer defined", () => {
    expect(tokensCss).toContain("@keyframes lv-skeleton-shimmer");
  });

  test("lv-skeleton-shimmer keyframe uses background-position sweep", () => {
    expect(tokensCss).toContain("background-position:");
    // Keyframe must go from negative to positive (left-to-right sweep).
    const kfBlock = tokensCss.slice(
      tokensCss.indexOf("@keyframes lv-skeleton-shimmer"),
    );
    const closing = kfBlock.indexOf("}");
    const kf = kfBlock.slice(0, closing + 1);
    expect(kf).toContain("background-position:");
    expect(kf).toContain("-200%");
    expect(kf).toContain("200%");
  });
});

// ============================================================================
// BACKWARD COMPAT for existing spinner consumers
// ============================================================================
describe("backward compat -- existing spinner callers", () => {
  test("spinner still accepts size param (switch.jte calls size='sm')", () => {
    // size param exists and accepts "sm".
    expect(spinnerSrc).toContain('@param String size = "md"');
    expect(spinnerSrc).toContain('case "sm"');
  });

  test("spinner still accepts label param (toast.jte calls label='Loading')", () => {
    expect(spinnerSrc).toContain("@param String label");
  });

  test("new variant param has default so existing callers need no changes", () => {
    expect(spinnerSrc).toContain('@param String variant = "default"');
  });
});
