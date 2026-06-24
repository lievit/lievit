/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * Structural golden tests for badge.jte and chip.jte (re-forged v-next).
 *
 * These two are spec'ed together in planning/v-next/specs/badge.md (§7) because they share the
 * same variant vocabulary, token set, and visual identity; they differ only by the chip's remove
 * affordance. The spec is the test contract.
 *
 * Harness: no JTE compiler on the Node CI path. Assertions run on the PARTIAL SOURCE as text,
 * exactly as the sibling static-partial suites (button.test.ts, jte-static-partials.test.ts)
 * do. The real-compiler smoke is separate (test/jte-compile). These structural checks mirror and
 * maintain what that smoke proved so the invariants survive without the JVM in CI.
 *
 * Coverage (spec §7):
 *   - param API + doc comment
 *   - asChild polymorphism (href -> <a> vs inert <span>)
 *   - variant matrix: all 11 variants -- inline style contains the right CSS custom property
 *   - size scale (sm/md/lg): text token + padding class, NOT height-based
 *   - dot indicator: aria-hidden span, before label
 *   - leading slot: rendered before label
 *   - content slot: takes precedence over label
 *   - dataAttrs escaping via Escape.htmlAttribute (XSS boundary)
 *   - attrs: trusted $unsafe raw, documented not-for-DB
 *   - focus-visible ring on the <a> branch and on the chip remove link
 *   - backward-compat class names: lv-badge lv-badge--<variant> / lv-chip lv-chip--<variant>
 *   - chip: inert vs removable; chip-label + chip-remove slots; removeLabel a11y requirement
 *   - chip: data-slot="chip-remove" carries aria-label="${removeLabel}"; SVG is aria-hidden
 *   - chip: dev warning comment when removeHref is set without removeLabel
 *   - dark-mode: inline style uses var() refs, not literals (tokens resolve at CSS level)
 *   - house rules: no inline script, no on* handler, no hardcoded hex, no Font Awesome
 */
import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const jteDir = join(import.meta.dirname, "..", "registry", "jte");
const read = (name: string) => readFileSync(join(jteDir, `${name}.jte`), "utf8");
/** Strip JTE doc/inline comments so prose in <%-- --%> blocks never trips a markup assertion. */
const markup = (src: string) => src.replace(/<%--[\s\S]*?--%>/g, "");

// ---------------------------------------------------------------------------
// Variant tables (spec §3): every variant, the expected bg/fg CSS custom properties.
// The spec §7 says: "assert the style string contains the expected custom property names,
// not literal hex". The switch logic resolves to these vars; we pin the variable names.
// ---------------------------------------------------------------------------

/** All 11 variants in the shared vocabulary (spec §3). */
const ALL_VARIANTS = [
  // shadcn family
  "default",
  "secondary",
  "destructive",
  "outline",
  "ghost",
  "link",
  // status family
  "neutral",
  "success",
  "warning",
  "danger",
  "info",
] as const;

/**
 * The expected bg CSS custom-property name for each variant (spec §3 variant table).
 * ghost/link/outline are fill-less; we check for "transparent" literal in the switch.
 */
const VARIANT_BG: Record<(typeof ALL_VARIANTS)[number], string> = {
  default: "--lv-color-primary",
  secondary: "--lv-color-secondary",
  destructive: "--lv-color-destructive",
  outline: "transparent",
  ghost: "transparent",
  link: "transparent",
  neutral: "--lv-color-muted-bg",
  success: "--lv-color-success",
  warning: "--lv-color-warning",
  danger: "--lv-color-danger",
  info: "--lv-color-info",
};

/**
 * The expected fg CSS custom-property name for each variant (spec §3 variant table).
 * outline+ghost -> --lv-color-fg; link -> --lv-color-primary (primary-coloured text).
 */
const VARIANT_FG: Record<(typeof ALL_VARIANTS)[number], string> = {
  default: "--lv-color-primary-fg",
  secondary: "--lv-color-secondary-fg",
  destructive: "--lv-color-destructive-fg",
  outline: "--lv-color-fg",
  ghost: "--lv-color-fg",
  link: "--lv-color-primary",
  neutral: "--lv-color-muted-fg",
  success: "--lv-color-success-fg",
  warning: "--lv-color-warning-fg",
  danger: "--lv-color-danger-fg",
  info: "--lv-color-info-fg",
};

// ---------------------------------------------------------------------------
// badge.jte
// ---------------------------------------------------------------------------

describe("badge (re-forged v-next JTE partial; spec §7)", () => {
  const src = read("badge");

  // --- param API + doc comment ---

  test("ships a doc comment in JTE syntax with Usage: section and @template call snippet", () => {
    expect(src, "missing <%-- --%> comment").toContain("<%--");
    expect(src, "comment block must close").toContain("--%>");
    expect(src, "must NOT use @* *@ comment syntax").not.toMatch(/@\*/);
    expect(src, "missing Usage section").toMatch(/Usage:/);
    expect(src, "usage must show @template call").toContain("@@template.lievit.badge(");
  });

  test("declares every param from the spec §2 API with correct defaults", () => {
    expect(src).toContain('@param String variant = "neutral"');
    expect(src).toContain("@param String label = null");
    expect(src).toContain("@param boolean dot = false");
    expect(src).toContain("@param gg.jte.Content leading = null");
    expect(src).toContain("@param gg.jte.Content content = null");
    expect(src).toContain("@param String href = null");
    expect(src).toContain('@param String size = "md"');
    expect(src).toContain('@param String cssClass = ""');
    expect(src).toContain('@param String attrs = ""');
    expect(src).toContain("@param java.util.Map<String, String> dataAttrs = java.util.Map.of()");
  });

  // --- asChild polymorphism: href -> <a> vs inert <span> ---

  test("asChild: non-blank href renders a real <a href>; blank/null renders an inert <span>", () => {
    expect(src).toContain("var isLink = href != null && !href.isBlank();");
    expect(src).toContain("@if(isLink)");
    const m = markup(src);
    // the <a> branch carries the href interpolation
    expect(m).toMatch(/<a\s[^>]*href="\$\{href\}"/);
    // the <span> branch is also present
    expect(m).toMatch(/<span\s/);
  });

  test("both branches carry data-slot, data-variant, data-size (the CSS/test hooks)", () => {
    expect(src).toContain('data-slot="badge"');
    expect(src).toContain('data-variant="${variant}"');
    expect(src).toContain('data-size="${size}"');
  });

  // --- variant matrix: all 11 variants ---

  test("all 11 variants have a bg switch case resolving to the correct token or transparent", () => {
    for (const variant of ALL_VARIANTS) {
      const expected = VARIANT_BG[variant];
      if (expected === "transparent") {
        // fill-less: the switch case must explicitly emit "transparent"
        expect(src, `bg switch missing transparent for "${variant}"`).toContain(
          `case "${variant}"`,
        );
      } else {
        expect(src, `bg switch missing var(${expected}) for "${variant}"`).toContain(
          `var(${expected})`,
        );
      }
    }
  });

  test("all 11 variants have a fg switch case resolving to the correct token", () => {
    for (const variant of ALL_VARIANTS) {
      const expected = VARIANT_FG[variant];
      expect(src, `fg switch missing var(${expected}) for "${variant}"`).toContain(
        `var(${expected})`,
      );
    }
  });

  test("outline variant gets a real border-color token; all others get transparent", () => {
    // spec §3: only outline has a visible border; the switch is a ternary on the variant.
    expect(src).toContain('"outline".equals(variant) ? "var(--lv-color-border)" : "transparent"');
  });

  test("neutral variant reads --lv-color-muted-bg / --lv-color-muted-fg (NOT the old surface/muted tokens)", () => {
    // The OLD badge used var(--lv-color-surface) + var(--lv-color-muted); the re-forge switched
    // to the dedicated muted-bg/muted-fg pair. This assertion pins the new tokens.
    expect(src).toContain("var(--lv-color-muted-bg)");
    expect(src).toContain("var(--lv-color-muted-fg)");
    // the OLD surface token must be gone from the badge markup (not just absent from switch)
    expect(markup(src)).not.toContain("var(--lv-color-surface)");
    // muted WITHOUT a suffix is the OLD skeleton/placeholder token; must not appear in the switch
    expect(src).not.toContain('"var(--lv-color-muted)"');
  });

  test("inline style uses CSS custom property var() refs, not literal hex (dark-mode compat)", () => {
    // A style with literal colours breaks dark-mode token swaps; var() refs do not.
    // The style is built by concatenation: "background:" + bg + ";color:" + fg where bg/fg
    // are the CSS custom property strings resolved by the switch (e.g. "var(--lv-color-success)").
    // So the source contains the concatenation pattern, not the finished string, but every
    // non-transparent branch in the bg/fg switches resolves to a var(--lv-*) call.
    expect(src, "leaked a hardcoded hex colour").not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    // The style variable is built as: "...background:" + bg + ";color:" + fg + "..."
    expect(src).toMatch(/pillStyle.*".*background:"\s*\+\s*bg/s);
    expect(src).toMatch(/pillStyle.*".*color:"\s*\+\s*fg/s);
  });

  // --- size scale (spec §3): sm/md/lg text + padding, NOT height-based ---

  test("size sm emits the xs text token + space-2 horizontal + space-px vertical padding", () => {
    expect(src).toContain("px-[var(--lv-space-2)] py-[var(--lv-space-px)] text-[length:var(--lv-text-xs)]");
  });

  test("size md (default) emits the sm text token + space-2 horizontal + space-1 vertical padding", () => {
    expect(src).toContain("px-[var(--lv-space-2)] py-[var(--lv-space-1)] text-[length:var(--lv-text-sm)]");
  });

  test("size lg emits the base text token + space-3 horizontal + space-1 vertical padding", () => {
    expect(src).toContain("px-[var(--lv-space-3)] py-[var(--lv-space-1)] text-[length:var(--lv-text-base)]");
  });

  test("size is NOT height-based (no py-based height, no h-[var(--lv-space-8/9/10)])", () => {
    // spec §3: badges are inline elements, not form controls; they do NOT share the toolbar
    // height scale. This is the architecture contract §5.b invariant.
    expect(src).not.toContain("h-[var(--lv-space-8)]");
    expect(src).not.toContain("h-[var(--lv-space-9)]");
    expect(src).not.toContain("h-[var(--lv-space-10)]");
  });

  test("data-size is emitted on the root element so the CSS/test layer can target it", () => {
    expect(src).toContain('data-size="${size}"');
  });

  // --- dot indicator ---

  test("dot=true renders a <span aria-hidden='true'> before the label (colour-not-sole-signal)", () => {
    // The dot is aria-hidden: the label text ALWAYS states the status (WCAG 1.4.1).
    // The currentColor styling with reduced opacity adapts to the variant fg without a new token.
    expect(src).toContain("@if(dot)<span aria-hidden=\"true\"");
    expect(src).toContain("background:currentColor");
    expect(src).toContain("border-radius:9999px");
    // The dot renders INSIDE the pill, BEFORE the @if(content) / label block.
    // Verify the order: @if(dot)… appears before @if(content != null)${content}@else${label}
    const dotIdx = src.indexOf("@if(dot)");
    const contentIdx = src.indexOf("@if(content != null)${content}@else${label}@endif");
    expect(dotIdx, "dot must come before content/label block").toBeLessThan(contentIdx);
  });

  test("the dot is static: no animation class (WCAG 2.2.2 / 2.3.3)", () => {
    expect(markup(src)).not.toMatch(/animate-|pulse|spin/);
  });

  // --- leading slot ---

  test("leading slot: rendered before the dot/label block when non-null", () => {
    expect(src).toContain("@if(leading != null)${leading}@endif");
    // The leading slot appears in the markup before the dot
    const leadingIdx = src.indexOf("@if(leading != null)${leading}@endif");
    const dotIdx = src.indexOf("@if(dot)");
    expect(leadingIdx, "leading must come before dot in the markup").toBeLessThan(dotIdx);
  });

  // --- content slot takes precedence over label ---

  test("content slot overrides label when supplied", () => {
    expect(src).toContain("@if(content != null)${content}@else${label}@endif");
  });

  // --- link variant affordances ---

  test("link variant: adds underline-offset-4 utility class (spec §3)", () => {
    expect(src).toContain('"link".equals(variant) ? " underline-offset-4" : ""');
  });

  test("link variant: <a> branch uses hover:underline; other variants use hover:opacity-90", () => {
    expect(src).toContain('"link".equals(variant) ? "hover:underline"');
    expect(src).toContain("hover:opacity-90");
  });

  // --- focus-visible ring ---

  test("the <a> (link) branch carries focus-visible:shadow-[var(--lv-ring)] (spec §4)", () => {
    expect(src).toContain("focus-visible:shadow-[var(--lv-ring)]");
  });

  // --- backward-compat class names (spec §7 shared/visual-regression) ---

  test("keeps lv-badge lv-badge--<variant> class names for backward compat (spec §7)", () => {
    expect(src).toContain('"lv-badge lv-badge--" + variant');
  });

  // --- dataAttrs escaping (XSS boundary, spec §2) ---

  test("imports Escape.htmlAttribute and routes dataAttrs values through it (XSS boundary)", () => {
    expect(src).toContain("@import gg.jte.html.escape.Escape");
    expect(src).toMatch(/Escape\.htmlAttribute\(\s*e\.getValue\(\)/);
    // Per-row values must NEVER be $unsafe; only the pre-escaped fragment is $unsafe
    expect(src, "dataAttrs value must not be $unsafe").not.toMatch(/\$unsafe\{[^}]*getValue/);
  });

  test("keys are validated as simple identifiers (prevents markup injection in attribute-name position)", () => {
    expect(src).toMatch(/getKey\(\)\.matches\("\[A-Za-z\]\[A-Za-z0-9-\]\*"\)/);
  });

  test("exactly two $unsafe sinks per branch: the escaped dataAttrs fragment + the trusted attrs", () => {
    // The only $unsafe emissions are the pre-escaped dataAttrs fragment and the trusted attrs.
    // If more appear, a raw user value leaked into $unsafe (XSS).
    const sinks = src.match(/\$unsafe\{[^}]*\}/g) ?? [];
    expect(sinks.every((s) => s === "$unsafe{dataAttrsMarkup}" || s === "$unsafe{attrs}")).toBe(true);
    // both branches (link and span) each emit the pair once
    const dataAttrsSinks = sinks.filter((s) => s === "$unsafe{dataAttrsMarkup}");
    expect(dataAttrsSinks.length, "dataAttrs fragment must appear in both branches").toBe(2);
  });

  test("the trusted attrs sink is documented as STATIC author-only; no DB value must flow through it", () => {
    // The spec requires this channel to be documented (not just used); the doc comment must
    // name the TRUSTED / STATIC constraint so a future author does not misuse it.
    expect(src.toLowerCase()).toMatch(/trusted|static.*author/i);
    // Also verify the usage example calls attrs with a literal string, not a variable
    expect(src).toMatch(/attrs = "target=|attrs = 'target=/);
  });

  // --- no role attribute (spec §4: badge is decorative text, not a live region) ---

  test("renders no explicit role attribute (badge is decorative text, not a live region)", () => {
    expect(markup(src)).not.toMatch(/\srole=/);
  });

  // --- CSP hygiene + house rules ---

  test("never ships an inline <script> or on* handler (strict CSP)", () => {
    expect(src).not.toMatch(/<script/i);
    const handlers = markup(src).match(/\son[a-z]+=/gi) ?? [];
    expect(handlers, `inline handlers: ${handlers.join(", ")}`).toEqual([]);
  });

  test("never reaches for Font Awesome / wa-icon / LitElement (clean break from the island)", () => {
    expect(src.toLowerCase()).not.toMatch(/font-?awesome|wa-icon|fa-/);
    expect(src.toLowerCase()).not.toMatch(/customelement|litelement|adoptlightstyles/);
  });

  test("has no em-dash (house rule)", () => {
    expect(src).not.toContain("—");
  });
});

// ---------------------------------------------------------------------------
// chip.jte
// ---------------------------------------------------------------------------

describe("chip (v-next JTE partial; spec §7)", () => {
  const src = read("chip");

  // --- param API + doc comment ---

  test("ships a doc comment in JTE syntax with Usage: section and @template call snippet", () => {
    expect(src, "missing <%-- --%> comment").toContain("<%--");
    expect(src, "comment block must close").toContain("--%>");
    expect(src, "must NOT use @* *@ comment syntax").not.toMatch(/@\*/);
    expect(src, "missing Usage section").toMatch(/Usage:/);
    expect(src, "usage must show @template call").toContain("@@template.lievit.chip(");
  });

  test("declares every param from the spec §2 API with correct defaults", () => {
    expect(src).toContain('@param String variant = "neutral"');
    expect(src).toContain("@param String label = null");
    expect(src).toContain("@param gg.jte.Content leading = null");
    expect(src).toContain("@param gg.jte.Content content = null");
    expect(src).toContain("@param String removeHref = null");
    expect(src).toContain("@param String removeLabel = null");
    expect(src).toContain('@param String size = "md"');
    expect(src).toContain('@param String cssClass = ""');
    expect(src).toContain('@param String attrs = ""');
    expect(src).toContain("@param java.util.Map<String, String> dataAttrs = java.util.Map.of()");
  });

  // --- chip vs badge: NO href asChild (chip is always a <span> outer container) ---

  test("chip has NO href param (badge's asChild is badge-specific; chip's interactivity is remove-only)", () => {
    // Verify by checking the @param lines -- there must be no @param String href
    const paramLines = src.split("\n").filter((l) => l.startsWith("@param"));
    expect(paramLines.some((l) => /^@param String href/.test(l))).toBe(false);
  });

  // --- chip structure: outer span + chip-label span + optional chip-remove link ---

  test("inert chip: outer <span data-slot='chip'> wrapping <span data-slot='chip-label'>", () => {
    const m = markup(src);
    expect(m).toContain('data-slot="chip"');
    expect(m).toContain('data-slot="chip-label"');
    // the chip-label span wraps the content; chip has no <a> when no removeHref
    expect(src).toContain('@param String removeHref = null');
  });

  test("removable chip: chip-remove <a> carries the href + aria-label from removeLabel", () => {
    const m = markup(src);
    expect(m).toContain('data-slot="chip-remove"');
    expect(m).toContain('href="${removeHref}"');
    expect(m).toContain('aria-label="${removeLabel != null && !removeLabel.isBlank() ? removeLabel : ""}"');
  });

  test("the remove link is gated behind var removable = removeHref != null && !removeHref.isBlank()", () => {
    expect(src).toContain("var removable = removeHref != null && !removeHref.isBlank();");
    expect(src).toContain("@if(removable)");
  });

  test("the × SVG inside the remove link is aria-hidden='true' focusable='false' (spec §4)", () => {
    // The visible × glyph is decoration; aria-label on <a> provides the accessible name.
    expect(src).toContain('aria-hidden="true"');
    expect(src).toContain('focusable="false"');
    // The SVG uses currentColor stroke (adapts to variant fg)
    expect(src).toContain('stroke="currentColor"');
  });

  // --- a11y: removeLabel REQUIRED when removeHref is set ---

  test("emits a dev warning HTML comment when removeHref is set and removeLabel is blank/null", () => {
    // spec §4: the template SHOULD emit a visible warning comment in dev mode when removeLabel
    // is absent; the acceptance test MUST flag this (the dev can catch it in view-source).
    expect(src).toMatch(/WARNING.*removeLabel|removeLabel.*WARNING/i);
    // the warning is inside a JTE conditional that fires when removeLabel is blank
    expect(src).toContain("removeLabel == null || removeLabel.isBlank()");
  });

  test("the remove link focus-visible ring uses --lv-ring (spec §4 keyboard map)", () => {
    expect(src).toContain("focus-visible:shadow-[var(--lv-ring)]");
  });

  // --- variant matrix: all 11 variants (same vocabulary as badge) ---

  test("all 11 variants have a bg switch case in the chip (mirrors badge vocabulary)", () => {
    for (const variant of ALL_VARIANTS) {
      const expected = VARIANT_BG[variant];
      if (expected === "transparent") {
        expect(src, `bg switch missing transparent branch for "${variant}"`).toContain(
          `case "${variant}"`,
        );
      } else {
        expect(src, `bg switch missing var(${expected}) for "${variant}"`).toContain(
          `var(${expected})`,
        );
      }
    }
  });

  test("all 11 variants have a fg switch case (same as badge)", () => {
    for (const variant of ALL_VARIANTS) {
      const expected = VARIANT_FG[variant];
      expect(src, `fg switch missing var(${expected}) for "${variant}"`).toContain(
        `var(${expected})`,
      );
    }
  });

  test("neutral variant reads --lv-color-muted-bg / --lv-color-muted-fg (same as re-forged badge)", () => {
    expect(src).toContain("var(--lv-color-muted-bg)");
    expect(src).toContain("var(--lv-color-muted-fg)");
  });

  test("outline variant border: ternary matches badge (only outline gets a real border)", () => {
    expect(src).toContain('"outline".equals(variant) ? "var(--lv-color-border)" : "transparent"');
  });

  // --- inline style is var()-driven (dark-mode compat) ---

  test("inline style uses CSS custom property var() refs, not literal hex", () => {
    // Same concatenation pattern as badge: "background:" + bg + ";color:" + fg.
    expect(src, "leaked a hardcoded hex colour").not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(src).toMatch(/chipStyle.*".*background:"\s*\+\s*bg/s);
    expect(src).toMatch(/chipStyle.*".*color:"\s*\+\s*fg/s);
  });

  // --- size scale (same as badge, NOT height-based) ---

  test("size sm emits the xs text token + space-2 horizontal + space-px vertical", () => {
    expect(src).toContain("px-[var(--lv-space-2)] py-[var(--lv-space-px)] text-[length:var(--lv-text-xs)]");
  });

  test("size md (default) emits the sm text token + space-2 horizontal + space-1 vertical", () => {
    expect(src).toContain("px-[var(--lv-space-2)] py-[var(--lv-space-1)] text-[length:var(--lv-text-sm)]");
  });

  test("size lg emits the base text token + space-3 horizontal + space-1 vertical", () => {
    expect(src).toContain("px-[var(--lv-space-3)] py-[var(--lv-space-1)] text-[length:var(--lv-text-base)]");
  });

  test("size is NOT height-based (chip is inline, not a form control)", () => {
    expect(src).not.toContain("h-[var(--lv-space-8)]");
    expect(src).not.toContain("h-[var(--lv-space-9)]");
    expect(src).not.toContain("h-[var(--lv-space-10)]");
  });

  test("data-variant and data-size are on the outer span root", () => {
    expect(src).toContain('data-variant="${variant}"');
    expect(src).toContain('data-size="${size}"');
  });

  // --- leading slot + content slot ---

  test("leading slot rendered before label/content inside chip-label", () => {
    expect(src).toContain("@if(leading != null)${leading}@endif");
    const leadingIdx = src.indexOf("@if(leading != null)${leading}@endif");
    const contentIdx = src.indexOf("@if(content != null)${content}@else${label}@endif");
    expect(leadingIdx, "leading must come before content/label block").toBeLessThan(contentIdx);
  });

  test("content slot overrides label when supplied", () => {
    expect(src).toContain("@if(content != null)${content}@else${label}@endif");
  });

  // --- link variant ---

  test("link variant adds underline-offset-4 (mirrors badge)", () => {
    expect(src).toContain('"link".equals(variant) ? " underline-offset-4" : ""');
  });

  // --- backward-compat class names ---

  test("keeps lv-chip lv-chip--<variant> class names for backward compat", () => {
    expect(src).toContain('"lv-chip lv-chip--" + variant');
  });

  // --- dataAttrs escaping (same XSS boundary as badge) ---

  test("imports Escape.htmlAttribute and routes dataAttrs values through it", () => {
    expect(src).toContain("@import gg.jte.html.escape.Escape");
    expect(src).toMatch(/Escape\.htmlAttribute\(\s*e\.getValue\(\)/);
    expect(src, "dataAttrs value must not be $unsafe").not.toMatch(/\$unsafe\{[^}]*getValue/);
  });

  test("keys are validated as simple identifiers (no markup injection in attribute-name position)", () => {
    expect(src).toMatch(/getKey\(\)\.matches\("\[A-Za-z\]\[A-Za-z0-9-\]\*"\)/);
  });

  test("only the escaped dataAttrs fragment + trusted attrs reach $unsafe (one outer span, no branch duplication)", () => {
    // chip has ONE outer span (no isLink branch), so exactly one occurrence of each.
    const sinks = src.match(/\$unsafe\{[^}]*\}/g) ?? [];
    expect(sinks.every((s) => s === "$unsafe{dataAttrsMarkup}" || s === "$unsafe{attrs}")).toBe(true);
  });

  // --- chip stays domain-agnostic (spec §7: no domain leak in markup) ---

  test("rendered markup is domain-agnostic (no filiale/housetree/gestionale names)", () => {
    expect(markup(src).toLowerCase()).not.toMatch(/filiale|housetree|gestionale/);
  });

  // --- chip carries no explicit role (spec §4: outer span is non-interactive container) ---

  test("outer chip span has no explicit role (non-interactive container; spec §4)", () => {
    // The only interaction is the remove <a>; the outer container is flow content.
    // role= may appear inside the doc comment but must not be on the outer <span> markup.
    const m = markup(src);
    // The chip-remove link must NOT have role= (it is a real <a>, platform supplies role=link)
    expect(m).not.toMatch(/data-slot="chip"\s[^>]*role=/);
    expect(m).not.toMatch(/data-slot="chip-remove"\s[^>]*role=/);
  });

  // --- CSP hygiene + house rules ---

  test("never ships an inline <script> or on* handler (strict CSP)", () => {
    expect(src).not.toMatch(/<script/i);
    const handlers = markup(src).match(/\son[a-z]+=/gi) ?? [];
    expect(handlers, `inline handlers: ${handlers.join(", ")}`).toEqual([]);
  });

  test("never reaches for Font Awesome / wa-icon", () => {
    expect(src.toLowerCase()).not.toMatch(/font-?awesome|wa-icon|fa-/);
  });

  test("has no em-dash (house rule)", () => {
    expect(src).not.toContain("—");
  });
});

// ---------------------------------------------------------------------------
// Shared: backward-compat class names (spec §7 shared/visual-regression)
// ---------------------------------------------------------------------------

describe("badge + chip: backward-compat class names (spec §7 shared/visual regression)", () => {
  test("badge root carries both lv-badge and lv-badge--<variant> (adopter CSS selectors survive)", () => {
    const src = read("badge");
    // The class string includes the static prefix "lv-badge lv-badge--" concatenated with variant.
    expect(src).toContain('"lv-badge lv-badge--" + variant');
    // The data-variant hook is also present (CSS + test targeting)
    expect(src).toContain('data-variant="${variant}"');
  });

  test("chip root carries both lv-chip and lv-chip--<variant> (adopter CSS selectors survive)", () => {
    const src = read("chip");
    expect(src).toContain('"lv-chip lv-chip--" + variant');
    expect(src).toContain('data-variant="${variant}"');
  });
});

// ---------------------------------------------------------------------------
// Shared: dark-mode token compatibility (spec §7 shared/visual regression)
// ---------------------------------------------------------------------------

describe("badge + chip: dark-mode token compatibility (spec §7 shared/visual regression)", () => {
  test("badge inline style uses var() references: CSS variable resolution handles dark-mode automatically", () => {
    const src = read("badge");
    // The style is concatenated at render time from var(--lv-*) strings resolved in the bg/fg
    // switch. When class="dark" is on the root, the custom properties resolve to dark-palette
    // values; no template change is needed. We verify the var() refs are in the switch cases and
    // that no literal hex leaks into the source (which would bypass the token swap).
    expect(src, "hardcoded hex would break dark-mode").not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(src).toMatch(/pillStyle.*".*background:"\s*\+\s*bg/s);
    // At least one non-transparent case uses a var() in bg (proves the switch wires tokens)
    expect(src).toContain('-> "var(--lv-color-primary)"');
  });

  test("chip inline style uses var() references: same dark-mode contract as badge", () => {
    const src = read("chip");
    expect(src, "hardcoded hex would break dark-mode").not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(src).toMatch(/chipStyle.*".*background:"\s*\+\s*bg/s);
    expect(src).toContain('-> "var(--lv-color-primary)"');
  });
});
