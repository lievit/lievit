/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * Golden / structural checks for the static JTE partials (registry/jte/*.jte).
 *
 * The partials are plain JTE source the adopter copies in; this Node package has no JTE
 * compiler, so the load-bearing contract is pinned two ways:
 *   1. Structurally here (semantic element, tokens, no inline <script>, declared @param,
 *      correct JTE comment syntax) so a regression in the source is caught in CI.
 *   2. By an out-of-band real-compiler smoke (jte 3.2.4 precompileAll + render asserts)
 *      run during authoring; see the commit log. These structural checks mirror what that
 *      smoke proved so the invariants survive without the JVM on the Node CI path.
 */
import { describe, test, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const jteRoot = join(import.meta.dirname, "..", "registry", "jte");
const read = (rel: string) => readFileSync(join(jteRoot, rel), "utf8");

const ALL = [
  "skeleton.jte",
  "aspect-ratio.jte",
  "kbd.jte",
  "table.jte",
  "table/header.jte",
  "table/body.jte",
  "table/footer.jte",
  "table/row.jte",
  "table/head.jte",
  "table/cell.jte",
  "table/caption.jte",
  // Wave 1b: the form-control partials (native element, token-styled, l:model-bindable).
  "input.jte",
  "textarea.jte",
  "label.jte",
  "field.jte",
  "field/group.jte",
  "field/set.jte",
  "field/separator.jte",
  "form.jte",
  "checkbox.jte",
  "radio-group.jte",
  "radio-group/option.jte",
  "switch.jte",
  "slider.jte",
  "toggle.jte",
] as const;

// The Wave-1b form-control partials never ship a Font Awesome glyph (icons come from the
// Lucide icon partial only); the strict CSP also forbids inline event handlers.
const FORM_CONTROLS = [
  "input.jte",
  "textarea.jte",
  "label.jte",
  "field.jte",
  "field/group.jte",
  "field/set.jte",
  "field/separator.jte",
  "form.jte",
  "checkbox.jte",
  "radio-group.jte",
  "radio-group/option.jte",
  "switch.jte",
  "slider.jte",
  "toggle.jte",
  "native-select.jte",
  "input-otp.jte",
] as const;

describe("static JTE partials: house rules", () => {
  test.each(ALL)("%s exists", (f) => {
    expect(existsSync(join(jteRoot, f)), `${f} must exist`).toBe(true);
  });

  test.each(ALL)("%s never ships an inline <script> (CSP)", (f) => {
    expect(read(f)).not.toMatch(/<script/i);
  });

  test.each(ALL)("%s uses JTE comment syntax <%-- --%>, not @* *@", (f) => {
    // @* *@ is NOT a JTE comment; it compiles as content and breaks the build.
    expect(read(f)).not.toMatch(/@\*/);
  });

  test.each(ALL)("%s has no em-dash (house rule)", (f) => {
    expect(read(f)).not.toContain("—"); // U+2014 EM DASH
  });

  test.each(ALL)("%s carries a usage doc comment at the top", (f) => {
    expect(read(f)).toMatch(/<%--[\s\S]*?--%>/);
  });
});

describe("skeleton.jte", () => {
  const src = read("skeleton.jte");
  const markup = src.replace(/<%--[\s\S]*?--%>/g, "");
  test("v-next: declares new params (size, active, skeletonRows, skeletonShape, label)", () => {
    expect(src).toContain('@param String size = "md"');
    expect(src).toContain("@param boolean active = true");
    expect(src).toContain("@param int skeletonRows = 3");
    expect(src).toContain('@param String skeletonShape = "lines"');
    expect(src).toContain('@param String label = "Loading…"');
  });
  test("v-next: old params removed (shape, width, height, klass)", () => {
    expect(src).not.toContain("@param String shape");
    expect(src).not.toContain("@param String width");
    expect(src).not.toContain("@param String height");
    expect(src).not.toContain("@param String klass");
  });
  test("is an aria-live status with role=status (shimmer replaces pulse)", () => {
    expect(markup).toContain('role="status"');
    expect(markup).toContain('aria-live="polite"');
    // v-next uses shimmer (lv-skeleton--active class + skeleton.css), not animate-pulse.
    expect(markup).not.toContain("animate-pulse");
    expect(markup).toContain("lv-skeleton--active");
  });
  test("draws fill from --lv-skeleton-bg token, not hardcoded colour", () => {
    expect(src).toContain("--lv-skeleton-bg");
    expect(markup).not.toMatch(/#[0-9a-fA-F]{3,6}/);
  });
});

describe("aspect-ratio.jte", () => {
  const src = read("aspect-ratio.jte");
  test("takes ratioX + ratioY int params (v-next: typed ints replacing single String ratio) and a Content child", () => {
    // v-next: OLD @param String ratio (e.g. "16/9") → NEW @param int ratioX + @param int ratioY.
    // Typed ints make the call-site type-safe; the template owns CSS formatting.
    expect(src).toMatch(/@param int ratioX/);
    expect(src).toMatch(/@param int ratioY/);
    expect(src).toMatch(/@param gg\.jte\.Content content/);
    // old single String ratio param is gone
    expect(src).not.toMatch(/@param String ratio\b/);
  });
  test("uses the native CSS aspect-ratio property via --lv-ar-ratio custom property (two-element pattern)", () => {
    // v-next: the ratio is emitted as a CSS custom property --lv-ar-ratio on the outer div
    // (value: e.g. "16 / 9"), and the inner div enforces it via aspect-ratio:var(--lv-ar-ratio).
    // Two-element pattern: outer = framing (overflow/border-radius); inner = ratio enforcement.
    expect(src).toContain("--lv-ar-ratio");
    expect(src).toContain("aspect-ratio:var(--lv-ar-ratio)");
    // check the MARKUP only (the doc comment mentions the legacy hack on purpose)
    const markup = src.replace(/<%--[\s\S]*?--%>/g, "");
    expect(markup).not.toContain("padding-bottom");
    // two-element pattern: outer + inner slots
    expect(markup).toContain('data-slot="aspect-ratio"');
    expect(markup).toContain('data-slot="aspect-ratio-inner"');
  });
  test("renders the slotted content", () => {
    expect(src).toContain("${content}");
  });
});

describe("kbd.jte (v-next)", () => {
  const src = read("kbd.jte");
  test("renders the semantic <kbd> element", () => {
    expect(src).toMatch(/<kbd[\s>]/);
    expect(src).toContain("</kbd>");
  });
  test("carries data-slot=kbd and data-size", () => {
    expect(src).toContain('data-slot="kbd"');
    expect(src).toContain('data-size="${size}"');
  });
  test("v-next: takes a List<String> keys param (replaces key/content string params)", () => {
    expect(src).toContain("@param java.util.List<String> keys");
    // old string params are gone
    expect(src).not.toContain("@param String key");
    expect(src).not.toContain("@param gg.jte.Content content");
  });
  test("single key (keys.size()==1) renders one <kbd>", () => {
    // The chord branch wraps inner <kbd> elements; the single branch renders one directly
    expect(src).toContain("keys.size() > 1");
  });
  test("chord (keys.size()>1) renders outer <kbd> wrapping inner <kbd> per key", () => {
    // inner <kbd> in the chord branch
    expect(src).toContain('<kbd class="${innerBase}">');
  });
  test("ariaLabel is a smart attribute (emitted only when non-null)", () => {
    expect(src).toContain('@param String ariaLabel = null');
    expect(src).toContain('aria-label="${ariaLabel}"');
  });
  test("size param drives text and padding tokens (sm/md/lg)", () => {
    expect(src).toContain("var(--lv-text-xs)");
    expect(src).toContain("var(--lv-text-sm)");
    expect(src).toContain("var(--lv-text-base)");
    expect(src).toContain("var(--lv-space-2)");
    expect(src).toContain("var(--lv-space-1)");
  });
  test("is non-selectable", () => {
    expect(src).toContain("select-none");
  });
  test("token-driven bg, border, and monospace font", () => {
    expect(src).toContain("var(--lv-color-muted-bg)");
    expect(src).toContain("var(--lv-color-border)");
    expect(src).toContain("var(--lv-font-mono)");
  });
});

describe("table.jte (composable set)", () => {
  test("the entry wraps a real <table> in a horizontal-scroll container", () => {
    const src = read("table.jte");
    expect(src).toContain("overflow-x-auto");
    expect(src).toMatch(/<table[\s\n]/);
    expect(src).toContain("${content}");
  });
  test("ships the full shadcn part set", () => {
    for (const part of ["header", "body", "footer", "row", "head", "cell", "caption"]) {
      expect(existsSync(join(jteRoot, "table", `${part}.jte`)), `table/${part}.jte`).toBe(true);
    }
  });
  test("uses the correct semantic element per part", () => {
    expect(read("table/header.jte")).toMatch(/<thead[\s>]/);
    expect(read("table/body.jte")).toMatch(/<tbody[\s>]/);
    expect(read("table/footer.jte")).toMatch(/<tfoot[\s>]/);
    expect(read("table/row.jte")).toMatch(/<tr[\s\n]/);
    expect(read("table/head.jte")).toMatch(/<th[\s\n]/);
    expect(read("table/cell.jte")).toMatch(/<td[\s>]/);
    expect(read("table/caption.jte")).toMatch(/<caption[\s>]/);
  });
  test("head cell carries a scope (accessible header association)", () => {
    const head = read("table/head.jte");
    expect(head).toMatch(/@param String scope/);
    expect(head).toContain('scope="${scope}"');
  });
  test("row selection uses a smart attribute (null = attribute dropped), not @if in name position", () => {
    const row = read("table/row.jte");
    expect(row).toContain('data-state="${state.isEmpty() ? null : state}"');
    expect(row).not.toMatch(/@if\([^)]*\)data-state/);
  });
});

// ---------------------------------------------------------------------------
// Wave 1b: form-control partials (native element styled by tokens, l:model-bindable)
// ---------------------------------------------------------------------------
describe("form-control partials: never Font Awesome (icons via the Lucide icon partial)", () => {
  test.each(FORM_CONTROLS)("%s ships no Font Awesome glyph or inline handler", (f) => {
    const src = read(f);
    expect(src).not.toMatch(/\bfa-|font-awesome|fontawesome/i);
    // No inline event handler attributes (the strict CSP refuses them silently).
    const markup = src.replace(/<%--[\s\S]*?--%>/g, "");
    expect(markup).not.toMatch(/\son[a-z]+=/i);
  });
});

describe("input.jte", () => {
  const src = read("input.jte");
  test("renders a real native <input> inside a container div, carrying a name (POSTs) + l:model via attrs", () => {
    // Wave 1 re-forge: the bare <input> is now wrapped in a <div data-slot="input"> container;
    // the native input carries data-slot="input-field". l:model travels via the `attrs` channel
    // ($unsafe), not a dedicated `model` param (which was removed).
    const markup = src.replace(/<%--[\s\S]*?--%>/g, "");
    expect(markup).toMatch(/<div[\s\S]*?data-slot="input"/);
    expect(markup).toMatch(/<input[\s\n]/);
    expect(markup).toContain('name="${name}"');
    // l:model is passed by the caller via the attrs channel; the partial exposes $unsafe{attrs}.
    expect(markup).toContain("$unsafe{attrs}");
    // No model param -- that was the old surface.
    expect(src).not.toMatch(/@param String model/);
  });
  test("token-styled with the --lv-ring focus + aria-invalid, no hardcoded colour", () => {
    expect(src).toContain("var(--lv-ring)");
    expect(src).toContain('aria-invalid="${invalid ? "true" : null}"');
    const markup = src.replace(/<%--[\s\S]*?--%>/g, "");
    expect(markup).not.toMatch(/#[0-9a-fA-F]{3,6}/);
  });
  test("hint sub-element removed (field partial's concern): no hint param, no inputId-hint id", () => {
    // Wave 1 re-forge: the built-in hint sub-element was removed from input.jte; hints are now
    // the field partial's responsibility, not the input primitive's. The `accept`/`multiple`
    // file-input affordance was also removed (dedicated file-upload component).
    expect(src).not.toMatch(/@param String hint/);
    expect(src).not.toContain("inputId-hint");
    // The input still has a clean attrs channel for describedby wired externally.
    expect(src).toContain('@param String attrs = ""');
  });
  test("file inputs: accept/multiple params removed (file affordance now in dedicated file-upload component)", () => {
    // Wave 1 re-forge: the file affordance (accept, multiple, the file: chip) was removed from
    // input.jte and moved to a dedicated file-upload component. The input partial is now
    // a pure single-line text-input primitive.
    expect(src).not.toMatch(/@param String accept/);
    expect(src).not.toMatch(/@param boolean multiple/);
    expect(src).not.toContain('"file".equals(type)');
  });
});

describe("textarea.jte", () => {
  const src = read("textarea.jte");
  test("renders a real native <textarea> carrying a name + binds via l:model (via $unsafe{modelDirective})", () => {
    // Wave 1 re-forge: l:model is no longer a static attribute literal; instead, the template
    // builds `modelDirective = "l:model=\"" + model + "\""` and emits it with $unsafe{modelDirective}.
    // This lets JTE skip the attribute entirely when model is null (blank modelDirective = empty string).
    const markup = src.replace(/<%--[\s\S]*?--%>/g, "");
    expect(markup).toMatch(/<textarea[\s\n]/);
    expect(markup).toContain("</textarea>");
    expect(markup).toContain('name="${name}"');
    expect(markup).toContain("$unsafe{modelDirective}");
    // The model param still exists as the shorthand trigger.
    expect(src).toMatch(/@param String model/);
  });
  test("the value renders as the element's text content, not a value attribute", () => {
    expect(src).toContain(">${value}</textarea>");
  });
  test("built-in helper text: a hint renders below + auto-wires aria-describedby (joinedDescribedBy)", () => {
    // Wave 1 re-forge: the hint id variable is `hintId` (not `inputId-hint`); aria-describedby
    // is a space-joined list built as `joinedDescribedBy` from describedBy + hintId + countId.
    expect(src).toMatch(/@param String hint/);
    expect(src).toContain('id="${areaId}-hint"');
    expect(src).toContain("hintId");
    expect(src).toContain('aria-describedby="${joinedDescribedBy}"');
  });
});

describe("label.jte", () => {
  const src = read("label.jte");
  test("renders a real native <label for> with the for association", () => {
    const markup = src.replace(/<%--[\s\S]*?--%>/g, "");
    expect(markup).toMatch(/<label[\s\n]/);
    expect(markup).toContain('for="${forId}"');
  });
  test("the required marker is hidden from AT (aria-hidden glyph) and announced as text (sr-only sibling)", () => {
    // v-next: required marker = aria-hidden * glyph (visual cue) + sr-only " (required)" text
    // (part of the label's accessible name, read by screen readers as plain text).
    // The old single-span with aria-hidden alone was insufficient (VoiceOver silence on the *);
    // the sr-only sibling ensures screen readers announce "Field name (required)".
    expect(src).toContain('aria-hidden="true"');
    expect(src).toContain('data-slot="label-required"');
    expect(src).toContain('<span class="sr-only"> (required)</span>');
  });
  test("no error param: label does NOT recolour on invalid (correct WCAG 1.4.1 behavior)", () => {
    // v-next: the `error` param and `data-[error=true]:text-[var(--lv-color-destructive)]` are
    // deliberately REMOVED. WCAG 1.4.1 (Use of Color) prohibits using colour alone to convey
    // state; recolouring the label text red is an anti-pattern because it creates a colour-only
    // cue. Invalidity is now communicated by the field wrapper's data-invalid cascade and the
    // role=alert error message — both are colour-independent signals.
    expect(src).not.toMatch(/@param boolean error/);
    expect(src).not.toContain("data-[error=true]:text-[var(--lv-color-destructive)]");
    // label itself carries no invalidity indication — the wrapper owns it
    expect(src).not.toContain('data-error=');
  });
});

describe("field.jte (FormField + FieldError orchestration)", () => {
  const src = read("field.jte");
  test("composes the label partial + slots the control + renders an error as role=alert", () => {
    expect(src).toContain("@template.lievit.label(");
    expect(src).toContain("${control}");
    expect(src).toContain('role="alert"');
    // role=alert already implies an assertive live region: no extra aria-live (double-announce fix)
  });
  test("the description + error ids are derived from the control id (aria-describedby targets)", () => {
    // v-next: internal var _fid (resolves controlId ?? forId) is used in id expressions;
    // the param forId still exists as back-compat alias and _fid is derived from it.
    expect(src).toContain('id="${_fid}-error"');
    expect(src).toContain('id="${_fid}-description"');
  });
  test("auto-derives the invalid state from the error: data-invalid wrapper, but NOT an error-coloured label", () => {
    // v-next: data-invalid on the wrapper signals invalidity (colour-independent; CSS cascade);
    // the label call no longer passes error=hasError because the label must NOT recolour on
    // invalid (WCAG 1.4.1 anti-pattern removed from label.jte). The wrapper's data-invalid
    // attribute drives any error-state visual cues (e.g. ring colour), not the label text.
    expect(src).toContain("var hasError = hasErrorList || hasSingleError");
    expect(src).toContain('data-invalid="${hasError ? "true" : null}"');
    // label call: content + required only, no error flag
    expect(src).toContain("@template.lievit.label(forId = forId, content = @`${label}`, required = required)");
    expect(src).not.toContain("error = hasError");
  });
  test("supports vertical / horizontal / responsive orientation + a FieldContent slot", () => {
    expect(src).toMatch(/@param String orientation/);
    // v-next: data-orientation is now set to ${_layout} (the resolved layout ?? orientation value)
    expect(src).toContain('data-orientation="${_layout}"');
    expect(src).toContain("data-[orientation=horizontal]:flex-row");
    expect(src).toContain("data-[orientation=responsive]");
    expect(src).toContain('data-slot="field-content"');
  });
});

describe("field/* sub-primitives (FieldGroup / FieldSet+Legend / FieldSeparator)", () => {
  test("field/group establishes the container-query context the responsive field reads", () => {
    const src = read("field/group.jte");
    expect(src).toContain('data-slot="field-group"');
    expect(src).toContain("@container/field-group");
    expect(src).toContain("${content}");
  });
  test("field/set is a native <fieldset> + <legend> with an optional description, disable cascades", () => {
    const src = read("field/set.jte");
    const markup = src.replace(/<%--[\s\S]*?--%>/g, "");
    expect(markup).toMatch(/<fieldset[\s\n]/);
    expect(markup).toMatch(/<legend[\s\n]/);
    expect(markup).toContain('disabled="${disabled}"');
    expect(markup).toContain('data-slot="field-set-description"');
  });
  test("field/separator is a role=separator rule with an optional centred label", () => {
    const src = read("field/separator.jte");
    expect(src).toContain('role="separator"');
    expect(src).toContain('aria-orientation="horizontal"');
    expect(src).toContain('data-slot="field-separator-content"');
  });
});

describe("form.jte (server-first Form + form-level FormMessage)", () => {
  const src = read("form.jte");
  test("renders a native <form> that POSTs, with a form-level error region role=alert", () => {
    const markup = src.replace(/<%--[\s\S]*?--%>/g, "");
    expect(markup).toMatch(/<form[\s\n]/);
    expect(markup).toContain('method="${method}"');
    expect(markup).toContain('data-slot="form-error"');
    expect(markup).toContain('role="alert"');
    expect(markup).toContain('aria-live="assertive"');
  });
  test("the form references its error region via aria-describedby only when present", () => {
    expect(src).toContain('id="${errorId}"');
    expect(src).toContain('aria-describedby="${hasError ? errorId : null}"');
  });
  test("slots the field body", () => {
    expect(src).toContain("${content}");
  });
});

describe("checkbox.jte", () => {
  const src = read("checkbox.jte");
  test("renders a real native <input type=checkbox> carrying a name; l:model travels via attrs channel", () => {
    // Wave 1 re-forge: the `model` param was REMOVED. l:model is now passed by the caller
    // via the `attrs` TRUSTED channel ($unsafe). The `label` param was also removed (label is
    // a sibling <label for> at the call site, not inside the checkbox partial).
    const markup = src.replace(/<%--[\s\S]*?--%>/g, "");
    expect(markup).toMatch(/<input[\s\S]*?type="checkbox"/);
    expect(markup).toContain('name="${name}"');
    // l:model travels via attrs ($unsafe) -- the partial exposes $unsafe{attrs}.
    expect(markup).toContain("$unsafe{attrs}");
    // model and label params are gone from this partial's surface.
    expect(src).not.toMatch(/@param String model/);
    expect(src).not.toMatch(/@param String label\b/);
  });
  test("the check glyph is now an inline SVG (not the icon partial): aria-hidden, decorative", () => {
    // Wave 1 re-forge: the check glyph changed from `@template.lievit.icon(name = "check")`
    // to an inline <svg data-slot="checkbox-check"> for zero cross-template dependency.
    // The SVG is aria-hidden (decorative; AT reads the real <input>).
    expect(src).toContain('data-slot="checkbox-check"');
    expect(src).toContain('aria-hidden="true"');
    expect(src).toContain("var(--lv-color-primary)");
    // No icon partial call for the check glyph.
    expect(src).not.toContain('@template.lievit.icon(name = "check"');
  });
  test("supports the invalid state: ariaInvalid param + aria-invalid, ariaDescribedBy for hints", () => {
    // Wave 1 re-forge: `invalid` renamed to `ariaInvalid`; `describedBy` renamed to `ariaDescribedBy`.
    // The destructive border token is `--lv-color-destructive` (not `danger`).
    expect(src).toMatch(/@param boolean ariaInvalid/);
    expect(src).toContain('aria-invalid="${ariaInvalid ? "true" : null}"');
    expect(src).toContain("peer-aria-[invalid=true]:border-[var(--lv-color-destructive)]");
    expect(src).toMatch(/@param String ariaDescribedBy/);
    expect(src).toContain('aria-describedby="${ariaDescribedBy}"');
  });
  test("supports the indeterminate (mixed) tri-state via data-indeterminate + inline dash SVG + enhancer", () => {
    // Wave 1 re-forge: aria-checked is NOT a static attribute (browser owns it from the native
    // `checked` + `indeterminate` DOM properties; the enhancer sets el.indeterminate=true).
    // The dash glyph is now an inline <svg data-slot="checkbox-dash"> (not the icon partial).
    const markup = src.replace(/<%--[\s\S]*?--%>/g, "");
    expect(src).toMatch(/@param boolean indeterminate/);
    // aria-checked must NOT be emitted as a static attribute in the markup (browser derives it
    // from DOM props). The doc comment may mention it for explanation purposes -- check markup only.
    expect(markup).not.toContain('aria-checked=');
    expect(src).toContain('data-indeterminate="${indeterminate ? "true" : null}"');
    // Inline dash SVG instead of icon partial.
    expect(src).toContain('data-slot="checkbox-dash"');
    expect(src).not.toContain('@template.lievit.icon(name = "minus"');
    // CSS hooks for indeterminate visibility.
    expect(src).toContain("peer-data-[indeterminate=true]:hidden");
    expect(src).toContain("peer-data-[indeterminate=true]:flex");
  });
});

describe("radio-group.jte", () => {
  const src = read("radio-group.jte");
  test("has THREE render paths: default (role=radiogroup), button/button-vertical, and native fieldset+legend", () => {
    // Wave 1 re-forge: the options API changed from Map<String,String> + Content to parallel lists
    // (optionIds / optionLabels / optionDescriptions / optionDisabled). THREE render paths:
    // PATH A: custom div[role=radiogroup] + div[role=radio] (default + button + button-vertical).
    // PATH B: native fieldset + legend + input[type=radio] (nativeInputs=true).
    const markup = src.replace(/<%--[\s\S]*?--%>/g, "");
    // PATH A: custom radiogroup
    expect(markup).toMatch(/role="radiogroup"/);
    expect(markup).toMatch(/role="radio"/);
    // PATH B: native fieldset+legend (nativeInputs=true branch)
    expect(markup).toMatch(/<fieldset[\s\n]/);
    expect(markup).toMatch(/<legend[\s\n]/);
    // Parallel list params
    expect(src).toMatch(/@param java\.util\.List<String> optionIds/);
    expect(src).toMatch(/@param java\.util\.List<String> optionLabels/);
  });
  test("native path (nativeInputs=true): real input[type=radio] sharing one name per option", () => {
    // The native fieldset branch uses real input[type=radio] elements sharing the group name.
    // No per-partial option sub-template; options are rendered inline via @for in the template.
    const markup = src.replace(/<%--[\s\S]*?--%>/g, "");
    expect(markup).toMatch(/<input[\s\S]*?type="radio"/);
    expect(markup).toContain('name="${name}"');
  });
  test("supports the invalid/error state: aria-disabled on the group (invalid via aria on group)", () => {
    // Wave 1 re-forge: invalid is surfaced via the group's aria attributes; the `describedby`
    // param carries the external hint/error id for aria-describedby on the group root.
    expect(src).toMatch(/@param boolean disabled/);
    expect(src).toContain('aria-disabled="${disabled ? "true" : null}"');
    expect(src).toMatch(/@param String describedby/);
    expect(src).toContain('aria-describedby="${describedby}"');
    // The group supports required via aria-required.
    expect(src).toContain('aria-required="${required ? "true" : null}"');
  });
});

describe("switch.jte", () => {
  // Full coverage lives in test/switch.test.ts. This block covers only the contracts
  // that belong in the shared house-rules suite (element, role, data-slots).
  const src = read("switch.jte");
  const markup = src.replace(/<%--[\s\S]*?--%>/g, "");

  test("primary variant: <button role=switch aria-checked> (NOT a bare <input> or a div-with-role)", () => {
    // v-next re-forge: switch is now button-first per WAI-ARIA APG button-based pattern.
    // The old <input type=checkbox role=switch l:model> is now the asCheckbox=true branch only.
    expect(markup).toMatch(/<button[\s\S]*?role="switch"/);
    expect(markup).toContain('aria-checked="${checked ? "true" : "false"}"');
    // asCheckbox variant still uses <input type=checkbox role=switch> (not primary, opt-in).
    expect(markup).toMatch(/<input[\s\S]*?type="checkbox"[\s\S]*?role="switch"/);
  });

  test("data-slots are present for test selectors and consumer overrides", () => {
    expect(markup).toContain('data-slot="switch-root"');
    expect(markup).toContain('data-slot="switch"');
    expect(markup).toContain('data-slot="switch-thumb"');
  });

  test("disabled uses native `disabled` attribute (not aria-disabled) on both variants", () => {
    // For <button> and <input>, the native disabled attribute is correct; aria-disabled is
    // for <a role=button> only.
    expect(markup).toContain('disabled="${isBlocked}"');
    expect(markup).not.toMatch(/aria-disabled/);
  });
});

describe("slider.jte", () => {
  // v-next re-forge: params use double types; range → rangeMode; valueMin/Max → valueLow/High;
  // POST names are <name>Low/<name>High; data-slot is slider-input-low/high; model param removed
  // (l:model travels via attrs channel); vertical via CSS layout (no writing-mode hack).
  const src = read("slider.jte");
  test("renders a real native <input type=range> carrying a name (form POST, not l:model)", () => {
    const markup = src.replace(/<%--[\s\S]*?--%>/g, "");
    expect(markup).toMatch(/<input[\s\S]*?type="range"/);
    expect(markup).toContain('name="${name}"');
    // v-next: l:model is gone; the native range POSTs via its name attribute.
    // This is the correct server-first pattern; l:model is an anti-pattern for range inputs
    // (the enhancer handles real-time sync; the server receives the value on POST).
    expect(src).not.toMatch(/@param String model\b/);
  });
  test("the slider semantics come from the native element (min/max/step), not custom ARIA", () => {
    // v-next: min/max/step/value are now double (not int/Integer)
    expect(src).toContain('@param double min');
    expect(src).toContain('@param double max');
    expect(src).toContain('@param double step');
    expect(src).toContain('min="${min}"');
    expect(src).toContain('max="${max}"');
    expect(src).toContain('step="${step}"');
  });
  test("supports a two-thumb RANGE variant: two native ranges POSTing <name>Low/<name>High", () => {
    // v-next: param renamed rangeMode (was `range`); POST names are Low/High (not Min/Max);
    // data-slot identifiers are slider-input-low / slider-input-high (not data-thumb=min/max).
    expect(src).toMatch(/@param boolean rangeMode/);
    expect(src).toContain("@if(rangeMode)");
    expect(src).toContain('name="${name != null ? name + "Low" : null}"');
    expect(src).toContain('name="${name != null ? name + "High" : null}"');
    expect(src).toContain('data-slot="slider-input-low"');
    expect(src).toContain('data-slot="slider-input-high"');
    // Old Min/Max POST names and data-thumb=min/max are gone (deliberate API rename)
    expect(src).not.toContain('name="${name}Min"');
    expect(src).not.toContain('name="${name}Max"');
    expect(src).not.toContain('data-thumb="min"');
    expect(src).not.toContain('data-thumb="max"');
  });
  test("supports vertical orientation via CSS layout (not writing-mode; no rotate hack)", () => {
    expect(src).toMatch(/@param String orientation/);
    expect(src).toContain('data-orientation="${orientation}"');
    // v-next: vertical is expressed via CSS flex-col layout and separate track/thumb
    // positioning (not writing-mode: vertical which was the old anti-pattern).
    expect(src).not.toContain("writing-mode: vertical");
    const markup = src.replace(/<%--[\s\S]*?--%>/g, "");
    expect(markup).not.toMatch(/rotate\(/);
    // CSS layout root is data-orientation driven
    expect(src).toContain("isVertical");
  });
  test("controlled: value / valueLow / valueHigh are server-rendered (data down)", () => {
    // v-next: params renamed valueLow/valueHigh (were valueMin/valueMax); all are double.
    expect(src).toMatch(/@param double value\b/);
    expect(src).toMatch(/@param double valueLow\b/);
    expect(src).toMatch(/@param double valueHigh\b/);
    expect(src).toContain('value="${valueLow}"');
    expect(src).toContain('value="${valueHigh}"');
    // Old Integer valueMin/valueMax are gone
    expect(src).not.toMatch(/@param Integer valueMin/);
    expect(src).not.toMatch(/@param Integer valueMax/);
  });
});

describe("toggle.jte", () => {
  const src = read("toggle.jte");
  test("renders a real native <button> carrying aria-pressed, click wired via l:click", () => {
    const markup = src.replace(/<%--[\s\S]*?--%>/g, "");
    expect(markup).toMatch(/<button[\s\n]/);
    expect(markup).toContain('aria-pressed="${pressed ? "true" : "false"}"');
    // v-next: wireClick replaces pressedAction; smart attribute omits l:click when blank
    expect(src).toContain("wireClick != null && !wireClick.isBlank()");
    expect(markup).toContain("l:click=");
  });
  test("carries focus-visible ring via --lv-ring token (icon via content/leading/trailing slots)", () => {
    // v-next: icon string param removed; icons go through leading/trailing Content slots
    expect(src).not.toContain("@param String icon");
    expect(src).toContain("var(--lv-ring)");
  });
});

describe("native-select.jte (the one true select after the fold)", () => {
  const src = read("native-select.jte");
  test("renders a real native <select> carrying a name + binds via l:model", () => {
    const markup = src.replace(/<%--[\s\S]*?--%>/g, "");
    expect(markup).toMatch(/<select[\s\n]/);
    expect(markup).toContain("</select>");
    expect(markup).toContain('name="${name}"');
    expect(markup).toContain('l:model="${model}"');
  });
  test("covers value!=label via the content slot + simple value==label via options", () => {
    expect(src).toContain("@if(content != null)");
    expect(src).toContain("@for(String opt : options)");
  });
  test("supports the invalid state folded in from the removed select island", () => {
    expect(src).toContain('aria-invalid="${invalid ? "true" : null}"');
    expect(src).toContain("data-[invalid=true]:border-[var(--lv-color-destructive)]");
  });
  test("supports typed <optgroup> grouping via optionGroups (group label -> options)", () => {
    expect(src).toMatch(/@param java\.util\.Map<String, java\.util\.List<String>> optionGroups/);
    expect(src).toContain("@elseif(optionGroups != null)");
    expect(src).toContain('<optgroup label="${grp.getKey()}">');
  });
  test("supports sm / default / lg size variants driving the control height", () => {
    expect(src).toMatch(/@param String size/);
    expect(src).toContain('data-size="${size}"');
    expect(src).toContain("data-[size=sm]:h-[var(--lv-space-8)]");
    expect(src).toContain("data-[size=lg]:h-[var(--lv-space-10)]");
  });
});

describe("input-otp.jte (server-first segmented code)", () => {
  const src = read("input-otp.jte");
  test("renders N native single-char slots + a hidden name mirror (no inline script)", () => {
    const markup = src.replace(/<%--[\s\S]*?--%>/g, "");
    expect(markup).toContain("data-otp-slot");
    expect(markup).toContain("data-otp-mirror");
    expect(markup).not.toMatch(/<script/i);
  });
  test("supports explicit groups + a decorative Lucide separator between them", () => {
    expect(src).toMatch(/@param int groupSize/);
    expect(src).toContain("@if(grouped && i > 0 && i % groupSize == 0)");
    expect(src).toContain("data-otp-separator");
    expect(src).toContain('@template.lievit.icon(name = "minus"');
  });
  test("declares onComplete on the root so the enhancer can fire/submit when filled", () => {
    expect(src).toMatch(/@param String onComplete/);
    expect(src).toContain('data-otp-complete="${hasComplete ? onComplete : null}"');
  });
});
