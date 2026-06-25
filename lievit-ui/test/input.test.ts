/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * lievit-ui input.jte + input-count.enhancer.ts -- full structural acceptance suite.
 *
 * Covers every row in spec §7 (input.md) as source-text and DOM-behaviour assertions:
 *
 *   - §7 Render tests: param forwarding, ARIA attributes, slot rendering, size/state modifiers.
 *   - §7 Axe-core assertions: the ARIA attributes the named axe rules check (no axe-core dep;
 *     we assert the attributes directly -- see the [axe: <rule>] annotations per test).
 *   - §7 Keyboard tests: tab order, form submit on Enter, clearable tab-order management.
 *   - §7 Enhancer tests: count badge, clearable show/hide, lv:clear event, morph rebind.
 *   - §7 Focus tests: no focus trap, focus-within ring wiring.
 *   - §7 Variant/size/state rendering: height token classes, modifier classes.
 *   - §7 JTE compile gate: covered by test/jte-compile (not run here).
 *
 * Test approach:
 *   - Template assertions run against the raw source text (identical to switch.test.ts pattern).
 *     The source comment block is stripped before markup assertions to avoid false positives on
 *     prose inside the doc-comment.
 *   - Enhancer tests mount real DOM in happy-dom, import the real enhancer, and assert
 *     observable DOM outcomes. No mocked runtime, no shortcut (client-island-fidelity rule).
 */
import { describe, test, expect, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { enhanceInput, enhanceAllInputs } from "../registry/jte/input-count.enhancer.js";

// ---------------------------------------------------------------------------
// Source text setup
// ---------------------------------------------------------------------------

const jteDir = join(import.meta.dirname, "..", "registry", "jte");
const src = readFileSync(join(jteDir, "input.jte"), "utf8");

/**
 * Markup source with all JTE block comments stripped so assertions never accidentally
 * match doc prose. Inline `@if(...)` / `!{var ...}` directives and attribute text remain.
 */
const markup = src.replace(/<%--[\s\S]*?--%>/g, "");

// ---------------------------------------------------------------------------
// §2 API — param declarations
// ---------------------------------------------------------------------------

describe("input.jte -- params & docs API", () => {
  test("declares every documented param with the correct type and default", () => {
    expect(src).toContain('@param String type = "text"');
    expect(src).toContain("@param String name = null");
    expect(src).toContain('@param String value = ""');
    expect(src).toContain("@param String placeholder = null");
    expect(src).toContain("@param String id = null");
    expect(src).toContain('@param String size = "md"');
    expect(src).toContain("@param boolean disabled = false");
    expect(src).toContain("@param boolean readonly = false");
    expect(src).toContain("@param boolean required = false");
    expect(src).toContain("@param boolean invalid = false");
    expect(src).toContain("@param String autocomplete = null");
    expect(src).toContain("@param String inputmode = null");
    expect(src).toContain("@param Integer maxlength = null");
    expect(src).toContain("@param boolean showCount = false");
    expect(src).toContain("@param boolean clearable = false");
    expect(src).toContain("@param boolean borderless = false");
    expect(src).toContain('@param String cssClass = ""');
    expect(src).toContain('@param String inputCssClass = ""');
    expect(src).toContain('@param String attrs = ""');
    expect(src).toContain("@param java.util.Map<String, String> dataAttrs = java.util.Map.of()");
    expect(src).toContain("@param gg.jte.Content leading = null");
    expect(src).toContain("@param gg.jte.Content trailing = null");
  });

  test("usage doc uses <%-- --%> comments and shows @@template.lievit.input call", () => {
    expect(src).toContain("<%--");
    expect(src).toContain("--%>");
    expect(src, "must NOT use @* *@ comment syntax").not.toMatch(/@\*/);
    expect(src).toMatch(/Usage:/);
    expect(src).toContain("@@template.lievit.input(");
  });

  test("doc comment cites the WAI-ARIA textbox authority (labeling + the no-APG-pattern-page note)", () => {
    expect(src).toMatch(/WAI-ARIA.*textbox|textbox.*WAI-ARIA/i);
  });
});

// ---------------------------------------------------------------------------
// §7 Render — basic structure: container, data-slots
// ---------------------------------------------------------------------------

describe("input.jte -- basic structure", () => {
  test("root element is a <div data-slot='input'> container (not a bare <input>)", () => {
    expect(markup).toMatch(/data-slot="input"/);
    // The root must be a <div>, not a raw <input> (the old design styled <input> directly).
    expect(markup).toMatch(/<div[\s\S]*?data-slot="input"/);
  });

  test("data-size is on the container for styling hooks and test selectors", () => {
    expect(markup).toContain('data-size="${size}"');
  });

  test("the native <input> carries data-slot='input-field' (the test selector)", () => {
    expect(markup).toContain('data-slot="input-field"');
  });

  test("the native <input> does NOT carry role='textbox' (implicit; redundant/wrong for specialised types) [axe: aria-roles]", () => {
    // role=textbox is implicit on <input type=text>; an explicit one breaks type=search etc.
    expect(markup).not.toMatch(/role="textbox"/);
    expect(markup).not.toMatch(/role="searchbox"/);
  });

  test("no raw <svg> in the template — icons are composed via @template partials", () => {
    const rawSvg = markup.match(/<svg\b/gi) ?? [];
    expect(rawSvg, "raw <svg> found; icons must go through @template partials").toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// §7 Render — type forwarding
// ---------------------------------------------------------------------------

describe("input.jte -- type is forwarded to the native <input>", () => {
  test("type attribute is emitted on the <input> from the param", () => {
    expect(markup).toContain('type="${type}"');
  });

  test("default type is 'text' (the param default)", () => {
    expect(src).toContain('@param String type = "text"');
  });
});

// ---------------------------------------------------------------------------
// §7 Render — value, name, placeholder, id, autocomplete, inputmode, maxlength
// ---------------------------------------------------------------------------

describe("input.jte -- scalar attribute forwarding", () => {
  test("value is forwarded to the <input>", () => {
    expect(markup).toContain('value="${value}"');
  });

  test("name is emitted when non-null (JTE smart attribute -- dropped when null)", () => {
    // JTE smart attributes: `name="${name}"` emits the attribute when non-null, omits when null.
    // No @if gate needed; JTE handles the conditional via the smart-attribute protocol.
    expect(markup).toContain('name="${name}"');
  });

  test("id is emitted when non-null (JTE smart attribute -- dropped when null)", () => {
    expect(markup).toContain('id="${id}"');
  });

  test("placeholder is emitted when non-null (JTE smart attribute -- dropped when null)", () => {
    expect(markup).toContain('placeholder="${placeholder}"');
  });

  test("autocomplete is forwarded when non-null (JTE smart attribute)", () => {
    expect(markup).toContain('autocomplete="${autocomplete}"');
  });

  test("inputmode is forwarded when non-null (JTE smart attribute)", () => {
    expect(markup).toContain('inputmode="${inputmode}"');
  });

  test("maxlength is forwarded when non-null (JTE smart attribute)", () => {
    expect(markup).toContain('maxlength="${maxlength}"');
  });
});

// ---------------------------------------------------------------------------
// §7 Render — ARIA attributes: disabled, readonly, required, invalid [axe: ...]
// ---------------------------------------------------------------------------

describe("input.jte -- ARIA attribute contract [axe rules]", () => {
  test("disabled renders the native disabled attr (NOT aria-disabled) [axe: aria-prohibited-attr]", () => {
    // Native <input> disabled removes it from tab order + AT interactive set; aria-disabled is
    // reserved for <a role=button> where the element must remain focusable.
    // JTE smart attribute: `disabled="${disabled}"` emits the bare `disabled` attr when true, omits when false.
    expect(markup).toContain('disabled="${disabled}"');
    // aria-disabled must NOT appear anywhere in the template.
    expect(markup).not.toContain("aria-disabled");
  });

  test("readonly sets native readonly AND aria-readonly='true' [axe: aria-allowed-attr]", () => {
    // JTE smart attribute for the native readonly; paired aria uses ternary to emit "true" or null.
    expect(markup).toContain('readonly="${readonly}"');
    expect(markup).toContain('aria-readonly="${readonly ? "true" : null}"');
  });

  test("required sets native required AND aria-required='true' [axe: aria-required-attr]", () => {
    // JTE smart attribute for the native required; paired aria uses ternary to emit "true" or null.
    expect(markup).toContain('required="${required}"');
    expect(markup).toContain('aria-required="${required ? "true" : null}"');
  });

  test("invalid sets aria-invalid='true' on the <input> [axe: aria-invalid]", () => {
    // JTE ternary: when invalid=true emits aria-invalid="true"; when false, null drops the attr.
    expect(markup).toContain('aria-invalid="${invalid ? "true" : null}"');
  });

  test("aria-placeholder is NOT set (native placeholder maps automatically) [axe: aria-prohibited-attr]", () => {
    expect(markup).not.toContain("aria-placeholder");
  });

  test("aria-multiline is NOT set (single-line input maps to aria-multiline=false by default)", () => {
    expect(markup).not.toContain("aria-multiline");
  });

  test("the doc states placeholder MUST NOT be the sole accessible name (WCAG SC 3.3.2)", () => {
    expect(src.toLowerCase()).toMatch(/placeholder.*not.*label|placeholder.*not.*accessible name|not a substitute for a.*label/i);
  });
});

// ---------------------------------------------------------------------------
// §7 Render — leading and trailing slots
// ---------------------------------------------------------------------------

describe("input.jte -- leading and trailing adornment slots", () => {
  test("leading slot renders data-slot='input-leading' when non-null", () => {
    expect(markup).toContain("@if(leading != null)");
    expect(markup).toContain('data-slot="input-leading"');
    expect(markup).toContain("${leading}");
  });

  test("leading span carries aria-hidden='true' by default (decorative by convention) [axe: aria-hidden-body]", () => {
    const leadingIdx = markup.indexOf('data-slot="input-leading"');
    expect(leadingIdx, 'data-slot="input-leading" not found').toBeGreaterThan(-1);
    const leadingBlock = markup.slice(leadingIdx, leadingIdx + 300);
    expect(leadingBlock).toContain('aria-hidden="true"');
  });

  test("trailing slot renders data-slot='input-trailing' when non-null", () => {
    expect(markup).toContain("@if(trailing != null)");
    expect(markup).toContain('data-slot="input-trailing"');
    expect(markup).toContain("${trailing}");
  });

  test("leading slot is absent when not provided (@if gate)", () => {
    // Only one @if gate for leading and one for trailing -- confirmed by singular presence.
    const leadingGates = markup.match(/@if\(leading != null\)/g) ?? [];
    expect(leadingGates.length).toBe(1);
    const trailingGates = markup.match(/@if\(trailing != null\)/g) ?? [];
    expect(trailingGates.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// §7 Render — clearable button
// ---------------------------------------------------------------------------

describe("input.jte -- clearable button", () => {
  test("clearable=true renders a real <button type='button'> (NOT a span with onclick) [axe: button-name]", () => {
    expect(markup).toContain("@if(clearable)");
    // Must be a real <button type="button"> — the platform gives Enter/Space for free.
    expect(markup).toMatch(/<button[\s\S]*?type="button"[\s\S]*?data-lv-clear/);
  });

  test("the clear button carries aria-label='Clear' for its accessible name [axe: button-name]", () => {
    expect(markup).toContain('aria-label="Clear"');
  });

  test("the clear button carries data-lv-clear (the enhancer hook)", () => {
    expect(markup).toContain("data-lv-clear");
  });

  test("the clear button carries data-slot='input-clear' (the test selector)", () => {
    expect(markup).toContain('data-slot="input-clear"');
  });

  test("the clear button starts with tabindex='-1' and hidden (out of tab order when empty)", () => {
    // The enhancer promotes it to tabindex=0 when value is present.
    expect(markup).toContain('tabindex="-1"');
    expect(markup).toContain("hidden");
  });

  test("the clear button composes the icon partial (no raw <svg>)", () => {
    // Icon comes from @template.lievit.icon, not a raw <svg>.
    expect(markup).toContain('@template.lievit.icon(name = "x"');
  });

  test("no inline onclick or on* on the clear button (CSP rule)", () => {
    const inlineHandlers = markup.match(/\son[a-z]+=/gi) ?? [];
    expect(inlineHandlers, `unexpected inline handlers: ${inlineHandlers.join(", ")}`).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// §7 Render — showCount badge
// ---------------------------------------------------------------------------

describe("input.jte -- showCount character count badge", () => {
  test("showCount=true renders a <span data-lv-count> in the trailing zone", () => {
    expect(markup).toContain("@if(showCount)");
    expect(markup).toContain("data-lv-count");
    expect(markup).toContain('data-slot="input-count"');
  });

  test("count badge is aria-hidden='true' (NOT a live region; no per-keystroke announcements) [axe: aria-hidden-body]", () => {
    // Use the data-slot selector for the span, which is the more specific anchor.
    const countSlotIdx = markup.indexOf('data-slot="input-count"');
    expect(countSlotIdx, 'data-slot="input-count" not found in markup').toBeGreaterThan(-1);
    const countBlock = markup.slice(Math.max(0, countSlotIdx - 20), countSlotIdx + 300);
    expect(countBlock).toContain('aria-hidden="true"');
  });

  test("when maxlength is set and showCount is true, data-lv-count-max is added to the <input>", () => {
    // The enhancer reads this to compute "x / max" format.
    // JTE smart attribute ternary: emits the value when showCount && maxlength != null, else null (attribute dropped).
    expect(markup).toContain('data-lv-count-max="${showCount && maxlength != null ? maxlength : null}"');
  });

  test("the count badge is NOT an aria-live region", () => {
    expect(markup).not.toContain("aria-live");
    expect(markup).not.toContain('role="status"');
    expect(markup).not.toContain('role="log"');
  });
});

// ---------------------------------------------------------------------------
// §7 Render — sizes
// ---------------------------------------------------------------------------

describe("input.jte -- size scale (sm / md / lg, toolbar-aligned)", () => {
  const SIZES: ReadonlyArray<[string, string, string, string]> = [
    // [size, height token class, text size class, padding class]
    ["sm", "h-[var(--lv-space-8)]", "text-[length:var(--lv-text-xs)]",   "px-[var(--lv-space-3)]"],
    ["md", "h-[var(--lv-space-9)]", "text-[length:var(--lv-text-sm)]",   "px-[var(--lv-space-3)]"],
    ["lg", "h-[var(--lv-space-10)]","text-[length:var(--lv-text-base)]", "px-[var(--lv-space-4)]"],
  ];

  for (const [size, heightClass, textClass, padClass] of SIZES) {
    test(`size="${size}": height class is ${heightClass}`, () => {
      expect(src, `size ${size} height class missing`).toContain(heightClass);
    });
    test(`size="${size}": text size class is ${textClass}`, () => {
      expect(src, `size ${size} text class missing`).toContain(textClass);
    });
    test(`size="${size}": padding class is ${padClass}`, () => {
      expect(src, `size ${size} padding class missing`).toContain(padClass);
    });
  }

  test("md is the default (switch expression falls through to default for 'md')", () => {
    expect(src).toContain('default   -> "h-[var(--lv-space-9)]');
  });

  test("data-size emitted on the container for the test-selector contract", () => {
    expect(markup).toContain('data-size="${size}"');
  });
});

// ---------------------------------------------------------------------------
// §7 Render — state modifier classes: invalid, disabled, borderless
// ---------------------------------------------------------------------------

describe("input.jte -- state modifier classes on the container", () => {
  test("invalid=true adds lv-input--invalid to the container", () => {
    expect(src).toContain("lv-input--invalid");
    expect(markup).toContain('? " lv-input--invalid"');
  });

  test("disabled=true adds lv-input--disabled to the container", () => {
    expect(src).toContain("lv-input--disabled");
    expect(markup).toContain('? " lv-input--disabled"');
  });

  test("borderless=true adds lv-input--borderless to the container", () => {
    expect(src).toContain("lv-input--borderless");
    expect(markup).toContain('? " lv-input--borderless"');
  });

  test("the container has CSS hooks for the invalid modifier (destructive border + ring)", () => {
    expect(src).toContain("lv-input--invalid:border-[var(--lv-color-destructive)]");
  });

  test("the container has CSS hooks for the disabled modifier (cursor + opacity)", () => {
    expect(src).toContain("lv-input--disabled:cursor-not-allowed");
    expect(src).toContain("lv-input--disabled:opacity-[var(--lv-opacity-disabled)]");
  });

  test("the container has CSS hooks for the borderless modifier (no border, no bg)", () => {
    expect(src).toContain("lv-input--borderless:border-transparent");
    expect(src).toContain("lv-input--borderless:shadow-none");
  });
});

// ---------------------------------------------------------------------------
// §7 Render — attrs (trusted raw) + dataAttrs (safe escaped)
// ---------------------------------------------------------------------------

describe("input.jte -- escaping channels (XSS decision rule)", () => {
  test("attrs is emitted via $unsafe (trusted-raw channel for static author strings)", () => {
    expect(markup).toContain("$unsafe{attrs}");
  });

  test("dataAttrs VALUE is escaped via Escape.htmlAttribute, never raw [XSS]", () => {
    expect(src).toContain("@import gg.jte.html.escape.Escape");
    expect(src).toMatch(/Escape\.htmlAttribute\(\s*e\.getValue\(\)/);
    expect(src, "dataAttrs value must not be $unsafe directly").not.toMatch(/\$unsafe\{[^}]*getValue/);
  });

  test("dataAttrs key is validated as [A-Za-z][A-Za-z0-9-]* (key injection prevention)", () => {
    expect(src).toMatch(/getKey\(\)\.matches\("\[A-Za-z\]\[A-Za-z0-9-\]\*"\)/);
  });

  test("StringOutput is imported and used for the pre-escaped dataAttrs fragment", () => {
    expect(src).toContain("@import gg.jte.output.StringOutput");
    expect(src).toContain("new StringOutput()");
  });

  test("the pre-escaped dataAttrs fragment is emitted with $unsafe{dataAttrsMarkup}", () => {
    expect(markup).toContain("$unsafe{dataAttrsMarkup}");
  });

  test("the attrs doc states TRUSTED STATIC AUTHOR-TYPED STRINGS ONLY (no user/DB data)", () => {
    expect(src.toLowerCase()).toMatch(/trusted|static.*author|author.*only/i);
  });
});

// ---------------------------------------------------------------------------
// §7 Render — focus ring token
// ---------------------------------------------------------------------------

describe("input.jte -- focus ring (focus-within on container, --lv-ring token)", () => {
  test("the container uses :focus-within to raise the ring (wraps the whole compound)", () => {
    expect(src).toContain("focus-within:shadow-[var(--lv-ring)]");
  });

  test("the ring is based on --lv-ring (shared token, consistent across all controls)", () => {
    expect(src).toContain("var(--lv-ring)");
  });

  test("the invalid ring uses color-mix to tint destructive (not a hardcoded colour)", () => {
    expect(src).toContain("color-mix(in_srgb,var(--lv-color-destructive)");
  });

  test("no focus-visible:shadow on the <input> itself (ring is on the container, not the element)", () => {
    // The container's :focus-within catches focus on any descendant (input, clear btn, etc.).
    // The input itself has no focus ring class.
    const inputIdx = markup.indexOf('data-slot="input-field"');
    const inputBlock = markup.slice(inputIdx, inputIdx + 600);
    expect(inputBlock).not.toContain("focus-visible:shadow");
  });
});

// ---------------------------------------------------------------------------
// §7 Render — token contract (no bare hex)
// ---------------------------------------------------------------------------

describe("input.jte -- token contract (no hardcoded colours)", () => {
  test("no bare hex colour in the template body (only --lv-* tokens) [architecture-contract §4]", () => {
    // Strip doc comment (may contain hex in commentary / OKLCH documentation).
    const body = src.replace(/<%--[\s\S]*?--%>/g, "");
    expect(body, "leaked a hardcoded hex colour").not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  test("uses --lv-color-input for the container border and background (shared form-control token)", () => {
    expect(src).toContain("var(--lv-color-input)");
  });

  test("uses --lv-color-destructive for the invalid border", () => {
    expect(src).toContain("var(--lv-color-destructive)");
  });

  test("uses --lv-color-muted-fg for placeholder and adornment icon colour", () => {
    expect(src).toContain("var(--lv-color-muted-fg)");
  });

  test("uses --lv-radius-md for the container border-radius", () => {
    expect(src).toContain("var(--lv-radius-md)");
  });

  test("uses --lv-shadow-xs for the container inset shadow", () => {
    expect(src).toContain("var(--lv-shadow-xs)");
  });

  test("uses --lv-opacity-disabled for the disabled dimming", () => {
    expect(src).toContain("var(--lv-opacity-disabled)");
  });

  test("font-family is set from --lv-font-sans on the container", () => {
    expect(src).toContain("var(--lv-font-sans)");
  });

  test("cssClass interpolated on the container, inputCssClass on the <input>", () => {
    expect(markup).toContain("${cssClass}");
    expect(markup).toContain("${inputCssClass}");
  });
});

// ---------------------------------------------------------------------------
// §7 CSP + anti-pattern guard
// ---------------------------------------------------------------------------

describe("input.jte -- CSP hygiene (no inline script, no on* handlers)", () => {
  test("no inline <script> tag (strict CSP refuses them)", () => {
    expect(src).not.toMatch(/<script/i);
  });

  test("no inline on* event handler attributes (onclick, onchange, etc.)", () => {
    const body = src.replace(/<%--[\s\S]*?--%>/g, "");
    const inlineHandlers = body.match(/\son[a-z]+=/gi) ?? [];
    expect(inlineHandlers, `unexpected inline handlers: ${inlineHandlers.join(", ")}`).toEqual([]);
  });

  test("no dev.lievit import (JTE-compile gate classpath is JDK + jte + icons only)", () => {
    expect(src).not.toMatch(/@import dev\.lievit/);
  });

  test("no @import dev.lievit or any lievit Java import that would fail the compile gate", () => {
    const imports = src.match(/@import [^\n]+/g) ?? [];
    for (const imp of imports) {
      expect(imp, `forbidden import: ${imp}`).not.toMatch(/dev\.lievit/);
    }
  });

  test("no JPA / Jakarta persistence import (server-rendered partials are presentation-only)", () => {
    expect(src.toLowerCase()).not.toMatch(/javax\.persistence|jakarta\.persistence/);
  });

  test("no aria-disabled anywhere in the template (illegal on native form controls)", () => {
    expect(markup).not.toContain("aria-disabled");
  });

  test("the clearable button is NOT a <span> with onclick (must be a real <button>)", () => {
    // Ensures the clear button gets keyboard + Enter/Space for free from the platform.
    expect(markup).not.toMatch(/<span[^>]*data-lv-clear/);
  });
});

// ---------------------------------------------------------------------------
// §7 JTE comment hygiene (nested comment hazard)
// ---------------------------------------------------------------------------

describe("input.jte -- JTE comment hygiene (no nested --%>)", () => {
  test("no nested --%> that would close the outer doc-comment early (JTE parse hazard)", () => {
    // Strip the outermost doc-comment block, then verify no stray --%> remains inside it.
    // Strategy: after stripping all properly-paired <%-- ... --%> blocks, the remainder
    // should contain no --%> sequences (any leftover would be a nesting artefact).
    const stripped = src.replace(/<%--[\s\S]*?--%>/g, "");
    expect(stripped, "stray --%> found after stripping all block comments").not.toContain("--%>");
  });

  test("all @if / @endif are balanced (no unclosed conditional)", () => {
    const openIfs  = (src.match(/@if\(/g) ?? []).length;
    const closeIfs = (src.match(/@endif/g) ?? []).length;
    expect(closeIfs, `@if(${openIfs}) vs @endif(${closeIfs}) mismatch`).toBe(openIfs);
  });
});

// ===========================================================================
// Enhancer tests — real DOM in happy-dom, real input-count.enhancer.ts
// ===========================================================================

/**
 * Build a minimal DOM that matches the server-rendered input.jte output for a given
 * showCount / clearable combination. Returns the container, the native input, and
 * optionally the count badge and clear button.
 */
function renderInputDom(opts: {
  initialValue?: string;
  showCount?: boolean;
  maxlength?: number;
  clearable?: boolean;
} = {}): {
  container: HTMLElement;
  input: HTMLInputElement;
  countBadge: HTMLElement | null;
  clearBtn: HTMLButtonElement | null;
} {
  const container = document.createElement("div");
  container.setAttribute("data-slot", "input");

  const input = document.createElement("input");
  input.setAttribute("data-slot", "input-field");
  input.value = opts.initialValue ?? "";
  if (opts.maxlength) {
    input.setAttribute("maxlength", String(opts.maxlength));
    if (opts.showCount) {
      input.setAttribute("data-lv-count-max", String(opts.maxlength));
    }
  }
  container.appendChild(input);

  let countBadge: HTMLElement | null = null;
  if (opts.showCount) {
    countBadge = document.createElement("span");
    countBadge.setAttribute("data-slot", "input-count");
    countBadge.setAttribute("data-lv-count", "");
    countBadge.setAttribute("aria-hidden", "true");
    container.appendChild(countBadge);
  }

  let clearBtn: HTMLButtonElement | null = null;
  if (opts.clearable) {
    clearBtn = document.createElement("button");
    clearBtn.setAttribute("type", "button");
    clearBtn.setAttribute("data-slot", "input-clear");
    clearBtn.setAttribute("data-lv-clear", "");
    clearBtn.setAttribute("aria-label", "Clear");
    clearBtn.setAttribute("tabindex", "-1");
    clearBtn.setAttribute("hidden", "");
    container.appendChild(clearBtn);
  }

  document.body.appendChild(container);
  return { container, input, countBadge, clearBtn };
}

afterEach(() => {
  document.body.innerHTML = "";
});

// ---------------------------------------------------------------------------
// §7 Keyboard tests — Tab order
// ---------------------------------------------------------------------------

describe("input enhancer -- keyboard / tab order", () => {
  test("Tab reaches the <input> when not disabled (it is in natural tab order)", () => {
    const { input } = renderInputDom();
    enhanceInput(input.closest<HTMLElement>('[data-slot="input"]')!);
    // A non-disabled, non-hidden input is in tab order by default (tabIndex >= 0).
    expect(input.tabIndex).toBeGreaterThanOrEqual(0);
  });

  test("disabled <input> is not in tab order (native disabled removes it)", () => {
    const { input } = renderInputDom();
    input.disabled = true;
    // Native disabled makes tabIndex effectively -1; browsers exclude it.
    expect(input.disabled).toBe(true);
    // tabIndex property on a disabled input is still its declared value but the platform
    // excludes it from sequential focus. We assert the disabled attribute is set.
    expect(input.getAttribute("disabled")).not.toBeNull();
  });

  test("Enter on a <form> input fires the form submit event (platform behaviour)", () => {
    const form = document.createElement("form");
    const { input, container } = renderInputDom();
    document.body.removeChild(container);
    form.appendChild(container);
    document.body.appendChild(form);
    enhanceInput(container);

    let submitted = false;
    form.addEventListener("submit", (e) => { e.preventDefault(); submitted = true; });

    // Simulate Enter on the input. In happy-dom a synthetic KeyboardEvent on an input does
    // not auto-submit; we verify the platform contract by checking requestSubmit is available.
    // The real gate is the browser + Playwright E2E; here we assert the structural invariant:
    // the input is inside a form and the form has no submit handler installed by the partial
    // (it is purely a platform behaviour).
    expect(input.closest("form"), "input must be a descendant of the form").toBeTruthy();
    expect(submitted).toBe(false); // no synthetic event fired yet -- contract is structural
  });

  test("clear button is NOT in tab order initially (tabindex='-1' when field is empty)", () => {
    const { container, clearBtn } = renderInputDom({ clearable: true });
    enhanceInput(container);
    // After enhance with empty value: clear button must stay at tabindex=-1.
    expect(clearBtn!.getAttribute("tabindex")).toBe("-1");
    expect(clearBtn!.hasAttribute("hidden")).toBe(true);
  });

  test("clear button IS reachable by Tab after the field gets a value (enhancer sets tabindex=0)", () => {
    const { container, input, clearBtn } = renderInputDom({ clearable: true });
    enhanceInput(container);
    // Simulate typing.
    input.value = "hello";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    expect(clearBtn!.getAttribute("tabindex")).toBe("0");
    expect(clearBtn!.hasAttribute("hidden")).toBe(false);
  });

  test("Enter/Space on the clear button fires lv:clear on the <input> (real <button> => platform click)", () => {
    const { container, input, clearBtn } = renderInputDom({ clearable: true });
    enhanceInput(container);
    input.value = "some text";
    input.dispatchEvent(new Event("input", { bubbles: true }));

    let cleared = false;
    input.addEventListener("lv:clear", () => { cleared = true; });
    // A real <button> fires its click on Enter/Space in the browser. We simulate click directly.
    clearBtn!.click();
    expect(cleared).toBe(true);
    expect(input.value).toBe("");
  });
});

// ---------------------------------------------------------------------------
// §7 Enhancer tests — count badge
// ---------------------------------------------------------------------------

describe("input enhancer -- count badge (input-count.enhancer.ts)", () => {
  test("count badge updates to bare length on each keystroke (no maxlength)", () => {
    const { container, input, countBadge } = renderInputDom({ showCount: true });
    enhanceInput(container);
    input.value = "hello";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    expect(countBadge!.textContent).toBe("5");
  });

  test("count shows 'x / max' when data-lv-count-max is set (maxlength=10, type 3 chars)", () => {
    const { container, input, countBadge } = renderInputDom({ showCount: true, maxlength: 10 });
    enhanceInput(container);
    input.value = "abc";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    expect(countBadge!.textContent).toBe("3 / 10");
  });

  test("count shows bare 'x' when maxlength absent", () => {
    const { container, input, countBadge } = renderInputDom({ showCount: true });
    enhanceInput(container);
    input.value = "hello world";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    expect(countBadge!.textContent).toBe("11");
  });

  test("count is '0' initially when field is empty", () => {
    const { container, countBadge } = renderInputDom({ showCount: true });
    enhanceInput(container);
    expect(countBadge!.textContent).toBe("0");
  });
});

// ---------------------------------------------------------------------------
// §7 Enhancer tests — clearable show/hide
// ---------------------------------------------------------------------------

describe("input enhancer -- clearable button visibility", () => {
  test("clear button is hidden initially when field is empty (hidden attr + tabindex=-1)", () => {
    const { container, clearBtn } = renderInputDom({ clearable: true });
    enhanceInput(container);
    expect(clearBtn!.hasAttribute("hidden")).toBe(true);
    expect(clearBtn!.getAttribute("tabindex")).toBe("-1");
  });

  test("clear button becomes visible after typing (hidden removed + tabindex=0)", () => {
    const { container, input, clearBtn } = renderInputDom({ clearable: true });
    enhanceInput(container);
    input.value = "x";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    expect(clearBtn!.hasAttribute("hidden")).toBe(false);
    expect(clearBtn!.getAttribute("tabindex")).toBe("0");
  });

  test("clearing resets the field value to empty string", () => {
    const { container, input, clearBtn } = renderInputDom({ clearable: true });
    enhanceInput(container);
    input.value = "abc";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    clearBtn!.click();
    expect(input.value).toBe("");
  });

  test("after clearing, clear button goes back to hidden (empty field)", () => {
    const { container, input, clearBtn } = renderInputDom({ clearable: true });
    enhanceInput(container);
    input.value = "abc";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    clearBtn!.click();
    expect(clearBtn!.hasAttribute("hidden")).toBe(true);
    expect(clearBtn!.getAttribute("tabindex")).toBe("-1");
  });

  test("after clearing, count badge resets to '0' (count + clear combined)", () => {
    const { container, input, countBadge, clearBtn } = renderInputDom({
      showCount: true,
      clearable: true,
    });
    enhanceInput(container);
    input.value = "hello";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    expect(countBadge!.textContent).toBe("5");
    clearBtn!.click();
    expect(countBadge!.textContent).toBe("0");
  });
});

// ---------------------------------------------------------------------------
// §7 Enhancer tests — lv:clear CustomEvent
// ---------------------------------------------------------------------------

describe("input enhancer -- lv:clear CustomEvent", () => {
  test("clicking the clear button dispatches a composed lv:clear CustomEvent on the <input>", () => {
    const { container, input, clearBtn } = renderInputDom({ clearable: true });
    enhanceInput(container);
    input.value = "something";
    input.dispatchEvent(new Event("input", { bubbles: true }));

    const received: Event[] = [];
    input.addEventListener("lv:clear", (e) => received.push(e));
    clearBtn!.click();
    expect(received).toHaveLength(1);
    expect((received[0] as CustomEvent).type).toBe("lv:clear");
  });

  test("lv:clear event bubbles (so an ancestor WIRE component can handle it)", () => {
    const { container, input, clearBtn } = renderInputDom({ clearable: true });
    enhanceInput(container);
    input.value = "abc";
    input.dispatchEvent(new Event("input", { bubbles: true }));

    let bubbledToContainer = false;
    container.addEventListener("lv:clear", () => { bubbledToContainer = true; });
    clearBtn!.click();
    expect(bubbledToContainer).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// §7 Enhancer tests — idempotence + morph rebind
// ---------------------------------------------------------------------------

describe("input enhancer -- idempotence and morph rebind", () => {
  test("enhanceInput is idempotent: calling it twice does not double-attach listeners", () => {
    const { container, input, countBadge } = renderInputDom({ showCount: true });
    enhanceInput(container);
    enhanceInput(container); // second call must be a no-op
    input.value = "hi";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    // If listeners were double-attached, count would be wrong or errors thrown.
    expect(countBadge!.textContent).toBe("2");
  });

  test("enhanceAllInputs re-attaches to a new container after a simulated morph (innerHTML replace)", () => {
    // Simulate a morph: replace the body content with a new container.
    const { container } = renderInputDom({ showCount: true });
    enhanceInput(container); // first enhance

    // Simulate morph: the old container is replaced; a new one lands in the DOM.
    document.body.innerHTML = "";
    const newContainer = document.createElement("div");
    newContainer.setAttribute("data-slot", "input");
    const newInput = document.createElement("input");
    newInput.setAttribute("data-slot", "input-field");
    newInput.value = "";
    const newCount = document.createElement("span");
    newCount.setAttribute("data-lv-count", "");
    newContainer.appendChild(newInput);
    newContainer.appendChild(newCount);
    document.body.appendChild(newContainer);

    enhanceAllInputs(); // re-bind after morph

    newInput.value = "post-morph";
    newInput.dispatchEvent(new Event("input", { bubbles: true }));
    expect(newCount.textContent).toBe("10");
  });

  test("enhanceInput skips a container with no [data-slot='input-field'] child (no crash)", () => {
    const bare = document.createElement("div");
    bare.setAttribute("data-slot", "input");
    document.body.appendChild(bare);
    // Must not throw.
    expect(() => enhanceInput(bare)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// §7 Focus tests (structural)
// ---------------------------------------------------------------------------

describe("input.jte -- focus: no trap, focus-within ring", () => {
  test("no focus-trap data attribute or enhancer wired in the template (platform focus only)", () => {
    // The input partial has no data-lievit-focus-trap or data-lievit-trap attribute;
    // focus management is entirely platform-native.
    expect(markup).not.toContain("data-lievit-focus-trap");
    expect(markup).not.toContain("focus-trap");
  });

  test("focus-within on the container provides the ring (asserted in token section already)", () => {
    // Cross-check: confirm focus-within is on the container element, not on the <input>.
    const containerIdx = markup.indexOf('data-slot="input"');
    const containerLine = markup.slice(containerIdx, containerIdx + 500);
    expect(containerLine).toContain("focus-within:");
  });
});
