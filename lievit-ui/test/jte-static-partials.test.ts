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
  test("declares its params", () => {
    for (const p of ["shape", "width", "height", "klass", "label"]) {
      expect(src).toMatch(new RegExp(`@param String ${p}`));
    }
  });
  test("is an aria-live status with a pulse animation", () => {
    expect(src).toContain('role="status"');
    expect(src).toContain('aria-busy="true"');
    expect(src).toContain("animate-pulse");
  });
  test("draws its fill from the muted token, not a hardcoded colour", () => {
    expect(src).toContain("var(--lv-color-muted)");
    expect(src).not.toMatch(/#[0-9a-fA-F]{3,6}/);
  });
});

describe("aspect-ratio.jte", () => {
  const src = read("aspect-ratio.jte");
  test("takes a ratio param and a Content child", () => {
    expect(src).toMatch(/@param String ratio/);
    expect(src).toMatch(/@param gg\.jte\.Content content/);
  });
  test("uses the native CSS aspect-ratio property (not the padding-bottom hack)", () => {
    expect(src).toContain("aspect-ratio:${ratio}");
    // check the MARKUP only (the doc comment mentions the legacy hack on purpose)
    const markup = src.replace(/<%--[\s\S]*?--%>/g, "");
    expect(markup).not.toContain("padding-bottom");
  });
  test("renders the slotted content", () => {
    expect(src).toContain("${content}");
  });
});

describe("kbd.jte", () => {
  const src = read("kbd.jte");
  test("renders the semantic <kbd> element", () => {
    expect(src).toMatch(/<kbd[\s>]/);
    expect(src).toContain("</kbd>");
  });
  test("content takes precedence over the key string", () => {
    expect(src).toContain("@if(content != null)${content}@else${key}@endif");
  });
  test("is non-selectable and token-styled", () => {
    expect(src).toContain("select-none");
    expect(src).toContain("var(--lv-color-muted-bg)");
    expect(src).toContain("var(--lv-color-border)");
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
  test("renders a real native <input> carrying a name (POSTs) + binds via l:model", () => {
    const markup = src.replace(/<%--[\s\S]*?--%>/g, "");
    expect(markup).toMatch(/<input[\s\n]/);
    expect(markup).toContain('name="${name}"');
    expect(markup).toContain('l:model="${model}"');
  });
  test("token-styled with the --lv-ring focus + aria-invalid, no hardcoded colour", () => {
    expect(src).toContain("var(--lv-ring)");
    expect(src).toContain('aria-invalid="${invalid ? "true" : null}"');
    const markup = src.replace(/<%--[\s\S]*?--%>/g, "");
    expect(markup).not.toMatch(/#[0-9a-fA-F]{3,6}/);
  });
  test("built-in helper text: a hint renders below + auto-wires aria-describedby", () => {
    expect(src).toMatch(/@param String hint/);
    expect(src).toContain('id="${inputId}-hint"');
    expect(src).toContain("hasHint ? inputId");
    expect(src).toContain('aria-describedby="${describedByValue}"');
  });
  test("file inputs get the shadcn file affordance (accept/multiple + the file: chip)", () => {
    expect(src).toMatch(/@param String accept/);
    expect(src).toMatch(/@param boolean multiple/);
    expect(src).toContain('"file".equals(type)');
    expect(src).toContain("file:text-[var(--lv-color-fg)]");
  });
});

describe("textarea.jte", () => {
  const src = read("textarea.jte");
  test("renders a real native <textarea> carrying a name + binds via l:model", () => {
    const markup = src.replace(/<%--[\s\S]*?--%>/g, "");
    expect(markup).toMatch(/<textarea[\s\n]/);
    expect(markup).toContain("</textarea>");
    expect(markup).toContain('name="${name}"');
    expect(markup).toContain('l:model="${model}"');
  });
  test("the value renders as the element's text content, not a value attribute", () => {
    expect(src).toContain(">${value}</textarea>");
  });
  test("built-in helper text: a hint renders below + auto-wires aria-describedby", () => {
    expect(src).toMatch(/@param String hint/);
    expect(src).toContain('id="${areaId}-hint"');
    expect(src).toContain("hasHint ? areaId");
    expect(src).toContain('aria-describedby="${describedByValue}"');
  });
});

describe("label.jte", () => {
  const src = read("label.jte");
  test("renders a real native <label for> with the for association", () => {
    const markup = src.replace(/<%--[\s\S]*?--%>/g, "");
    expect(markup).toMatch(/<label[\s\n]/);
    expect(markup).toContain('for="${forId}"');
  });
  test("the required marker is hidden from assistive tech", () => {
    expect(src).toContain('<span aria-hidden="true" class="text-[var(--lv-color-destructive)]">*</span>');
  });
  test("supports the error cue: data-error + a destructive label colour (shadcn's invalid label)", () => {
    expect(src).toMatch(/@param boolean error/);
    expect(src).toContain('data-error="${error ? "true" : null}"');
    expect(src).toContain("data-[error=true]:text-[var(--lv-color-destructive)]");
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
    expect(src).toContain('id="${forId}-error"');
    expect(src).toContain('id="${forId}-description"');
  });
  test("auto-derives the invalid state from the error: data-invalid wrapper + error-coloured label", () => {
    expect(src).toContain("var hasError = hasErrorList || hasSingleError");
    expect(src).toContain('data-invalid="${hasError ? "true" : null}"');
    // the label receives the error flag so it shows shadcn's destructive-label cue
    expect(src).toContain("error = hasError");
  });
  test("supports vertical / horizontal / responsive orientation + a FieldContent slot", () => {
    expect(src).toMatch(/@param String orientation/);
    expect(src).toContain('data-orientation="${orientation}"');
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
  test("renders a real native <input type=checkbox> carrying a name + binds via l:model", () => {
    const markup = src.replace(/<%--[\s\S]*?--%>/g, "");
    expect(markup).toMatch(/<input[\s\S]*?type="checkbox"/);
    expect(markup).toContain('name="${name}"');
    expect(markup).toContain('l:model="${model}"');
  });
  test("the check glyph comes from the icon partial (Lucide), token-styled", () => {
    expect(src).toContain('@template.lievit.icon(name = "check"');
    expect(src).toContain("var(--lv-color-primary)");
  });
  test("supports the invalid state: aria-invalid + a danger box border, with describedBy", () => {
    expect(src).toMatch(/@param boolean invalid/);
    expect(src).toContain('aria-invalid="${invalid ? "true" : null}"');
    expect(src).toContain("aria-[invalid=true]:border-[var(--lv-color-danger)]");
    expect(src).toMatch(/@param String describedBy/);
    expect(src).toContain('aria-describedby="${describedBy}"');
  });
  test("supports the indeterminate (mixed) tri-state: aria-checked=mixed + a dash glyph", () => {
    expect(src).toMatch(/@param boolean indeterminate/);
    expect(src).toContain('aria-checked="${indeterminate ? "mixed" : null}"');
    expect(src).toContain('data-indeterminate="${indeterminate ? "true" : null}"');
    expect(src).toContain('@template.lievit.icon(name = "minus"');
    // the check glyph hides while indeterminate, the dash shows
    expect(src).toContain("peer-data-[indeterminate=true]:hidden");
    expect(src).toContain("peer-data-[indeterminate=true]:flex");
  });
});

describe("radio-group.jte", () => {
  const src = read("radio-group.jte");
  const opt = read("radio-group/option.jte");
  test("the group is a native <fieldset> + <legend>, options share one name", () => {
    const markup = src.replace(/<%--[\s\S]*?--%>/g, "");
    expect(markup).toMatch(/<fieldset[\s\n]/);
    expect(markup).toMatch(/<legend[\s\n]/);
    expect(markup).toContain("@template.lievit.radio-group.option(");
  });
  test("each option is a real native <input type=radio> carrying the shared name + l:model", () => {
    const markup = opt.replace(/<%--[\s\S]*?--%>/g, "");
    expect(markup).toMatch(/<input[\s\S]*?type="radio"/);
    expect(markup).toContain('name="${name}"');
    expect(markup).toContain('l:model="${model}"');
  });
  test("supports the invalid/error state: aria-invalid on the group + danger option rings", () => {
    expect(src).toMatch(/@param boolean invalid/);
    expect(src).toContain('aria-invalid="${invalid ? "true" : null}"');
    expect(src).toMatch(/@param String describedBy/);
    expect(src).toContain('aria-describedby="${describedBy}"');
    // the invalid flag propagates to each option
    expect(src).toContain("invalid = invalid");
    const optMarkup = opt.replace(/<%--[\s\S]*?--%>/g, "");
    expect(optMarkup).toContain('aria-invalid="${invalid ? "true" : null}"');
    expect(optMarkup).toContain("aria-[invalid=true]:border-[var(--lv-color-danger)]");
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
  const src = read("slider.jte");
  test("renders a real native <input type=range> carrying a name + binds via l:model", () => {
    const markup = src.replace(/<%--[\s\S]*?--%>/g, "");
    expect(markup).toMatch(/<input[\s\S]*?type="range"/);
    expect(markup).toContain('name="${name}"');
    expect(markup).toContain('l:model="${model}"');
  });
  test("the slider semantics come from the native element (min/max/step), not custom ARIA", () => {
    expect(src).toContain('min="${min}"');
    expect(src).toContain('max="${max}"');
    expect(src).toContain('step="${step}"');
  });
  test("supports a two-thumb RANGE variant: two native ranges POSTing <name>Min/<name>Max", () => {
    expect(src).toMatch(/@param boolean range/);
    expect(src).toContain("@if(range)");
    expect(src).toContain('name="${name}Min"');
    expect(src).toContain('name="${name}Max"');
    expect(src).toContain('data-thumb="min"');
    expect(src).toContain('data-thumb="max"');
  });
  test("supports vertical orientation via the native vertical range (writing-mode), not a rotate hack", () => {
    expect(src).toMatch(/@param String orientation/);
    expect(src).toContain('data-orientation="${orientation}"');
    expect(src).toContain("writing-mode: vertical");
    const markup = src.replace(/<%--[\s\S]*?--%>/g, "");
    expect(markup).not.toMatch(/rotate\(/);
  });
  test("controlled: value / valueMin / valueMax are server-rendered (data down)", () => {
    expect(src).toMatch(/@param int value/);
    expect(src).toMatch(/@param Integer valueMin/);
    expect(src).toMatch(/@param Integer valueMax/);
    expect(src).toContain('value="${lo}"');
    expect(src).toContain('value="${hi}"');
  });
});

describe("toggle.jte", () => {
  const src = read("toggle.jte");
  test("renders a real native <button> carrying aria-pressed, click wired via l:click", () => {
    const markup = src.replace(/<%--[\s\S]*?--%>/g, "");
    expect(markup).toMatch(/<button[\s\n]/);
    expect(markup).toContain('aria-pressed="${pressed ? "true" : "false"}"');
    expect(markup).toContain('l:click="${pressedAction}"');
  });
  test("the optional icon comes from the Lucide icon partial, token-styled", () => {
    expect(src).toContain("@template.lievit.icon(name = icon");
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
