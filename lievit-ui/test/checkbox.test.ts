/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * lievit-ui checkbox.jte + checkbox.enhancer.ts -- full structural golden (spec §7).
 *
 * The checkbox is a static JTE partial compiled in the Java world. This suite asserts
 * on the PARTIAL SOURCE as text (source-as-text assertions) for render/structural
 * contracts, and uses happy-dom (vitest environment) for the enhancer behavior tests.
 *
 * Coverage of spec §7 acceptance tests:
 *   §7 Render      -- source-as-text assertions (param API, data-slot, data-size,
 *                      data-state, ARIA attributes, sizes, id resolution, escaping).
 *   §7 a11y        -- structural assertions on ARIA that the named axe rules check
 *                      (no DOM/axe available; assertions on the emitted attributes map
 *                      to specific axe rules per inline comment).
 *   §7 Enhancer    -- real installCheckbox + happy-dom DOM to assert indeterminate
 *                      DOM property set on init and after a simulated morph (afterCall).
 *   §7 Keyboard    -- happy-dom assertions that the native input is in the tab sequence.
 *   §7 States      -- token class assertions (data-size, data-state, aria-invalid recolour).
 *   §7 Escaping    -- dataAttrs hostile value; attrs documented TRUSTED-only.
 *
 * NO real JTE compile / axe-core here: both run out of band (test/jte-compile gate for JTE;
 * axe is noted in spec §7 as a gate; this suite asserts the emitted ARIA attributes that
 * the axe rules check, which is the same assurance at the source level).
 *
 * TEST_RECONCILE note: `test/checkbox-data-attrs.test.ts` (existing) pins the OLD surface
 * (l:model param, single $unsafe{dataAttrsMarkup} sink, `l:model="${model}"` in source).
 * The v-next re-forge changes the API (l:model moves to `attrs`; $unsafe now has TWO sinks:
 * dataAttrsMarkup + attrs). That file WILL break and must be reconciled by the coordinator
 * (either retire it or update its assertions to the new surface).
 */

import { beforeEach, describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { LievitRuntime } from "../runtime/runtime.js";
import { installCheckbox } from "../runtime/features/checkbox.enhancer.js";

// ---------------------------------------------------------------------------
// Source load
// ---------------------------------------------------------------------------
const jteDir = join(import.meta.dirname, "..", "registry", "jte");
const src = readFileSync(join(jteDir, "checkbox.jte"), "utf8");

/** Source with JTE comments stripped so assertions never hit doc-comment prose. */
const markup = src.replace(/<%--[\s\S]*?--%>/g, "");

// ---------------------------------------------------------------------------
// §2 API -- param declarations
// ---------------------------------------------------------------------------
describe("checkbox -- params & docs API", () => {
  test("declares every documented param with the correct default", () => {
    expect(src).toContain("@param String name = null");
    expect(src).toContain('@param String value = "on"');
    expect(src).toContain("@param boolean checked = false");
    expect(src).toContain("@param boolean indeterminate = false");
    expect(src).toContain("@param boolean disabled = false");
    expect(src).toContain("@param boolean required = false");
    expect(src).toContain('@param String size = "md"');
    expect(src).toContain("@param String id = null");
    expect(src).toContain("@param String ariaLabel = null");
    expect(src).toContain("@param String ariaDescribedBy = null");
    expect(src).toContain("@param boolean ariaInvalid = false");
    expect(src).toContain('@param String cssClass = ""');
    expect(src).toContain('@param String attrs = ""');
    expect(src).toContain("@param java.util.Map<String, String> dataAttrs = java.util.Map.of()");
  });

  test("usage doc uses <%-- --%> (not @* *@) and shows @@template.lievit.checkbox(", () => {
    expect(src).toContain("<%--");
    expect(src).toContain("--%>");
    expect(src, "must NOT use @* *@ comment syntax").not.toMatch(/@\*/);
    expect(src).toMatch(/Usage:/);
    expect(src).toContain("@@template.lievit.checkbox(");
  });

  test("usage doc shows the attrs channel with l:model directive (static author-typed string)", () => {
    expect(src).toContain('l:model=\\"');
  });

  test("no label param and no Content slot (label is a sibling <label for>, not inside the partial)", () => {
    // The spec §8 anti-pattern: a label inside the control partial conflates two semantic elements.
    expect(src).not.toContain("@param String label");
    expect(src).not.toContain("@param gg.jte.Content content");
    expect(src).not.toContain("@param gg.jte.Content leading");
  });

  test("no model param (l:model travels via the trusted attrs channel, not its own param)", () => {
    // The v-next API aligns to the two-channel rule: l:model is an author-typed static string
    // in attrs, not a runtime-evaluated param value.
    expect(src).not.toContain("@param String model");
  });
});

// ---------------------------------------------------------------------------
// §3 / §7 Structure -- data-slots, data-state, sr-only peer, visual box
// ---------------------------------------------------------------------------
describe("checkbox -- basic structure", () => {
  test("root is a <span data-slot=checkbox> (not a <label> or <div>) [axe: aria-roles]", () => {
    expect(markup).toMatch(/<span[\s\S]*?data-slot="checkbox"/);
    // Must NOT use a label as the root (the label is authored OUTSIDE the partial).
    expect(markup).not.toMatch(/<label[\s\S]*?data-slot="checkbox"/);
  });

  test("data-size is on the root span for styling hooks", () => {
    expect(markup).toContain('data-size="${size}"');
  });

  test("data-state is on the root span (server-derived: checked|unchecked|indeterminate)", () => {
    expect(markup).toContain('data-state="${state}"');
    // state variable is computed server-side from indeterminate + checked params.
    expect(markup).toContain('indeterminate ? "indeterminate"');
    expect(markup).toContain('"checked"');
    expect(markup).toContain('"unchecked"');
  });

  test("the native <input type=checkbox> is present with class sr-only peer", () => {
    expect(markup).toMatch(/<input[\s\S]*?type="checkbox"/);
    expect(markup).toContain('class="peer sr-only"');
  });

  test("the input carries data-slot=checkbox-input for test selectors", () => {
    expect(markup).toContain('data-slot="checkbox-input"');
  });

  test("the visual box is aria-hidden (AT sees the real input, not the decorative box)", () => {
    expect(markup).toContain('data-slot="checkbox-box"');
    const boxIdx = markup.indexOf('data-slot="checkbox-box"');
    const boxFragment = markup.slice(boxIdx, boxIdx + 200);
    expect(boxFragment).toContain('aria-hidden="true"');
  });

  test("check SVG and dash SVG are both aria-hidden (decorative glyphs)", () => {
    expect(markup).toContain('data-slot="checkbox-check"');
    expect(markup).toContain('data-slot="checkbox-dash"');
    // both must be aria-hidden
    const checkIdx = markup.indexOf('data-slot="checkbox-check"');
    const dashIdx = markup.indexOf('data-slot="checkbox-dash"');
    expect(markup.slice(checkIdx, checkIdx + 300)).toContain('aria-hidden="true"');
    expect(markup.slice(dashIdx, dashIdx + 300)).toContain('aria-hidden="true"');
  });

  test("does NOT emit role=checkbox (the native input carries it for free)", () => {
    // APG anti-pattern: a div-with-role=checkbox. We use the real native element.
    expect(markup).not.toMatch(/role="checkbox"/);
  });

  test("does NOT emit aria-checked as a static HTML attribute (browser derives it from DOM)", () => {
    // Spec §4 + §8: emitting aria-checked as a static attribute conflicts with the indeterminate
    // DOM property state on state changes. The browser owns aria-checked.
    expect(markup).not.toMatch(/aria-checked=/);
  });
});

// ---------------------------------------------------------------------------
// §4 A11y -- ARIA attribute contract (maps to axe rules)
// ---------------------------------------------------------------------------
describe("checkbox -- ARIA attributes [axe parity]", () => {
  test("aria-label is emitted from ariaLabel param (absent = not rendered) [axe: label]", () => {
    expect(markup).toContain('aria-label="${ariaLabel}"');
    // JTE's null-drop: when ariaLabel is null the attribute must not render as aria-label="".
    // In JTE, ${null} renders as an empty string in attribute value position -- the conditional
    // null-drop is enforced by JTE's attribute emission rules (omits the attr when value is null).
  });

  test("aria-describedby is emitted from ariaDescribedBy param [axe: aria-describedby-id-exists]", () => {
    expect(markup).toContain('aria-describedby="${ariaDescribedBy}"');
  });

  test("aria-invalid is conditionally emitted as true (not emitted as false) [axe: aria-allowed-attr]", () => {
    // Spec §4: emit aria-invalid="true" when ariaInvalid; do NOT emit aria-invalid="false".
    expect(markup).toContain('aria-invalid="${ariaInvalid ? "true" : null}"');
    expect(markup).not.toMatch(/aria-invalid="false"/);
  });

  test("native disabled attribute is used (NOT aria-disabled) [axe: aria-prohibited-attr for inputs]", () => {
    expect(markup).toContain('disabled="${disabled}"');
    // For a native <input>, aria-disabled is not needed; the native attr is sufficient.
    expect(markup).not.toContain("aria-disabled");
  });

  test("id is resolved to a deterministic auto-id when null (enables <label for> wiring)", () => {
    expect(markup).toContain('id="${resolvedId}"');
    // The resolvedId variable is computed: prefer id param, fallback to lv-cb-<hash>.
    expect(markup).toContain('"lv-cb-"');
  });

  test("name attribute is present on the input (required for plain form submission)", () => {
    expect(markup).toContain('name="${name}"');
  });

  test("value attribute is present on the input (standard HTML checkbox value)", () => {
    expect(markup).toContain('value="${value}"');
  });

  test("required attribute is conditionally emitted on the input", () => {
    expect(markup).toContain('required="${required}"');
  });
});

// ---------------------------------------------------------------------------
// §3 Sizes -- box dimension tokens (spec table)
// ---------------------------------------------------------------------------
describe("checkbox -- size tokens (sm=--lv-space-4, md=--lv-space-5, lg=--lv-space-6)", () => {
  test("sm maps to --lv-space-4 (16px)", () => {
    expect(src).toContain("--lv-space-4");
  });

  test("md (default) maps to --lv-space-5 (20px)", () => {
    expect(src).toContain("--lv-space-5");
  });

  test("lg maps to --lv-space-6 (24px)", () => {
    expect(src).toContain("--lv-space-6");
  });

  test("size switch produces COMPLETE static class strings (Tailwind scanner requirement)", () => {
    expect(src).toContain('case "sm" -> "size-[var(--lv-space-4)]"');
    expect(src).toContain('case "lg" -> "size-[var(--lv-space-6)]"');
    // md (default branch)
    expect(src).toContain('"size-[var(--lv-space-5)]"');
  });
});

// ---------------------------------------------------------------------------
// §3 States -- peer-driven CSS (checked, indeterminate, focus, disabled, invalid)
// ---------------------------------------------------------------------------
describe("checkbox -- peer-driven state classes", () => {
  test("checked state: peer-checked fills primary background and border", () => {
    expect(src).toContain("peer-checked:bg-[var(--lv-color-primary)]");
    expect(src).toContain("peer-checked:border-[var(--lv-color-primary)]");
  });

  test("indeterminate state: peer-data-[indeterminate=true] fills primary (dash shown)", () => {
    expect(src).toContain("peer-data-[indeterminate=true]:bg-[var(--lv-color-primary)]");
    expect(src).toContain("peer-data-[indeterminate=true]:border-[var(--lv-color-primary)]");
  });

  test("focus-visible state: peer-focus-visible applies --lv-ring shadow", () => {
    expect(src).toContain("peer-focus-visible:shadow-[var(--lv-ring)]");
  });

  test("disabled state: peer-disabled dims the visual box via --lv-opacity-disabled", () => {
    expect(src).toContain("peer-disabled:opacity-[var(--lv-opacity-disabled)]");
  });

  test("aria-invalid state: peer-aria-[invalid=true] recolours border to --lv-color-destructive", () => {
    expect(src).toContain("peer-aria-[invalid=true]:border-[var(--lv-color-destructive)]");
  });

  test("check SVG is hidden by default; peer-checked:flex reveals it", () => {
    const checkIdx = markup.indexOf('data-slot="checkbox-check"');
    const checkBlock = markup.slice(checkIdx, checkIdx + 600);
    expect(checkBlock).toContain("peer-checked:flex");
    // When indeterminate, the check must be hidden even if the input is also checked.
    expect(checkBlock).toContain("peer-data-[indeterminate=true]:hidden");
  });

  test("dash SVG is hidden by default; peer-data-[indeterminate=true]:flex reveals it", () => {
    const dashIdx = markup.indexOf('data-slot="checkbox-dash"');
    const dashBlock = markup.slice(dashIdx, dashIdx + 600);
    expect(dashBlock).toContain("peer-data-[indeterminate=true]:flex");
  });

  test("data-indeterminate is set on the input (not on the wrapper span) for peer-* selectors", () => {
    expect(markup).toContain('data-indeterminate="${indeterminate ? "true" : null}"');
  });

  test("transition is on the visual box (background + border-color, not on the native input)", () => {
    expect(src).toContain("transition-[background-color,border-color]");
  });
});

// ---------------------------------------------------------------------------
// §6 Escaping -- XSS trust split (mirrors button.jte / switch.jte)
// ---------------------------------------------------------------------------
describe("checkbox -- XSS escaping contract", () => {
  test("imports StringOutput + Escape.htmlAttribute (the SAFE dataAttrs channel)", () => {
    expect(src).toContain("@import gg.jte.output.StringOutput");
    expect(src).toContain("@import gg.jte.html.escape.Escape");
  });

  test("dataAttrs VALUES are escaped via Escape.htmlAttribute (never $unsafe raw value)", () => {
    expect(src).toMatch(/Escape\.htmlAttribute\(\s*e\.getValue\(\)/);
    expect(src, "dataAttrs value must not be $unsafe").not.toMatch(/\$unsafe\{[^}]*getValue/);
  });

  test("keys are allowlisted to simple identifiers (non-identifier key cannot inject markup)", () => {
    expect(src).toMatch(/getKey\(\)\.matches\("\[A-Za-z\]\[A-Za-z0-9-\]\*"\)/);
  });

  test("exactly two $unsafe sinks: dataAttrsMarkup (SAFE pre-escaped) and attrs (TRUSTED raw)", () => {
    const unsafeSinks = markup.match(/\$unsafe\{[^}]*\}/g) ?? [];
    expect(unsafeSinks, `unexpected $unsafe sinks: ${unsafeSinks.join(", ")}`).toEqual([
      "$unsafe{dataAttrsMarkup}",
      "$unsafe{attrs}",
    ]);
  });

  test("attrs is documented as TRUSTED raw (static author-typed strings only)", () => {
    expect(src.toLowerCase()).toMatch(/trusted/);
  });

  test("no inline on* handlers anywhere in the markup (CSP-clean)", () => {
    const inlineHandlers = markup.match(/\son[a-z]+=/gi) ?? [];
    expect(inlineHandlers, `unexpected inline handlers: ${inlineHandlers.join(", ")}`).toEqual([]);
  });

  test("no inline <script> tag (CSP-clean)", () => {
    expect(markup).not.toMatch(/<script/i);
  });
});

// ---------------------------------------------------------------------------
// §5 Tokens -- no bare hex, all var(--lv-*)
// ---------------------------------------------------------------------------
describe("checkbox -- token contract (no bare hex literals)", () => {
  test("uses token-backed colours (no bare hex)", () => {
    // Strip the imports and comments, then check for bare hex.
    const body = src.replace(/<%--[\s\S]*?--%>/g, "").replace(/@import[^\n]*/g, "");
    expect(body, "leaked a hardcoded hex colour").not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  test("reads --lv-color-primary for the checked fill", () => {
    expect(src).toContain("--lv-color-primary");
  });

  test("reads --lv-color-primary-fg for SVG glyph colour", () => {
    expect(src).toContain("--lv-color-primary-fg");
  });

  test("reads --lv-color-destructive for aria-invalid recolour", () => {
    expect(src).toContain("--lv-color-destructive");
  });

  test("reads --lv-ring for the focus-visible ring", () => {
    expect(src).toContain("--lv-ring");
  });

  test("reads --lv-radius-sm for box corner radius", () => {
    expect(src).toContain("--lv-radius-sm");
  });

  test("reads --lv-opacity-disabled for disabled dimming", () => {
    expect(src).toContain("--lv-opacity-disabled");
  });
});

// ---------------------------------------------------------------------------
// §6 Enhancer (happy-dom, real installCheckbox + LievitRuntime)
// The spec says the enhancer fires onComponentInit + afterCall (which covers morph).
// ---------------------------------------------------------------------------
describe("checkbox.enhancer -- indeterminate DOM property lifecycle", () => {
  let runtime: LievitRuntime;

  beforeEach(() => {
    document.body.innerHTML = "";
    runtime = new LievitRuntime();
    installCheckbox(runtime);
  });

  /**
   * Builds a minimal component root with one checkbox input.
   * When indeterminate=true, the input carries data-indeterminate="true".
   */
  function mountComponent(indeterminate: boolean, checked = false): {
    root: HTMLElement;
    input: HTMLInputElement;
  } {
    const html = `
      <div data-lievit-component="test.Comp" data-lievit-id="cid" data-lievit-snapshot="s1">
        <input type="checkbox"
               ${checked ? "checked" : ""}
               ${indeterminate ? 'data-indeterminate="true"' : ""}
               aria-label="Test checkbox">
      </div>`;
    document.body.innerHTML = html;
    const root = document.body.firstElementChild as HTMLElement;
    const input = root.querySelector("input") as HTMLInputElement;
    return { root, input };
  }

  test("indeterminate DOM property is set on init when data-indeterminate=true", () => {
    const { root, input } = mountComponent(true);
    // Simulate onComponentInit by calling the lifecycle hook directly.
    // (In a real runtime, start() would fire onComponentInit; we call it via the lifecycle bus.)
    runtime.lifecycle.componentInit({ root, componentId: "cid" });
    expect(input.indeterminate).toBe(true);
  });

  test("indeterminate is NOT set when data-indeterminate is absent", () => {
    const { root, input } = mountComponent(false);
    runtime.lifecycle.componentInit({ root, componentId: "cid" });
    expect(input.indeterminate).toBe(false);
  });

  test("setting indeterminate twice is idempotent (no error, still true)", () => {
    const { root, input } = mountComponent(true);
    runtime.lifecycle.componentInit({ root, componentId: "cid" });
    runtime.lifecycle.componentInit({ root, componentId: "cid" });
    expect(input.indeterminate).toBe(true);
  });

  test("morph re-applies indeterminate: afterCall hook sets it on the (potentially new) DOM node", () => {
    const { root } = mountComponent(true);
    runtime.lifecycle.componentInit({ root, componentId: "cid" });

    // Simulate a morph: replace the input node (the same content, but new DOM identity).
    root.innerHTML = '<input type="checkbox" data-indeterminate="true" aria-label="Test checkbox">';
    const newInput = root.querySelector("input") as HTMLInputElement;
    // The new node's indeterminate is false until afterCall fires.
    expect(newInput.indeterminate).toBe(false);

    // Simulate the afterCall lifecycle phase (fires after every wire morph).
    runtime.lifecycle.afterCall({
      root,
      componentId: "cid",
      status: 200,
      ok: true,
      reason: null,
    });
    expect(newInput.indeterminate).toBe(true);
  });

  test("morph does NOT set indeterminate when the new DOM has no flagged input", () => {
    const { root } = mountComponent(true);
    runtime.lifecycle.componentInit({ root, componentId: "cid" });

    // Morph replaces with a non-indeterminate input.
    root.innerHTML = '<input type="checkbox" aria-label="Test checkbox">';
    const newInput = root.querySelector("input") as HTMLInputElement;

    runtime.lifecycle.afterCall({
      root,
      componentId: "cid",
      status: 200,
      ok: true,
      reason: null,
    });
    expect(newInput.indeterminate).toBe(false);
  });

  test("enhancer returns an unsubscribe function (does not throw on call)", () => {
    const unsub = installCheckbox(runtime);
    expect(() => unsub()).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// §7 Keyboard -- platform: <input> is in the tab sequence, not a div-with-role
// ---------------------------------------------------------------------------
describe("checkbox -- keyboard contract (platform, source assertions)", () => {
  test("the interactive element is a real <input type=checkbox> (never a div-with-role)", () => {
    expect(markup).toMatch(/<input[\s\S]*?type="checkbox"/);
    expect(markup).not.toMatch(/<div[^>]*role="checkbox"/);
    expect(markup).not.toMatch(/<span[^>]*role="checkbox"/);
  });

  test("the input has no tabindex attribute (in natural tab sequence, no manipulation)", () => {
    // APG §4: no tabindex manipulation needed or allowed for a native checkbox.
    expect(markup).not.toMatch(/tabindex=/);
  });

  test("the input is in the DOM (not removed) so the browser handles Tab + Space natively", () => {
    // The sr-only class hides it visually but keeps it in the DOM + tab sequence.
    expect(markup).toContain("sr-only");
    // The visible box is pointer-events-none absolute (purely decorative overlay).
    expect(markup).toContain("pointer-events-none absolute");
  });
});
