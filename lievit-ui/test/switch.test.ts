/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * lievit-ui switch.jte -- full structural golden after the v-next re-forge.
 *
 * The switch was rewritten from a <input type=checkbox role=switch> (old) to a
 * <button role=switch aria-checked> primary variant + an opt-in asCheckbox variant.
 * This suite pins every contract from spec §7 acceptance tests as source-as-text assertions.
 *
 * NO DOM render + axe-core is wired here (axe-core is not a dependency of this package).
 * The axe contract is enforced instead by asserting the ARIA attributes that the named axe
 * rules check:
 *   - button-name / label  → ariaLabel or ariaLabelledBy is emitted on the element
 *   - aria-allowed-attr    → aria-checked is on role=switch, aria-busy when loading
 *   - aria-required-attr   → aria-checked always emitted (not conditional)
 *   - aria-valid-attr-value→ aria-checked is exactly "true" or "false" (never "mixed")
 *   - aria-roles           → role="switch" on both variants
 * Each test that maps to an axe rule is annotated: [axe: <rule>].
 *
 * See also: jte-static-partials.test.ts which covers the shared house-rules
 * (no em-dash, JTE comment syntax, no inline script, usage doc).
 */
import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const jteDir = join(import.meta.dirname, "..", "registry", "jte");
const src = readFileSync(join(jteDir, "switch.jte"), "utf8");
/** Source with the leading doc comment stripped so assertions never accidentally match doc prose. */
const markup = src.replace(/<%--[\s\S]*?--%>/g, "");

// ---------------------------------------------------------------------------
// §2 API — param declarations
// ---------------------------------------------------------------------------
describe("switch.jte -- params & docs API", () => {
  test("declares every documented param with the correct default", () => {
    expect(src).toContain("@param boolean checked = false");
    expect(src).toContain('@param String size = "md"');
    expect(src).toContain("@param boolean disabled = false");
    expect(src).toContain("@param boolean loading = false");
    expect(src).toContain("@param boolean asCheckbox = false");
    expect(src).toContain("@param String name = null");
    expect(src).toContain('@param String value = "on"');
    expect(src).toContain("@param String ariaLabel = null");
    expect(src).toContain("@param String ariaLabelledBy = null");
    expect(src).toContain("@param String ariaDescribedBy = null");
    expect(src).toContain("@param String onLabel = null");
    expect(src).toContain("@param String offLabel = null");
    expect(src).toContain('@param String cssClass = ""');
    expect(src).toContain('@param String attrs = ""');
    expect(src).toContain("@param java.util.Map<String, String> dataAttrs = java.util.Map.of()");
    expect(src).toContain("@param String wireClick = null");
    expect(src).toContain("@param java.util.Map<String, String> wireArgs = java.util.Map.of()");
    expect(src).toContain("@param gg.jte.Content leading = null");
    expect(src).toContain("@param gg.jte.Content trailing = null");
  });

  test("usage doc uses <%-- --%> (not @* *@) and shows the @@template.lievit.switch call", () => {
    expect(src).toContain("<%--");
    expect(src).toContain("--%>");
    expect(src, "must NOT use @* *@ comment syntax").not.toMatch(/@\*/);
    expect(src).toMatch(/Usage:/);
    expect(src).toContain("@@template.lievit.switch(");
  });
});

// ---------------------------------------------------------------------------
// §7 render — basic structure: data-slots, button variant as default
// ---------------------------------------------------------------------------
describe("switch.jte -- basic structure (button variant is primary)", () => {
  test("the primary variant is a <button role=switch> (NOT a div-with-role or a bare <a>) [axe: aria-roles]", () => {
    // The new switch is button-first per WAI-ARIA APG button-based pattern.
    expect(markup).toMatch(/<button[\s\S]*?role="switch"/);
    // Must NOT use a div or span as the interactive element.
    expect(markup).not.toMatch(/<div[^>]*role="switch"/);
    expect(markup).not.toMatch(/<span[^>]*role="switch"/);
  });

  test("the button type is hardcoded to 'button' (avoids implicit submit inside a form)", () => {
    expect(markup).toContain('type="button"');
  });

  test("the root wrapper carries data-slot=switch-root for test selectors and styling hooks", () => {
    expect(markup).toContain('data-slot="switch-root"');
  });

  test("the interactive element carries data-slot=switch", () => {
    expect(markup).toContain('data-slot="switch"');
  });

  test("the thumb span carries data-slot=switch-thumb and aria-hidden (decorative, not AT content)", () => {
    expect(markup).toContain('data-slot="switch-thumb"');
    // The thumb is the sliding element; it is purely visual.
    const thumbIdx = markup.indexOf('data-slot="switch-thumb"');
    const thumbBlock = markup.slice(thumbIdx, thumbIdx + 200);
    expect(thumbBlock).toContain('aria-hidden="true"');
  });

  test("data-size is on the root for styling hooks", () => {
    expect(markup).toContain('data-size="${size}"');
  });

  test("root wrapper uses inline-flex + gap-[var(--lv-space-2)] for leading/trailing slot alignment", () => {
    expect(markup).toContain("inline-flex");
    expect(markup).toContain("gap-[var(--lv-space-2)]");
  });

  test("no raw <svg> markup — no icons are inlined in the template itself", () => {
    // The loading spinner is composed via @template.lievit.spinner, not a raw <svg>.
    const rawSvg = markup.match(/<svg\b/gi) ?? [];
    expect(rawSvg, "raw <svg> found; icons must go through @template partials").toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// §7 render — checked state: aria-checked (button variant) [axe: aria-allowed-attr,
//   aria-required-attr, aria-valid-attr-value]
// ---------------------------------------------------------------------------
describe("switch.jte -- checked state (button variant)", () => {
  test("aria-checked is always emitted (not conditional): exactly 'true' or 'false' [axe: aria-required-attr, aria-valid-attr-value]", () => {
    // aria-checked is a REQUIRED attribute for role=switch; it must always be present.
    // It must be exactly "true" or "false" (aria-checked="mixed" is illegal on switch).
    expect(markup).toContain('aria-checked="${checked ? "true" : "false"}"');
    // Guard: "mixed" is explicitly forbidden by the spec (§8).
    expect(markup).not.toContain('"mixed"');
  });

  test("data-checked mirrors the boolean param for CSS attribute-selector state sync", () => {
    // The button variant uses data-checked on the button itself; peer-checked is used in the
    // checkbox variant. Both are pure CSS — no JS drives the thumb translate.
    expect(markup).toContain('data-checked="${checked}"');
  });

  test("the button track has data-[checked=true] colour selectors (no JS colour update)", () => {
    // Track background switches from --lv-color-input to --lv-color-primary on check.
    expect(src).toContain("data-[checked=true]:border-[var(--lv-color-primary)]");
    expect(src).toContain("data-[checked=true]:bg-[var(--lv-color-primary)]");
  });

  test("the thumb translate is driven by [[data-checked=true]_&] ancestor selectors (button variant)", () => {
    // sm, md, lg each get their own static translate string so the Tailwind scanner picks them up.
    expect(src).toContain("[[data-checked=true]_&]:translate-x-[14px]");  // sm
    expect(src).toContain("[[data-checked=true]_&]:translate-x-[18px]");  // md
    expect(src).toContain("[[data-checked=true]_&]:translate-x-[22px]");  // lg
    // All three must also set the thumb colour to the primary-fg token.
    const primaryFgOccurrences = src.match(/\[\[data-checked=true\]_&\]:bg-\[var\(--lv-color-primary-fg\)\]/g) ?? [];
    expect(primaryFgOccurrences.length, "each size must set the checked thumb colour").toBe(3);
  });
});

// ---------------------------------------------------------------------------
// §7 render — asCheckbox variant
// ---------------------------------------------------------------------------
describe("switch.jte -- asCheckbox variant", () => {
  test("asCheckbox=true branch uses <input type=checkbox role=switch>", () => {
    // The @if(asCheckbox) branch renders the input, not a button.
    expect(markup).toContain('@if(asCheckbox)');
    expect(markup).toMatch(/<input[\s\S]*?type="checkbox"/);
    expect(markup).toMatch(/<input[\s\S]*?role="switch"/);
  });

  test("the checkbox input carries name + value (form submission attributes)", () => {
    // Only meaningful for asCheckbox=true; the button variant has no name/value.
    expect(markup).toContain('name="${name}"');
    expect(markup).toContain('value="${value}"');
  });

  test("the native `checked` attribute is used (not aria-checked) on the checkbox variant", () => {
    // For a native <input type=checkbox>, the browser derives aria-checked from `checked`.
    // We must NOT emit aria-checked manually on the input — the browser manages it.
    expect(markup).toContain('checked="${checked}"');
    // The aria-checked interpolation must NOT appear on the input (it's on the button branch only).
    // We verify by checking it appears exactly once in markup (on the <button> side).
    const ariaCheckedOccurrences = markup.match(/aria-checked="\$\{checked \? "true" : "false"\}"/g) ?? [];
    expect(ariaCheckedOccurrences.length, "aria-checked must appear exactly once (on the button, not the input)").toBe(1);
  });

  test("the checkbox variant wraps the input in a <span> with peer-checked: CSS selectors (not [[data-checked]])", () => {
    // The checkbox variant drives thumb translate via the Tailwind `peer` / `peer-checked:` pattern.
    expect(src).toContain("peer-checked:translate-x-[14px]");  // sm
    expect(src).toContain("peer-checked:translate-x-[18px]");  // md
    expect(src).toContain("peer-checked:translate-x-[22px]");  // lg
    expect(markup).toContain('class="peer sr-only"');
  });

  test("checkbox variant uses has-[:focus-visible] on the outer span for the focus ring (input is sr-only)", () => {
    // The input is positioned off-screen (sr-only) so the focus ring is expressed on the parent span.
    expect(markup).toContain("has-[:focus-visible]:shadow-[var(--lv-ring)]");
  });

  test("checkbox variant uses has-[:disabled]:cursor-not-allowed + has-[:disabled]:opacity for disabled dimming", () => {
    expect(markup).toContain("has-[:disabled]:cursor-not-allowed");
    expect(markup).toContain("has-[:disabled]:opacity-[var(--lv-opacity-disabled)]");
  });
});

// ---------------------------------------------------------------------------
// §7 render — disabled: native disabled, NOT aria-disabled [axe: aria-prohibited-attr]
// ---------------------------------------------------------------------------
describe("switch.jte -- disabled state uses native disabled, never aria-disabled", () => {
  test("button variant: disabled is rendered as the native `disabled` attribute [axe: aria-prohibited-attr]", () => {
    // For a native <button>, use the `disabled` HTML attribute, NOT aria-disabled.
    // aria-disabled is for <a role=button> where the link must remain focusable (e.g. tooltip).
    expect(markup).toContain('disabled="${isBlocked}"');
  });

  test("the template computes isBlocked from disabled || loading (both block activation)", () => {
    // loading also blocks the element so a round-trip cannot be double-submitted.
    expect(src).toContain("boolean isBlocked = disabled || loading;");
  });

  test("aria-disabled is NOT present anywhere in the markup (it would be wrong for <button>/<input>)", () => {
    expect(markup).not.toMatch(/aria-disabled/);
  });

  test("button variant: disabled:cursor-not-allowed + disabled:opacity via Tailwind disabled: modifier", () => {
    expect(markup).toContain("disabled:cursor-not-allowed");
    expect(markup).toContain("disabled:opacity-[var(--lv-opacity-disabled)]");
  });
});

// ---------------------------------------------------------------------------
// §7 render — loading / aria-busy [axe: aria-allowed-attr]
// ---------------------------------------------------------------------------
describe("switch.jte -- loading state", () => {
  test("loading=true emits aria-busy='true' on the interactive element [axe: aria-allowed-attr]", () => {
    // aria-busy is valid on role=switch; it signals the toggle round-trip is in-flight.
    expect(markup).toContain('aria-busy="${loading ? "true" : null}"');
  });

  test("the spinner partial is composed inside the thumb when loading=true (NOT a raw <svg>)", () => {
    // The spinner gives a visual loading cue inside the track; it is composed via @template.
    expect(src).toContain('@if(loading)');
    expect(src).toContain('@template.lievit.spinner(size = "sm", label = "Loading")');
  });

  test("when NOT loading, aria-busy resolves to null (attribute is dropped, not set to false)", () => {
    // JTE drops null-valued attributes; so aria-busy only appears when loading=true.
    // '? null' is the JTE pattern for a conditional drop.
    expect(markup).toContain('aria-busy="${loading ? "true" : null}"');
  });
});

// ---------------------------------------------------------------------------
// §7 render — sizes: sm / md / lg [axe: n/a — structural tokens contract]
// ---------------------------------------------------------------------------
describe("switch.jte -- size scale (toolbar-aligned)", () => {
  const SIZES: ReadonlyArray<readonly [string, string, string, string, string]> = [
    // [size, trackH×W classes, thumbToken, buttonTranslate, checkboxTranslate]
    ["sm", "h-[18px] w-[32px]", "size-[var(--lv-space-5)]", "[[data-checked=true]_&]:translate-x-[14px]", "peer-checked:translate-x-[14px]"],
    ["md", "h-[22px] w-[40px]", "size-[var(--lv-space-6)]", "[[data-checked=true]_&]:translate-x-[18px]", "peer-checked:translate-x-[18px]"],
    ["lg", "h-[28px] w-[50px]", "size-[var(--lv-space-7)]", "[[data-checked=true]_&]:translate-x-[22px]", "peer-checked:translate-x-[22px]"],
  ];

  for (const [size, trackClasses, thumbToken, btnTranslate, cbTranslate] of SIZES) {
    test(`size="${size}": track is ${trackClasses}`, () => {
      expect(src, `size ${size} track class missing`).toContain(`"${trackClasses}"`);
    });

    test(`size="${size}": thumb uses the spacing token ${thumbToken}`, () => {
      expect(src, `size ${size} thumb token missing`).toContain(thumbToken);
    });

    test(`size="${size}": button variant thumb translate is ${btnTranslate}`, () => {
      expect(src, `size ${size} button translate missing`).toContain(btnTranslate);
    });

    test(`size="${size}": checkbox variant thumb translate is ${cbTranslate}`, () => {
      expect(src, `size ${size} checkbox translate missing`).toContain(cbTranslate);
    });
  }

  test("md is the default (switch expression falls through to default for 'md')", () => {
    // The JTE switch uses `default -> "h-[22px] w-[40px]"` so md is the fallback.
    expect(src).toContain('default   -> "h-[22px] w-[40px]"');
    expect(src).toContain('default   -> "size-[var(--lv-space-6)]"');
  });

  test("track sizes use px-based arbitrary values (the Tailwind scanner requires complete static strings)", () => {
    // Architecture contract: all class strings in the JTE switch arms must be COMPLETE so
    // the Tailwind content scanner picks them up without a safelist.
    expect(src).toContain('"h-[18px] w-[32px]"');
    expect(src).toContain('"h-[22px] w-[40px]"');
    expect(src).toContain('"h-[28px] w-[50px]"');
  });
});

// ---------------------------------------------------------------------------
// §7 render — onLabel / offLabel: inner text is aria-hidden [axe: aria-hidden-body]
// ---------------------------------------------------------------------------
describe("switch.jte -- onLabel / offLabel inner labels are aria-hidden", () => {
  test("onLabel span carries aria-hidden='true' to avoid 'On On' double-announcement [axe: aria-hidden-body]", () => {
    // The accessible state is already conveyed by aria-checked; the inner label is decorative.
    expect(markup).toContain('class="switch-on-label');
    // Find the switch-on-label span and assert aria-hidden is within the same span element.
    // The class string is long (up to 200 chars), so we look at a 500-char window.
    const onLabelIdx = markup.indexOf('switch-on-label');
    const onLabelSpan = markup.slice(Math.max(0, onLabelIdx - 100), onLabelIdx + 500);
    expect(onLabelSpan, "switch-on-label must carry aria-hidden=true").toContain('aria-hidden="true"');
  });

  test("offLabel span carries aria-hidden='true' to avoid 'Off Off' double-announcement [axe: aria-hidden-body]", () => {
    expect(markup).toContain('class="switch-off-label');
    const offLabelIdx = markup.indexOf('switch-off-label');
    const offLabelSpan = markup.slice(Math.max(0, offLabelIdx - 100), offLabelIdx + 500);
    expect(offLabelSpan, "switch-off-label must carry aria-hidden=true").toContain('aria-hidden="true"');
  });

  test("onLabel is gated by @if(onLabel != null) (only rendered when the param is supplied)", () => {
    expect(src).toContain('@if(onLabel != null)');
  });

  test("offLabel is gated by @if(offLabel != null)", () => {
    expect(src).toContain('@if(offLabel != null)');
  });

  test("button variant: onLabel visibility uses [[data-checked=true]_&]:inline (ancestor selector)", () => {
    // The button-variant onLabel is shown/hidden by an ancestor data-checked selector.
    expect(src).toContain("[[data-checked=true]_&]:inline");
  });

  test("checkbox variant: onLabel visibility uses peer-checked:inline (sibling selector)", () => {
    expect(src).toContain("peer-checked:inline");
  });
});

// ---------------------------------------------------------------------------
// §7 render — accessible name enforcement [axe: button-name, label]
// ---------------------------------------------------------------------------
describe("switch.jte -- accessible name: ariaLabel + ariaLabelledBy + ariaDescribedBy", () => {
  test("ariaLabel is emitted as aria-label on the interactive element [axe: button-name, label]", () => {
    // A switch without an accessible name is an axe button-name violation (button variant)
    // or a label violation (checkbox variant). The template surfaces ariaLabel for standalone use.
    expect(markup).toContain('aria-label="${ariaLabel}"');
  });

  test("ariaLabelledBy is emitted as aria-labelledby (external element reference) [axe: button-name, label]", () => {
    expect(markup).toContain('aria-labelledby="${ariaLabelledBy}"');
  });

  test("ariaDescribedBy is emitted as aria-describedby (hint / description region) [axe: aria-allowed-attr]", () => {
    expect(markup).toContain('aria-describedby="${ariaDescribedBy}"');
  });

  test("the docs state ariaLabel is REQUIRED when no visible adjacent label exists", () => {
    // The template header must document the accessible-name constraint so adopters know.
    expect(src.toLowerCase()).toMatch(/required.*arialabel|arialabel.*required|required when no/i);
  });

  test("the spec documents that onLabel/offLabel are NOT the accessible name (aria-hidden)", () => {
    // Guard against a common anti-pattern: using inner-label text as the only accessible name.
    expect(src.toLowerCase()).toMatch(/aria-hidden|does not provide the accessible name|not.*accessible name/i);
  });
});

// ---------------------------------------------------------------------------
// §7 wire integration — wireClick + wireArgs + dataAttrs XSS split
// ---------------------------------------------------------------------------
describe("switch.jte -- wire integration (safe escaping contract)", () => {
  test("wireClick is emitted as l:click on the interactive element when set (SAFE)", () => {
    // The wire action name is interpolated in an attribute-value position; JTE escapes it.
    // Pattern: l:click="${(wireClick != null && !wireClick.isBlank()) ? wireClick : null}"
    expect(markup).toContain('l:click="${(wireClick != null && !wireClick.isBlank()) ? wireClick : null}"');
  });

  test("dataAttrs VALUE is escaped via Escape.htmlAttribute, never emitted raw [XSS]", () => {
    // Same contract as button.jte: each dynamic value is routed through the JTE attribute escaper.
    expect(src).toContain("@import gg.jte.html.escape.Escape");
    expect(src).toMatch(/Escape\.htmlAttribute\(\s*e\.getValue\(\)/);
    // The value must never be emitted raw via $unsafe.
    expect(src, "dataAttrs value must not be $unsafe").not.toMatch(/\$unsafe\{[^}]*getValue/);
  });

  test("keys are validated as [A-Za-z][A-Za-z0-9-]* (non-identifier key cannot inject markup)", () => {
    // The key sits in attribute-NAME position (data-<key>), so it is allowlisted to identifiers.
    expect(src).toMatch(/getKey\(\)\.matches\("\[A-Za-z\]\[A-Za-z0-9-\]\*"\)/);
  });

  test("wireArgs are merged over dataAttrs (wireArgs win on key collision, same as button.jte)", () => {
    // The template merges dataAttrs first, then putAll(wireArgs), so wire args override.
    expect(src).toContain("dataAttrsMerged.putAll(dataAttrs);");
    expect(src).toContain("dataAttrsMerged.putAll(wireArgs);");
  });

  test("exactly four $unsafe sinks: the pre-escaped dataAttrs fragment + trusted attrs, once per branch", () => {
    // button branch: $unsafe{dataAttrsMarkup} + $unsafe{attrs}
    // checkbox branch: $unsafe{dataAttrsMarkup} + $unsafe{attrs}
    // Total = 4.
    const unsafeSinks = src.match(/\$unsafe\{[^}]*\}/g) ?? [];
    expect(unsafeSinks, `unexpected $unsafe sinks: ${unsafeSinks.join(", ")}`).toEqual([
      "$unsafe{dataAttrsMarkup}",
      "$unsafe{attrs}",
      "$unsafe{dataAttrsMarkup}",
      "$unsafe{attrs}",
    ]);
  });

  test("the attrs channel is documented as TRUSTED AUTHOR-ONLY (static strings only)", () => {
    // The doc must warn that attrs is $unsafe and restricted to static author-typed strings.
    expect(src.toLowerCase()).toMatch(/trusted/);
  });

  test("imports StringOutput (used to build the pre-escaped dataAttrs fragment)", () => {
    expect(src).toContain("@import gg.jte.output.StringOutput");
  });
});

// ---------------------------------------------------------------------------
// §7 render — leading/trailing slots
// ---------------------------------------------------------------------------
describe("switch.jte -- leading + trailing slots", () => {
  test("leading slot is rendered before the track when non-null", () => {
    expect(markup).toContain("@if(leading != null)");
    expect(markup).toContain("${leading}");
  });

  test("trailing slot is rendered after the track when non-null", () => {
    expect(markup).toContain("@if(trailing != null)");
    expect(markup).toContain("${trailing}");
  });
});

// ---------------------------------------------------------------------------
// §7 render — tokens (no bare hex, no raw px spacing outside track geometry,
//   focus-visible ring, motion-reduce)
// ---------------------------------------------------------------------------
describe("switch.jte -- token contract (colour/space/radius/shadow, no bare hex)", () => {
  test("no bare hex colour leaked into the template", () => {
    expect(src, "leaked a hardcoded hex colour").not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  test("uses --lv-color-primary for the checked track background", () => {
    expect(src).toContain("var(--lv-color-primary)");
  });

  test("uses --lv-color-primary-fg for the checked thumb colour", () => {
    expect(src).toContain("var(--lv-color-primary-fg)");
  });

  test("uses --lv-color-input for the unchecked track background", () => {
    expect(src).toContain("var(--lv-color-input)");
  });

  test("uses --lv-color-border for the unchecked track border", () => {
    expect(src).toContain("var(--lv-color-border)");
  });

  test("uses --lv-color-fg for the unchecked thumb colour", () => {
    expect(src).toContain("var(--lv-color-fg)");
  });

  test("uses --lv-radius-full for the pill track + thumb circle", () => {
    expect(src).toContain("var(--lv-radius-full)");
  });

  test("uses --lv-shadow-xs for the thumb elevation (depth illusion)", () => {
    expect(src).toContain("var(--lv-shadow-xs)");
  });

  test("uses --lv-opacity-disabled for the dimming when disabled/loading", () => {
    expect(src).toContain("var(--lv-opacity-disabled)");
  });

  test("focus-visible ring is expressed via --lv-ring on the interactive element (:focus-visible only)", () => {
    // focus-visible (not :focus) per WCAG 2.5.3 — no ring on mouse click.
    expect(markup).toContain("focus-visible:shadow-[var(--lv-ring)]");
    // The checkbox variant uses has-[:focus-visible] on the outer span.
    expect(markup).toContain("has-[:focus-visible]:shadow-[var(--lv-ring)]");
  });

  test("cssClass is interpolated into the root wrapper class (not the track element)", () => {
    // The consumer uses cssClass to add 'lv-switch--destructive' or custom classes.
    expect(markup).toContain("${cssClass}");
  });

  test("the thumb transition uses motion-reduce:transition-none for prefers-reduced-motion", () => {
    // APG requirement: the thumb slide must be suppressed when the OS requests reduced motion.
    expect(markup).toContain("motion-reduce:transition-none");
  });
});

// ---------------------------------------------------------------------------
// §7 CSP + anti-pattern guard
// ---------------------------------------------------------------------------
describe("switch.jte -- CSP hygiene (no inline script, no on* handlers)", () => {
  test("no inline <script> tag (strict CSP refuses them)", () => {
    expect(src).not.toMatch(/<script/i);
  });

  test("no inline on* event handler attributes (onclick, onchange, etc.)", () => {
    const strippedSrc = src.replace(/<%--[\s\S]*?--%>/g, "");
    const inlineHandlers = strippedSrc.match(/\son[a-z]+=/gi) ?? [];
    expect(inlineHandlers, `unexpected inline handlers: ${inlineHandlers.join(", ")}`).toEqual([]);
  });

  test("no Font Awesome / wa-icon / bare fa- glyph", () => {
    expect(src.toLowerCase()).not.toMatch(/font-?awesome|wa-icon|fa-/);
  });

  test("no aria-checked='mixed' (illegal on role=switch; only legal on role=checkbox)", () => {
    // §8 anti-pattern: the switch is binary — aria-checked must be 'true' or 'false' only.
    expect(src).not.toContain('"mixed"');
  });

  test("no l:model binding on the switch (the switch is wireClick-driven, not model-bound)", () => {
    // The new switch owns no model field; the WIRE template owns checked state.
    // l:click is the channel; l:model would bind a field that does not exist.
    expect(markup).not.toContain("l:model=");
  });

  test("no JPA import or React residue", () => {
    expect(src.toLowerCase()).not.toMatch(/javax\.persistence|jakarta\.persistence/);
    expect(src.toLowerCase()).not.toMatch(/import react|usestate|useeffect/);
  });
});
