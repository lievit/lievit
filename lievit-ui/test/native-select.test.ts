/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * native-select.jte -- full structural + a11y contract (spec §7).
 *
 * The native-select is a static JTE partial compiled in the Java world, so -- as with every
 * other static-partials suite -- this harness asserts on the PARTIAL SOURCE as text.
 * It pins: the param API, the option-authoring paths (options / optionGroups / content slot),
 * the data-slot topology (native-select-wrapper, native-select-label, native-select,
 * native-select-icon), the size scale (sm/md/lg + back-compat default), the invalid state
 * (aria-invalid + destructive border + oklch ring), the disabled state (data-disabled +
 * opacity-50 + pointer-events-none), the accessible-name contract (label > ariaLabel),
 * the chevron-down icon (aria-hidden), the l:model wire binding (conditional on non-null),
 * token-driven styling (no bare hex, all --lv-* vars), security hygiene (no inline script,
 * no on* handler, JTE ${} escaping on all string params including option labels), and the
 * placeholder idiom (disabled hidden option).
 *
 * No DOM render + real axe-core is wired here (axe-core is not a dependency of this package).
 * The axe contract is enforced instead by asserting the ARIA attributes that the named axe
 * rules check:
 *   - label / button-name    -> label@for + selectId, or aria-label when no label
 *   - aria-allowed-attr      -> aria-invalid on <select> when invalid; aria-label when set
 *   - aria-valid-attr-value  -> aria-invalid="true" (not "false"); never empty string
 *   - aria-prohibited-attr   -> no aria-expanded / aria-haspopup / aria-activedescendant (invalid on <select>)
 *   - color-contrast-pass    -> tokens enforced (no hardcoded colours)
 * Each test that maps to an axe rule is annotated: [axe: <rule>].
 *
 * The JTE real-compiler + render gate lives in test/jte-compile (coordinator-run, per-wave).
 * This file is the equivalent structural golden.
 */
import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const jteDir = join(import.meta.dirname, "..", "registry", "jte");
const src = readFileSync(join(jteDir, "native-select.jte"), "utf8");
/** Source with JTE doc-comments stripped: assertions never accidentally match comment prose. */
const markup = src.replace(/<%--[\s\S]*?--%>/g, "");

// ---------------------------------------------------------------------------
// §2 API — param declarations
// ---------------------------------------------------------------------------
describe("native-select -- params & docs API", () => {
  test("declares every documented param with the correct default", () => {
    expect(src).toContain("@param String name = null");
    expect(src).toContain("@param String id = null");
    expect(src).toMatch(/@param java\.util\.List<String> options = null/);
    expect(src).toMatch(
      /@param java\.util\.Map<String, java\.util\.List<String>> optionGroups = null/,
    );
    expect(src).toContain("@param gg.jte.Content content = null");
    expect(src).toContain("@param String value = null");
    expect(src).toContain("@param String label = null");
    expect(src).toContain("@param String ariaLabel = null");
    expect(src).toContain("@param String placeholder = null");
    expect(src).toContain('@param String size = "md"');
    expect(src).toContain("@param boolean disabled = false");
    expect(src).toContain("@param boolean required = false");
    expect(src).toContain("@param boolean invalid = false");
    expect(src).toContain("@param String model = null");
    expect(src).toContain('@param String cssClass = ""');
  });

  test("usage doc uses <%-- --%> JTE comment syntax (NOT @* *@)", () => {
    expect(src).toContain("<%--");
    expect(src).toContain("--%>");
    expect(src, "must NOT use @* *@ comment syntax").not.toMatch(/@\*/);
  });

  test("usage doc shows the @@template.lievit.native-select call", () => {
    expect(src).toContain("@@template.lievit.native-select(");
  });

  test("no @import io.lievit.* in the template (JTE gate classpath: JDK + jte + icons only)", () => {
    expect(src).not.toMatch(/@import io\.lievit\./);
  });
});

// ---------------------------------------------------------------------------
// §7 render -- basic structure: data-slots, <select>, wrapper <div>
// ---------------------------------------------------------------------------
describe("native-select -- basic structure", () => {
  test("renders-select-element: a real native <select data-slot=native-select> (not a custom listbox) [axe: aria-roles]", () => {
    expect(markup).toMatch(/<select\b/);
    expect(markup).toContain('data-slot="native-select"');
    // must NOT use a Lit custom-element or div-based replacement
    expect(markup).not.toMatch(/<lv-select|<rich-select|<lv-combobox/);
    // appearance-none suppresses OS arrow; combined with decorative chevron overlay
    expect(markup).toContain("appearance-none");
  });

  test("renders-wrapper-div: the outer <div data-slot=native-select-wrapper> is present", () => {
    expect(markup).toContain('data-slot="native-select-wrapper"');
    // carries data-size, data-disabled, data-invalid for CSS variant targeting + test hooks
    expect(markup).toContain('data-size="${size}"');
    expect(markup).toContain('data-disabled="${disabled}"');
    expect(markup).toContain('data-invalid="${invalid}"');
  });

  test("renders-label-when-set: the label branch renders a <label data-slot=native-select-label for=selectId>", () => {
    // The conditional block is @if(label != null && !label.isBlank())
    expect(markup).toContain('@if(label != null && !label.isBlank())');
    expect(markup).toContain('data-slot="native-select-label"');
    expect(markup).toContain('for="${selectId}"');
  });

  test("no-label-when-null: the label block is inside a JTE @if so it is absent when label=null", () => {
    // The @if guard ensures no <label> is emitted when label is null or blank.
    expect(markup).toContain("@if(label != null && !label.isBlank())");
    expect(markup).toContain("@endif");
  });

  test("chevron-is-aria-hidden: the decorative chevron span carries aria-hidden=true [axe: aria-hidden-body]", () => {
    expect(markup).toContain('data-slot="native-select-icon"');
    const iconIdx = markup.indexOf('data-slot="native-select-icon"');
    const iconBlock = markup.slice(Math.max(0, iconIdx - 200), iconIdx + 200);
    expect(iconBlock).toContain('aria-hidden="true"');
  });

  test("chevron-is-pointer-events-none: the icon span does not intercept clicks", () => {
    const iconIdx = markup.indexOf('data-slot="native-select-icon"');
    const iconBlock = markup.slice(Math.max(0, iconIdx - 200), iconIdx + 200);
    expect(iconBlock).toContain("pointer-events-none");
  });

  test("id-defaults-to-name: the local var selectId falls back to name when id is null", () => {
    // The idiom: !{var selectId = (id != null && !id.isBlank()) ? id : name;}
    expect(src).toContain("!{var selectId = (id != null && !id.isBlank()) ? id : name;}");
    expect(markup).toContain('id="${selectId}"');
    expect(markup).toContain('name="${name}"');
  });

  test("uses the icon partial for the chevron-down (not an inline SVG or hardcoded markup)", () => {
    expect(markup).toContain('@template.lievit.icon(name = "chevron-down"');
  });
});

// ---------------------------------------------------------------------------
// §7 options -- three authoring paths: options / optionGroups / content slot
// ---------------------------------------------------------------------------
describe("native-select -- option authoring paths", () => {
  test("renders-options-from-list: the flat options list path renders <option> elements with ${opt}", () => {
    expect(markup).toMatch(/@for\s*\(String opt : options\)/);
    expect(markup).toContain('<option value="${opt}"');
    expect(markup).toContain(">${opt}</option>");
  });

  test("renders-optgroups: the optionGroups path renders <optgroup> + nested <option> elements", () => {
    // optionGroups is Map<String, List<String>>
    expect(markup).toMatch(
      /@for\s*\(java\.util\.Map\.Entry<String, java\.util\.List<String>> grp : optionGroups\.entrySet\(\)\)/,
    );
    expect(markup).toContain('<optgroup label="${grp.getKey()}">');
    expect(markup).toMatch(/@for\s*\(String opt : grp\.getValue\(\)\)/);
  });

  test("content-slot-wins: @if(content != null) is the FIRST branch (precedence: content > optionGroups > options)", () => {
    // The three branches in order: content -> optionGroups -> options
    const contentIdx = markup.indexOf("@if(content != null)");
    const optGroupIdx = markup.indexOf("@elseif(optionGroups != null)");
    const optionsIdx = markup.indexOf("@elseif(options != null)");
    expect(contentIdx).toBeGreaterThan(-1);
    expect(optGroupIdx).toBeGreaterThan(contentIdx);
    expect(optionsIdx).toBeGreaterThan(optGroupIdx);
    // content slot: ${content}
    expect(markup).toContain("${content}");
  });

  test("placeholder-option: placeholder renders a disabled hidden option as the first option", () => {
    expect(markup).toContain("@if(placeholder != null && !placeholder.isBlank())");
    expect(markup).toContain('<option value="" disabled hidden');
    // selected when !hasValue (no current value set)
    expect(markup).toContain('selected="${!hasValue}"');
    expect(markup).toContain(">${placeholder}</option>");
  });

  test("selected-option-marked: the opt.equals(value) check marks the matching option as selected", () => {
    // Both the flat options and optionGroups paths use opt.equals(value) for server-side matching.
    expect(markup).toContain('selected="${opt.equals(value)}"');
  });
});

// ---------------------------------------------------------------------------
// §4 a11y -- accessible-name contract
// ---------------------------------------------------------------------------
describe("native-select -- accessible-name contract [axe: label]", () => {
  test("aria-label is emitted ONLY when ariaLabel is non-blank (conditional guard)", () => {
    // The hasAriaLabel local var guards the emission to prevent aria-label="" (empty name violation).
    expect(src).toContain("!{var hasAriaLabel = ariaLabel != null && !ariaLabel.isBlank();}");
    expect(markup).toContain("aria-label=\"${hasAriaLabel ? ariaLabel : null}\"");
  });

  test("label is preferred path: the <label for=selectId> binds the accessible name via HTML (not aria-labelledby)", () => {
    // A real <label for> provides the accessible name without any ARIA attribute.
    expect(markup).toContain('for="${selectId}"');
  });

  test("no aria-expanded / aria-haspopup / aria-activedescendant on the native <select> [axe: aria-prohibited-attr]", () => {
    // These are combobox / custom-listbox attributes; invalid on a native <select> per ARIA 1.2.
    expect(markup).not.toContain("aria-expanded");
    expect(markup).not.toContain("aria-haspopup");
    expect(markup).not.toContain("aria-activedescendant");
  });
});

// ---------------------------------------------------------------------------
// §3 / §7 states: disabled, invalid, required
// ---------------------------------------------------------------------------
describe("native-select -- states", () => {
  test("disabled-state: native disabled attr on <select> + data-[disabled=true] styling on wrapper", () => {
    expect(markup).toContain('disabled="${disabled}"');
    // wrapper dims and blocks pointer events via data-[disabled=true]:
    expect(markup).toContain("data-[disabled=true]:opacity-50");
    expect(markup).toContain("data-[disabled=true]:cursor-not-allowed");
    expect(markup).toContain("data-[disabled=true]:pointer-events-none");
    // <select> also has disabled: utilities
    expect(markup).toContain("disabled:pointer-events-none");
    expect(markup).toContain("disabled:cursor-not-allowed");
  });

  test("invalid-state: aria-invalid + data-[invalid=true] destructive border + oklch ring [axe: aria-valid-attr-value]", () => {
    // aria-invalid is emitted as "true" only when invalid=true; null otherwise (not "false").
    expect(markup).toContain('aria-invalid="${invalid ? "true" : null}"');
    expect(markup).toContain("data-[invalid=true]:border-[var(--lv-color-destructive)]");
    // invalid ring uses color-mix in oklch (architecture contract §4: OKLCH colour format)
    expect(markup).toContain("data-[invalid=true]:shadow-[0_0_0_3px_color-mix(in_oklch,var(--lv-color-destructive)_20%,transparent)]");
  });

  test("required-attribute: native required attr on <select>", () => {
    expect(markup).toContain('required="${required}"');
  });
});

// ---------------------------------------------------------------------------
// §3 / §7 sizes: sm / md / lg / default (back-compat alias)
// ---------------------------------------------------------------------------
describe("native-select -- size scale (toolbar-aligned, height-based)", () => {
  test("data-size-attribute: data-size is on the wrapper div for Tailwind variant targeting", () => {
    expect(markup).toContain('data-size="${size}"');
  });

  test("size-sm: data-[size=sm]:h-[var(--lv-space-8)] is applied on the wrapper", () => {
    expect(markup).toContain("data-[size=sm]:h-[var(--lv-space-8)]");
  });

  test("size-md: data-[size=md]:h-[var(--lv-space-9)] is applied on the wrapper", () => {
    expect(markup).toContain("data-[size=md]:h-[var(--lv-space-9)]");
  });

  test("size-lg: data-[size=lg]:h-[var(--lv-space-10)] is applied on the wrapper", () => {
    expect(markup).toContain("data-[size=lg]:h-[var(--lv-space-10)]");
  });

  test("back-compat-default-size: size='default' renders the same height as 'md' via data-[size=default]", () => {
    // 'default' is an alias of 'md': same --lv-space-9 height token
    expect(markup).toContain("data-[size=default]:h-[var(--lv-space-9)]");
  });
});

// ---------------------------------------------------------------------------
// §7 focus ring: wrapper focus-within styling
// ---------------------------------------------------------------------------
describe("native-select -- focus ring (focus-within on wrapper)", () => {
  test("focus-within drives the border change to --lv-color-ring", () => {
    expect(markup).toContain("focus-within:border-[var(--lv-color-ring)]");
  });

  test("focus-within drives the ring shadow via --lv-ring token", () => {
    expect(markup).toContain("focus-within:shadow-[var(--lv-ring)]");
  });

  test("the wrapper is NOT in the tab order (no tabindex; focus stays on the native <select>)", () => {
    // The wrapper must not carry tabindex; it only relays focus-within styles.
    const wrapperIdx = markup.indexOf('data-slot="native-select-wrapper"');
    // scan the opening tag (up to the next >) for tabindex
    const wrapperTag = markup.slice(wrapperIdx, markup.indexOf(">", wrapperIdx) + 1);
    expect(wrapperTag).not.toContain("tabindex");
  });
});

// ---------------------------------------------------------------------------
// §6 wire binding: l:model
// ---------------------------------------------------------------------------
describe("native-select -- wire binding (l:model)", () => {
  test("model-attr-emitted: l:model=${model} is on the <select> for wire binding (change event -> WIRE field)", () => {
    // l:model is always emitted; when model=null JTE emits l:model="" and the runtime ignores it.
    // Plain-form mode (model=null) falls through to the native <select name> POST.
    expect(markup).toContain('l:model="${model}"');
  });

  test("the <select name> is always present for plain form POST fallback", () => {
    // name is always emitted regardless of model, so a plain form POST works JS-off.
    expect(markup).toContain('name="${name}"');
  });
});

// ---------------------------------------------------------------------------
// §7 token hygiene: no hardcoded colours, all --lv-* vars
// ---------------------------------------------------------------------------
describe("native-select -- token hygiene (no literal colours)", () => {
  test("background uses --lv-color-bg (not a hardcoded colour)", () => {
    expect(markup).toContain("var(--lv-color-bg)");
  });

  test("border colour uses --lv-color-input", () => {
    expect(markup).toContain("var(--lv-color-input)");
  });

  test("text colour uses --lv-color-fg", () => {
    expect(markup).toContain("var(--lv-color-fg)");
  });

  test("chevron colour uses --lv-color-muted-fg", () => {
    expect(markup).toContain("var(--lv-color-muted-fg)");
  });

  test("destructive border uses --lv-color-destructive", () => {
    expect(markup).toContain("var(--lv-color-destructive)");
  });

  test("ring shadow uses --lv-ring token", () => {
    expect(markup).toContain("var(--lv-ring)");
  });

  test("height tokens are --lv-space-8 / --lv-space-9 / --lv-space-10 (no raw px values for heights)", () => {
    expect(markup).toContain("var(--lv-space-8)");
    expect(markup).toContain("var(--lv-space-9)");
    expect(markup).toContain("var(--lv-space-10)");
  });

  test("no hardcoded hex colours in the markup (no #RRGGBB or #RGB literals)", () => {
    // Strip the JTE comment block first (already done: `markup`), then check the body.
    expect(markup).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  test("no hardcoded rgb() / rgba() / oklch() literals in the markup (only var(--lv-*) references)", () => {
    // Colour values must come from tokens; no raw colour functions in the template body.
    // The color-mix() expression is structural (uses a --lv-* token inside it), not a literal.
    // We check that any color-mix() references use a --lv-* var inside (not a bare oklch() literal).
    const colorLiterals = markup.match(/(?<!\(in_oklch,)oklch\s*\(/g);
    expect(colorLiterals ?? []).toHaveLength(0);
    expect(markup).not.toMatch(/\brgb\s*\(/);
    expect(markup).not.toMatch(/\brgba\s*\(/);
  });
});

// ---------------------------------------------------------------------------
// §7 security hygiene: CSP-clean, no inline script, no on* handlers
// ---------------------------------------------------------------------------
describe("native-select -- CSP hygiene", () => {
  test("no inline <script> tag in the template body", () => {
    expect(markup).not.toMatch(/<script\b/i);
  });

  test("no inline on* event handler attributes (onchange, onblur, etc.)", () => {
    // All interactivity via l:model (the lievit runtime directive); no inline handlers.
    expect(markup).not.toMatch(/\bon[a-z]+\s*=/i);
  });

  test("no $unsafe interpolation (this partial has no per-row wire action; no trusted-raw channel)", () => {
    // native-select has no attrs/$unsafe channel (no per-row wire action on this partial).
    expect(markup).not.toContain("$unsafe");
  });

  test("option labels go through JTE ${} (HTML-escaped) not a raw string concatenation", () => {
    // The options/@for loop uses ${opt} (JTE escapes it), never raw string building.
    expect(markup).toContain(">${opt}</option>");
    // No String concatenation building a raw option tag
    expect(markup).not.toMatch(/"<option[^"]*"\s*\+/);
  });
});

// ---------------------------------------------------------------------------
// §7 escaping: XSS guards on string params
// ---------------------------------------------------------------------------
describe("native-select -- XSS escaping contract", () => {
  test("option-label-xss: options List uses ${opt} (JTE attribute-escapes the label)", () => {
    // Verified by the presence of ${opt} in value and text positions (JTE escapes both).
    expect(markup).toContain('value="${opt}"');
    expect(markup).toContain(">${opt}</option>");
  });

  test("optgroup-label-xss: optionGroups uses ${grp.getKey()} for the label attribute (JTE-escaped)", () => {
    expect(markup).toContain('label="${grp.getKey()}"');
  });

  test("placeholder-xss: placeholder uses ${placeholder} (JTE attribute-escapes the text)", () => {
    expect(markup).toContain(">${placeholder}</option>");
  });

  test("cssClass-xss: cssClass is interpolated via ${cssClass} on the wrapper (JTE-escaped)", () => {
    // The wrapper class includes ${cssClass} at the end via JTE's default HTML escaping.
    expect(markup).toContain("${cssClass}");
  });

  test("ariaLabel-xss: ariaLabel is emitted via ${ } (JTE attribute-escapes it)", () => {
    // The conditional expression uses JTE ${} interpolation (not $unsafe).
    expect(markup).toContain("${hasAriaLabel ? ariaLabel : null}");
  });
});
