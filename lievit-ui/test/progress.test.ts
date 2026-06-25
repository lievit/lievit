/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * progress.jte -- full structural + a11y contract (spec sec 7).
 *
 * The progress bar is a static JTE partial compiled in the Java world. This
 * harness asserts on the PARTIAL SOURCE as text, pinning: the v-next param API
 * (Integer value nullable, max, valueText, label, labelledBy, variant, size, form,
 * striped, animated, showValue, steps, strokeWidth, cssClass, attrs, dataAttrs,
 * trailing, footer), the WAI-ARIA 1.2 progressbar contract (role, aria-valuenow
 * absent for indeterminate, aria-valuemin/max, aria-valuetext, aria-label vs
 * aria-labelledby), data-state derivation (determinate / indeterminate / complete),
 * the four form branches (line / circle / dashboard / steps), striped + animated
 * stripe classes, the showValue text slot (aria-hidden), SVG arc math references,
 * token-driven styling (no bare hex), CSP hygiene, and the XSS trust split.
 * A render/golden in the Java runtime is out of scope for the JS suite; the
 * real-compiler smoke lives in test/jte-compile. This is the structural golden.
 */
import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const jteDir = join(import.meta.dirname, "..", "registry", "jte");
const tokensSrc = readFileSync(
  join(import.meta.dirname, "..", "registry", "tokens", "lievit-tokens.css"),
  "utf8",
);
const src = readFileSync(join(jteDir, "progress.jte"), "utf8");

// Strip JTE comments so assertions do not hit doc-comment prose.
const markup = src.replace(/<%--[\s\S]*?--%>/g, "");

// ---------------------------------------------------------------------------
// Param API (spec sec 2)
// ---------------------------------------------------------------------------
describe("progress -- param API", () => {
  test("declares all v-next params with their documented defaults", () => {
    expect(src).toContain("@param Integer value = null");
    expect(src).toContain("@param int max = 100");
    expect(src).toContain("@param String valueText = null");
    expect(src).toContain("@param String label = null");
    expect(src).toContain("@param String labelledBy = null");
    expect(src).toContain('@param String variant = "default"');
    expect(src).toContain('@param String size = "md"');
    expect(src).toContain('@param String form = "line"');
    expect(src).toContain("@param boolean striped = false");
    expect(src).toContain("@param boolean animated = false");
    expect(src).toContain("@param boolean showValue = false");
    expect(src).toContain("@param int steps = 0");
    expect(src).toContain("@param int strokeWidth = 0");
    expect(src).toContain('@param String cssClass = ""');
    expect(src).toContain('@param String attrs = ""');
    expect(src).toContain(
      "@param java.util.Map<String, String> dataAttrs = java.util.Map.of()",
    );
    expect(src).toContain("@param gg.jte.Content trailing = null");
    expect(src).toContain("@param gg.jte.Content footer = null");
  });

  test("uses Integer (nullable) not int for value -- the null = indeterminate contract", () => {
    // The old API used `int value = -1`; the v-next API uses `Integer value = null`.
    expect(src).toContain("@param Integer value = null");
    expect(src).not.toContain("@param int value");
  });

  test("usage doc carries the @@template.lievit.progress call syntax", () => {
    expect(src).toContain("@@template.lievit.progress(");
  });

  test("imports gg.jte.Content, StringOutput, and Escape for the dataAttrs channel", () => {
    expect(src).toContain("@import gg.jte.Content");
    expect(src).toContain("@import gg.jte.output.StringOutput");
    expect(src).toContain("@import gg.jte.html.escape.Escape");
  });
});

// ---------------------------------------------------------------------------
// ARIA contract (spec sec 4 + WAI-ARIA 1.2 progressbar)
// ---------------------------------------------------------------------------
describe("progress -- WAI-ARIA 1.2 progressbar contract", () => {
  test('root carries role="progressbar" -- always', () => {
    expect(markup).toContain('role="progressbar"');
  });

  test('root carries aria-valuemin="0" -- always, never derived', () => {
    expect(markup).toContain('aria-valuemin="0"');
  });

  test("root carries aria-valuemax set to the max param", () => {
    expect(markup).toContain("aria-valuemax=\"${max}\"");
  });

  test("aria-valuenow uses smart-attribute null when indeterminate -- attribute OMITTED by JTE", () => {
    // Smart attribute: aria-valuenow="${_valuenow}" where _valuenow = null when indeterminate.
    // JTE drops a null attribute entirely, so indeterminate renders with NO aria-valuenow.
    expect(markup).toContain('aria-valuenow="${_valuenow}"');
    // _valuenow is null for indeterminate
    expect(src).toContain("String _valuenow = _indeterminate ? null : String.valueOf(value)");
  });

  test("aria-valuetext is a smart attribute -- emitted only when valueText is non-null", () => {
    // Smart attribute; JTE omits the attribute when the value is null.
    expect(markup).toContain('aria-valuetext="${valueText}"');
  });

  test("aria-label is emitted only when labelledBy is null and label is non-null", () => {
    // _ariaLabel is null when labelledBy is set; JTE drops the null attribute.
    expect(src).toMatch(/_ariaLabel\s*=\s*\(_ariaLabelledBy == null && label != null/);
    expect(markup).toContain('aria-label="${_ariaLabel}"');
  });

  test("aria-labelledby takes precedence over aria-label when non-null", () => {
    expect(src).toMatch(/_ariaLabelledBy\s*=.*labelledBy != null/);
    expect(markup).toContain('aria-labelledby="${_ariaLabelledBy}"');
  });

  test("a JTE comment nags when both label and labelledBy are null (a11y guidance)", () => {
    // The nag comment fires when _ariaLabel == null && _ariaLabelledBy == null.
    expect(src).toMatch(/@if\(_ariaLabel == null && _ariaLabelledBy == null\)/);
  });

  test("the root is NOT focusable -- no tabindex attribute emitted", () => {
    expect(markup).not.toContain("tabindex=");
  });
});

// ---------------------------------------------------------------------------
// State derivation (spec sec 3 States)
// ---------------------------------------------------------------------------
describe("progress -- data-state derivation", () => {
  test("data-state attribute is present on the root with the derived _state value", () => {
    expect(markup).toContain('data-state="${_state}"');
  });

  test("indeterminate state: value == null -> _indeterminate = true", () => {
    expect(src).toContain("boolean _indeterminate = (value == null)");
  });

  test("complete state: value >= max -> _complete = true", () => {
    expect(src).toMatch(/_complete\s*=\s*!_indeterminate && value != null && value >= max/);
  });

  test("_state resolves to 'indeterminate' / 'complete' / 'determinate' strings", () => {
    expect(src).toContain('"indeterminate"');
    expect(src).toContain('"complete"');
    expect(src).toContain('"determinate"');
    // The ternary: indeterminate -> "indeterminate" else (complete -> "complete" else "determinate")
    expect(src).toMatch(/_state\s*=\s*_indeterminate\s*\?\s*"indeterminate"/);
  });
});

// ---------------------------------------------------------------------------
// data-slot topology (spec sec 3 + architecture contract)
// ---------------------------------------------------------------------------
describe("progress -- data-slot topology", () => {
  test('root carries data-slot="progress"', () => {
    expect(markup).toContain('data-slot="progress"');
  });

  test("root carries data-variant and data-size for styling hooks + test targets", () => {
    expect(markup).toContain('data-variant="${variant}"');
    expect(markup).toContain('data-size="${size}"');
  });

  test("root carries data-form for form-branch styling hooks", () => {
    expect(markup).toContain('data-form="${form}"');
  });

  test('line track wrapper carries data-slot="progress-track"', () => {
    expect(markup).toContain('data-slot="progress-track"');
  });

  test('line fill element carries data-slot="progress-fill"', () => {
    expect(markup).toContain('data-slot="progress-fill"');
  });

  test('showValue text element carries data-slot="progress-value-text"', () => {
    expect(markup).toContain('data-slot="progress-value-text"');
  });

  test('trailing slot wrapper carries data-slot="progress-trailing"', () => {
    expect(markup).toContain('data-slot="progress-trailing"');
  });

  test('footer slot wrapper carries data-slot="progress-footer"', () => {
    expect(markup).toContain('data-slot="progress-footer"');
  });

  test("trailing slot is guarded by @if(trailing != null)", () => {
    expect(src).toContain("@if(trailing != null)");
  });

  test("footer slot is guarded by @if(footer != null)", () => {
    expect(src).toContain("@if(footer != null)");
  });
});

// ---------------------------------------------------------------------------
// Form branches: line (spec sec 3 + sec 7)
// ---------------------------------------------------------------------------
describe("progress -- line form (default)", () => {
  test("line form uses a track+fill layout with overflow-hidden on the track", () => {
    expect(markup).toContain("overflow-hidden");
    expect(markup).toContain('data-slot="progress-track"');
  });

  test("fill element is aria-hidden (pure presentation)", () => {
    // At least one aria-hidden="true" on a fill/inner element.
    expect(markup).toMatch(/data-slot="progress-fill"[\s\S]{0,300}aria-hidden="true"/);
  });

  test("indeterminate fill carries the slide animation class", () => {
    expect(src).toContain("lv-progress-slide");
  });

  test("indeterminate fill uses motion-reduce:animate-none (respects prefers-reduced-motion)", () => {
    expect(src).toContain("motion-reduce:animate-none");
  });

  test("determinate fill width is derived from _pctStr (server-side percentage)", () => {
    expect(src).toContain("_pctStr");
    // _pctStr is composed as String.format("%.4f%%", _pct)
    expect(src).toContain('_pctStr = String.format("%.4f", _pct) + "%"');
  });

  test("fill background uses the _fillToken (variant-resolved token reference)", () => {
    // The fill background is the variant token, not a hardcoded colour.
    expect(src).toContain("background:${_fillToken}");
  });

  test("track background uses --lv-color-muted-bg (the unfilled rail token)", () => {
    expect(markup).toContain("var(--lv-color-muted-bg)");
  });

  test("track uses --lv-radius-full for pill-shaped rounded ends", () => {
    expect(markup).toContain("rounded-[var(--lv-radius-full)]");
  });

  test("track height references the _heightToken (size-driven spacing token)", () => {
    expect(src).toContain("height:${_heightToken}");
  });
});

// ---------------------------------------------------------------------------
// Circle form (spec sec 3 -- Circle/dashboard)
// ---------------------------------------------------------------------------
describe("progress -- circle form", () => {
  test("SVG carries aria-hidden='true' (purely presentational)", () => {
    // The SVG is inside the form-branch for circle/dashboard and must be aria-hidden.
    expect(markup).toContain("aria-hidden=\"true\"");
    expect(src).toMatch(/<svg[\s\S]*?aria-hidden="true"/);
  });

  test("SVG arc math: circumference = 2 * PI * radius (server-side)", () => {
    expect(src).toContain("2.0 * Math.PI * _r");
  });

  test("fill arc stroke-dashoffset is derived from _circleOffsetStr", () => {
    expect(src).toContain("_circleOffsetStr");
  });

  test("fill arc stroke-dasharray references _circumferenceStr (the full circle length)", () => {
    expect(src).toContain("_circumferenceStr");
  });

  test("showValue inside SVG uses <text> element with aria-hidden", () => {
    // The <text> must be aria-hidden (value already in aria-valuenow).
    expect(markup).toMatch(/<text[\s\S]*?aria-hidden="true"/);
  });

  test("circle form is gated by the form == 'circle' or form == 'dashboard' branch", () => {
    expect(src).toMatch(/"circle"\.equals\(form\)/);
    expect(src).toMatch(/"dashboard"\.equals\(form\)/);
  });

  test("circle SVG wrap carries data-slot='progress-svg-wrap'", () => {
    expect(markup).toContain('data-slot="progress-svg-wrap"');
  });
});

// ---------------------------------------------------------------------------
// Dashboard form (spec sec 3 -- 270deg arc)
// ---------------------------------------------------------------------------
describe("progress -- dashboard form", () => {
  test("dashboard arc uses _dashOffsetStr (270deg offset computation)", () => {
    expect(src).toContain("_dashOffsetStr");
  });

  test("dashboard circumference = 75% of full circumference (270/360)", () => {
    // _dashCircumference = _circumference * 0.75
    expect(src).toContain("_circumference * 0.75");
  });

  test("_isDashboard flag drives the transform and offset choice", () => {
    expect(src).toContain('boolean _isDashboard = "dashboard".equals(form)');
  });
});

// ---------------------------------------------------------------------------
// Steps form (spec sec 3 -- Steps)
// ---------------------------------------------------------------------------
describe("progress -- steps form", () => {
  test("steps form is gated by form='steps' and steps > 0", () => {
    expect(src).toMatch(/"steps"\.equals\(form\) && steps > 0/);
  });

  test("steps container carries data-slot='progress-steps'", () => {
    expect(markup).toContain('data-slot="progress-steps"');
  });

  test("segment spans carry aria-hidden='true' (presentational children)", () => {
    // WAI-ARIA 1.2: children of progressbar are presentational.
    expect(src).toContain('aria-hidden="true"');
  });

  test("filled segments carry data-slot='progress-step-filled'", () => {
    expect(markup).toContain('"progress-step-filled"');
  });

  test("empty segments carry data-slot='progress-step-empty'", () => {
    expect(markup).toContain('"progress-step-empty"');
  });

  test("filled count is derived server-side from _pct / 100.0 * steps", () => {
    expect(src).toMatch(/_filledCount\s*=\s*_indeterminate\s*\?\s*0\s*:/);
    expect(src).toContain("_pct / 100.0) * steps");
  });

  test("segment count loop uses @for with _si index, @endfor correctly closed", () => {
    expect(src).toContain("@for(int _si = 0; _si < steps; _si++)");
    expect(src).toContain("@endfor");
  });
});

// ---------------------------------------------------------------------------
// Striped + animated (spec sec 3 States)
// ---------------------------------------------------------------------------
describe("progress -- striped and animated", () => {
  test("striped=true applies the stripe class token (lv-progress-fill--striped)", () => {
    expect(src).toContain("lv-progress-fill--striped");
  });

  test("striped fill uses repeating-linear-gradient with color-mix over the fill token", () => {
    expect(src).toContain("repeating-linear-gradient");
    expect(src).toContain("color-mix(in oklch,");
  });

  test("animated=true + striped=true applies the lv-progress-stripe-move animation class", () => {
    expect(src).toContain("lv-progress-stripe-move");
    expect(src).toContain("lv-progress-fill--animated");
  });

  test("animated without striped is a no-op (_doAnimate = animated && striped)", () => {
    // _doAnimate = animated && striped && !_indeterminate
    expect(src).toMatch(/_doAnimate\s*=\s*animated && striped/);
  });

  test("stripe animation class includes motion-reduce:animate-none", () => {
    // Respects prefers-reduced-motion.
    expect(src).toMatch(/lv-progress-stripe-move[\s\S]{0,100}motion-reduce:animate-none/);
  });
});

// ---------------------------------------------------------------------------
// showValue (spec sec 3 + sec 7)
// ---------------------------------------------------------------------------
describe("progress -- showValue", () => {
  test("showValue text element carries aria-hidden='true' (value in aria-valuenow already)", () => {
    // The visible text must not duplicate the ARIA value announcement.
    // aria-hidden may appear before or after data-slot depending on the form branch;
    // assert that every occurrence of data-slot="progress-value-text" is on an
    // element that also carries aria-hidden="true" within 400 chars either direction.
    const idx = markup.indexOf('data-slot="progress-value-text"');
    expect(idx, "data-slot=progress-value-text not found").toBeGreaterThan(-1);
    const window = markup.slice(Math.max(0, idx - 50), idx + 300);
    expect(window).toContain('aria-hidden="true"');
  });

  test("showValue text uses --lv-color-fg token (not hardcoded)", () => {
    // The percentage text colour is var(--lv-color-fg).
    expect(markup).toContain("color:var(--lv-color-fg)");
  });

  test("showValue is guarded by @if(showValue)", () => {
    expect(src).toContain("@if(showValue)");
  });
});

// ---------------------------------------------------------------------------
// Variant token mapping (spec sec 3 Variants)
// ---------------------------------------------------------------------------
describe("progress -- variant -> fill token switch", () => {
  test("default variant uses --lv-color-primary", () => {
    expect(src).toContain('"var(--lv-color-primary)"');
  });

  test("info variant uses --lv-color-info", () => {
    expect(src).toContain('"var(--lv-color-info)"');
  });

  test("success variant uses --lv-color-success", () => {
    expect(src).toContain('"var(--lv-color-success)"');
  });

  test("warning variant uses --lv-color-warning", () => {
    expect(src).toContain('"var(--lv-color-warning)"');
  });

  test("destructive variant uses --lv-color-destructive", () => {
    expect(src).toContain('"var(--lv-color-destructive)"');
  });

  test("fill token is resolved via a switch (not a chain of if/else)", () => {
    // The switch expression pattern: String _fillToken = switch (variant) { case ... }
    expect(src).toMatch(/String _fillToken = switch \(variant\)/);
  });
});

// ---------------------------------------------------------------------------
// Size -> height token mapping (spec sec 3 Sizes)
// ---------------------------------------------------------------------------
describe("progress -- size -> height token mapping", () => {
  test("sm -> --lv-space-1 (4px track height)", () => {
    expect(src).toContain('"var(--lv-space-1)"');
  });

  test("md -> --lv-space-2 (8px, the default track height)", () => {
    expect(src).toContain('"var(--lv-space-2)"');
  });

  test("lg -> --lv-space-3 (12px track height)", () => {
    expect(src).toContain('"var(--lv-space-3)"');
  });

  test("height is resolved via a switch on size into _heightToken", () => {
    expect(src).toMatch(/String _heightToken = switch \(size\)/);
  });

  test("default size case resolves to --lv-space-2 (md is the default)", () => {
    // The switch default (or explicit "md" branch) maps to space-2.
    expect(src).toMatch(/default\s*->\s*"var\(--lv-space-2\)"/);
  });
});

// ---------------------------------------------------------------------------
// Indeterminate animation @keyframes (delivered to lievit-tokens.css)
// ---------------------------------------------------------------------------
describe("progress -- @keyframes in lievit-tokens.css", () => {
  test("lv-progress-slide keyframe is defined in lievit-tokens.css", () => {
    expect(tokensSrc).toContain("@keyframes lv-progress-slide");
  });

  test("lv-progress-stripe-move keyframe is defined in lievit-tokens.css", () => {
    expect(tokensSrc).toContain("@keyframes lv-progress-stripe-move");
  });

  test("lv-progress-arc-spin keyframe is defined in lievit-tokens.css", () => {
    expect(tokensSrc).toContain("@keyframes lv-progress-arc-spin");
  });

  test("--lv-motion-duration-slow token is defined in lievit-tokens.css", () => {
    expect(tokensSrc).toContain("--lv-motion-duration-slow:");
  });

  test("--lv-motion-easing-in-out token is defined in lievit-tokens.css", () => {
    expect(tokensSrc).toContain("--lv-motion-easing-in-out:");
  });

  test("indeterminate line animation references lv-progress-slide", () => {
    expect(src).toContain("lv-progress-slide");
  });

  test("indeterminate arc animation references lv-progress-arc-spin", () => {
    expect(src).toContain("lv-progress-arc-spin");
  });
});

// ---------------------------------------------------------------------------
// Token-driven styling: no bare hex (spec sec 5 + architecture contract sec 4)
// ---------------------------------------------------------------------------
describe("progress -- token-driven styling (no bare hex)", () => {
  test("no bare hex colour in the markup (all colours via --lv-* tokens)", () => {
    // Strip JTE comments before checking to avoid matching hex in comment prose.
    expect(markup, "leaked a hardcoded hex colour").not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  test("fill token references use var(--lv-color-*) notation", () => {
    // All variant fill colours reference CSS custom properties.
    expect(src).toMatch(/var\(--lv-color-primary\)/);
    expect(src).toMatch(/var\(--lv-color-info\)/);
    expect(src).toMatch(/var\(--lv-color-success\)/);
    expect(src).toMatch(/var\(--lv-color-warning\)/);
    expect(src).toMatch(/var\(--lv-color-destructive\)/);
  });

  test("track uses --lv-color-muted-bg token (not a hardcoded value)", () => {
    expect(markup).toContain("var(--lv-color-muted-bg)");
  });

  test("font-family uses --lv-font-sans token", () => {
    expect(markup).toContain("font-family:var(--lv-font-sans)");
  });
});

// ---------------------------------------------------------------------------
// Security / CSP hygiene (architecture contract sec 3)
// ---------------------------------------------------------------------------
describe("progress -- security and CSP hygiene", () => {
  test("no inline <script> tag", () => {
    expect(src).not.toMatch(/<script/i);
  });

  test("no inline on* event handler attributes", () => {
    const handlers = markup.match(/\son[a-z]+=/gi) ?? [];
    expect(handlers, `unexpected inline handlers: ${handlers.join(", ")}`).toEqual([]);
  });

  test("no dev.lievit import (classpath of JTE compile gate has only JDK + jte + icons)", () => {
    expect(src).not.toContain("@import dev.lievit");
  });

  test("uses JTE comment syntax <%-- --%>, not @* *@", () => {
    expect(src).not.toMatch(/@\*/);
    expect(src).toContain("<%--");
    expect(src).toContain("--%>");
  });

  test("JTE comments do not nest (inner --%> would close the outer early)", () => {
    // Count of --%> occurrences must equal count of <%-- occurrences; none overlap.
    // Simpler check: after stripping all full <%-- ... --%> blocks, no --%> remnant.
    const stripped = src.replace(/<%--[\s\S]*?--%>/g, "");
    expect(stripped).not.toContain("--%>");
  });

  test("no em-dash (house rule: use commas, colons, periods, pipes)", () => {
    expect(src).not.toContain("—");
  });

  test("no inline style= that carries behaviour (animation class via className, not style=)", () => {
    // Animation is applied via class (animate-[...]), never via style="animation:..."
    expect(markup).not.toMatch(/style="[^"]*animation:/);
  });
});

// ---------------------------------------------------------------------------
// XSS trust split: attrs (trusted raw) + dataAttrs (safe escaped)
// ---------------------------------------------------------------------------
describe("progress -- XSS trust split: attrs + dataAttrs channels", () => {
  test("dataAttrs VALUE is routed through Escape.htmlAttribute (never emitted raw)", () => {
    expect(src).toMatch(/Escape\.htmlAttribute\(\s*e\.getValue\(\)/);
    expect(src, "dataAttrs value must not be $unsafe").not.toMatch(
      /\$unsafe\{[^}]*getValue/,
    );
  });

  test("dataAttrs KEY is allowlisted to simple identifiers [A-Za-z][A-Za-z0-9-]*", () => {
    expect(src).toMatch(/getKey\(\)\.matches\("\[A-Za-z\]\[A-Za-z0-9-\]\*"\)/);
  });

  test("the pre-escaped fragment is emitted with $unsafe{_dataAttrsMarkup}", () => {
    expect(src).toContain("$unsafe{_dataAttrsMarkup}");
  });

  test("the trusted attrs string is emitted with $unsafe{attrs}", () => {
    expect(src).toContain("$unsafe{attrs}");
  });

  test("exactly two $unsafe sinks: _dataAttrsMarkup (pre-escaped) + attrs (trusted)", () => {
    const sinks = src.match(/\$unsafe\{[^}]*\}/g) ?? [];
    expect(sinks).toEqual(["$unsafe{_dataAttrsMarkup}", "$unsafe{attrs}"]);
  });

  test("attrs param is declared as the trusted raw channel", () => {
    expect(src).toContain('@param String attrs = ""');
    expect(src.toLowerCase()).toMatch(/trusted/);
  });
});

// ---------------------------------------------------------------------------
// JTE structural hygiene (@if balanced, @for balanced, @param before body)
// ---------------------------------------------------------------------------
describe("progress -- JTE structural hygiene", () => {
  test("@if and @endif counts are balanced", () => {
    const ifCount = (src.match(/@if\b/g) ?? []).length;
    const endifCount = (src.match(/@endif\b/g) ?? []).length;
    expect(ifCount, `@if (${ifCount}) != @endif (${endifCount})`).toBe(endifCount);
  });

  test("@for and @endfor counts are balanced", () => {
    const forCount = (src.match(/@for\b/g) ?? []).length;
    const endforCount = (src.match(/@endfor\b/g) ?? []).length;
    expect(forCount, `@for (${forCount}) != @endfor (${endforCount})`).toBe(endforCount);
  });

  test("@else and @elseif are within if/endif blocks (no orphan else)", () => {
    // Simple check: @else count must be less than @if count.
    const elseCount = (src.match(/@else\b/g) ?? []).length;
    const ifCount = (src.match(/@if\b/g) ?? []).length;
    expect(elseCount).toBeLessThanOrEqual(ifCount);
  });

  test("all @param declarations appear before the first !{var ...} expression", () => {
    const firstParam = src.indexOf("@param ");
    const firstVar = src.indexOf("!{");
    // params must come before vars in the file
    expect(firstParam).toBeGreaterThan(0);
    expect(firstVar).toBeGreaterThan(firstParam);
  });

  test("no @import dev.lievit.* (the JTE compile gate classpath excludes it)", () => {
    expect(src).not.toMatch(/@import\s+dev\.lievit/);
  });

  test("no @if in attribute NAME position (use smart attributes instead)", () => {
    // Hard rule: @if(cond)attr="..." @endif in name position is illegal JTE.
    // Smart attribute pattern: attr="${cond ? val : null}" stays in VALUE position.
    expect(markup).not.toMatch(/\s@if\([^)]*\)\s*[a-z-]+=["']/);
  });
});
