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
  "checkbox.jte",
  "radio-group.jte",
  "radio-group/option.jte",
  "switch.jte",
  "slider.jte",
  "toggle.jte",
  "native-select.jte",
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
    expect(src).toContain("var(--lv-color-surface)");
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
});

describe("label.jte", () => {
  const src = read("label.jte");
  test("renders a real native <label for> with the for association", () => {
    const markup = src.replace(/<%--[\s\S]*?--%>/g, "");
    expect(markup).toMatch(/<label[\s\n]/);
    expect(markup).toContain('for="${forId}"');
  });
  test("the required marker is hidden from assistive tech", () => {
    expect(src).toContain('<span aria-hidden="true" class="text-[var(--lv-color-danger)]">*</span>');
  });
});

describe("field.jte", () => {
  const src = read("field.jte");
  test("composes the label partial + slots the control + renders an error as role=alert", () => {
    expect(src).toContain("@template.label(");
    expect(src).toContain("${control}");
    expect(src).toContain('role="alert"');
    expect(src).toContain('aria-live="polite"');
  });
  test("the error element id is derived from the control id (aria-describedby target)", () => {
    expect(src).toContain('id="${forId}-error"');
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
    expect(src).toContain('@template.icon(name = "check"');
    expect(src).toContain("var(--lv-color-primary)");
  });
});

describe("radio-group.jte", () => {
  const src = read("radio-group.jte");
  const opt = read("radio-group/option.jte");
  test("the group is a native <fieldset> + <legend>, options share one name", () => {
    const markup = src.replace(/<%--[\s\S]*?--%>/g, "");
    expect(markup).toMatch(/<fieldset[\s\n]/);
    expect(markup).toMatch(/<legend[\s\n]/);
    expect(markup).toContain("@template.radio-group.option(");
  });
  test("each option is a real native <input type=radio> carrying the shared name + l:model", () => {
    const markup = opt.replace(/<%--[\s\S]*?--%>/g, "");
    expect(markup).toMatch(/<input[\s\S]*?type="radio"/);
    expect(markup).toContain('name="${name}"');
    expect(markup).toContain('l:model="${model}"');
  });
});

describe("switch.jte", () => {
  const src = read("switch.jte");
  test("renders a real native <input type=checkbox role=switch> carrying a name + l:model", () => {
    const markup = src.replace(/<%--[\s\S]*?--%>/g, "");
    expect(markup).toMatch(/<input[\s\S]*?type="checkbox"/);
    expect(markup).toContain('role="switch"');
    expect(markup).toContain('name="${name}"');
    expect(markup).toContain('l:model="${model}"');
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
    expect(src).toContain("@template.icon(name = icon");
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
    expect(src).toContain("data-[invalid=true]:border-[var(--lv-color-danger)]");
  });
});
