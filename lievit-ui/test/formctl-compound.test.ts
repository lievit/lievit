/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * shadcn fidelity Type-2 (#464) -- form-controls compound parts + features.
 * Structural golden over the partial SOURCE (the partials compile in the Java world; this JS
 * suite pins the token-driven styling, the a11y contract and the slot/param API as text):
 *   - field.jte      FieldError MULTI-error <ul> (deduped) + the data-[invalid] destructive cascade on the root
 *   - field/title    FieldTitle (data-slot="field-title")
 *   - field/set      FieldLegend label variant (compact)
 *   - switch.jte     the `sm` size variant (smaller track + thumb)
 *   - input-group    block-start/block-end addon alignment + `invalid` error state
 *   - input-group/textarea  the InputGroupTextarea variant
 */
import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const jteDir = join(import.meta.dirname, "..", "registry", "jte");
const read = (rel: string) => readFileSync(join(jteDir, rel), "utf8");
// markup with the leading doc comment stripped, so assertions never match the docs
const markupOf = (rel: string) => read(rel).replace(/<%--[\s\S]*?--%>/g, "");

describe("field.jte -- FieldError multi-error support", () => {
  const src = read("field.jte");
  const markup = markupOf("field.jte");

  test("declares an errors List<String> param alongside the back-compat single error String", () => {
    expect(src).toMatch(/@param java\.util\.List<String> errors/);
    expect(src).toMatch(/@param String error = null/);
  });

  test("dedupes the errors list (distinct, blanks dropped) before rendering", () => {
    expect(src).toContain(".filter(e -> e != null && !e.isBlank())");
    expect(src).toContain(".distinct()");
  });

  test("multi-error renders a <ul> with list-disc inside one role=alert region (deduped list)", () => {
    expect(markup).toContain('id="${forId}-error"');
    expect(markup).toContain('role="alert"');
    expect(markup).toContain("list-disc");
    expect(markup).toContain("@for(String msg : errorList)");
    expect(markup).toContain("<li>${msg}</li>");
  });

  test("a single-element errors list collapses to text (no <ul>), like shadcn", () => {
    expect(markup).toContain("@if(errorList.size() == 1)");
  });

  test("the single-String error path stays for back-compat (a <p> role=alert)", () => {
    expect(markup).toContain('<p data-slot="field-error" id="${forId}-error" role="alert"');
    expect(markup).toContain("@elseif(hasSingleError)");
  });

  test("hasError accounts for both the list and the single string", () => {
    expect(src).toContain("var hasError = hasErrorList || hasSingleError");
  });
});

describe("field.jte -- the data-[invalid] destructive cascade on the root", () => {
  const src = read("field.jte");
  test("the Field root tints its labels destructive when invalid (shadcn data-[invalid=true]:text-destructive)", () => {
    expect(src).toContain("data-[invalid=true]:text-[var(--lv-color-destructive)]");
    expect(src).toContain('data-invalid="${hasError ? "true" : null}"');
  });
});

describe("field/title.jte -- FieldTitle", () => {
  const src = read("field/title.jte");
  const markup = markupOf("field/title.jte");
  test("renders a data-slot=field-title node with text/content slot", () => {
    expect(markup).toContain('data-slot="field-title"');
    expect(src).toMatch(/@param gg\.jte\.Content content/);
    expect(markup).toContain("@if(content != null)${content}@else${text}@endif");
  });
  test("is medium-weight token-styled text dimmed when the field is disabled (shadcn parity)", () => {
    expect(src).toContain("font-[var(--lv-font-medium)]");
    expect(src).toContain("text-[length:var(--lv-text-sm)]");
    expect(src).toContain("group-data-[disabled=true]/field:opacity-50");
  });
  test("uses no hardcoded colour/size (tokens only)", () => {
    expect(src).not.toMatch(/#[0-9a-fA-F]{3,6}/);
  });
});

describe("field/set.jte -- FieldLegend label variant", () => {
  const src = read("field/set.jte");
  const markup = markupOf("field/set.jte");
  test("declares a legendVariant param defaulting to legend", () => {
    expect(src).toMatch(/@param String legendVariant = "legend"/);
  });
  test("the legend carries data-variant and switches text size legend(base)/label(sm)", () => {
    expect(markup).toContain('data-variant="${legendVariant}"');
    expect(markup).toContain("data-[variant=legend]:text-[length:var(--lv-text-base)]");
    expect(markup).toContain("data-[variant=label]:text-[length:var(--lv-text-sm)]");
  });
});

describe("switch.jte -- the sm size variant", () => {
  const src = read("switch.jte");
  const markup = markupOf("switch.jte");
  test("declares a size param (md default)", () => {
    expect(src).toMatch(/@param String size = "md"/);
  });
  test("the track + thumb + checked translate scale with size (sm smaller than md)", () => {
    // sm track/thumb/translate
    expect(src).toContain('"sm".equals(size) ? "h-[0.875rem] w-[1.5rem]"');
    expect(src).toContain('"sm".equals(size) ? "size-[0.6rem] peer-checked:translate-x-[0.55rem]"');
    // md (default) keeps the original geometry
    expect(src).toContain('"h-[1.15rem] w-[2rem]"');
    expect(src).toContain('"size-[0.85rem] peer-checked:translate-x-[0.85rem]"');
  });
  test("data-size is exposed on the root, track + thumb read the computed classes", () => {
    expect(markup).toContain('data-size="${size}"');
    expect(markup).toContain("${trackClass}");
    expect(markup).toContain("${thumbClass}");
  });
});

describe("input-group.jte -- block-align + invalid", () => {
  const src = read("input-group.jte");
  const markup = markupOf("input-group.jte");

  test("declares leadingAlign/trailingAlign + invalid params", () => {
    expect(src).toMatch(/@param String leadingAlign = "inline-start"/);
    expect(src).toMatch(/@param String trailingAlign = "inline-end"/);
    expect(src).toMatch(/@param boolean invalid = false/);
  });

  test("each addon's data-align is driven by the param (not hardcoded inline-start/end)", () => {
    expect(markup).toContain('data-align="${leadingAlign}"');
    expect(markup).toContain('data-align="${trailingAlign}"');
  });

  test("the wrapper flips to a column + auto height when a block addon is present (shadcn has-[] selectors)", () => {
    expect(markup).toContain("has-[>[data-align=block-start]]:flex-col");
    expect(markup).toContain("has-[>[data-align=block-start]]:h-auto");
    expect(markup).toContain("has-[>[data-align=block-end]]:flex-col");
    expect(markup).toContain("has-[>[data-align=block-end]]:h-auto");
  });

  test("block addons take full width + the proper order (above/below)", () => {
    expect(markup).toContain("data-[align=block-start]:order-first");
    expect(markup).toContain("data-[align=block-start]:w-full");
    expect(markup).toContain("data-[align=block-end]:order-last");
    expect(markup).toContain("data-[align=block-end]:w-full");
  });

  test("invalid shows a destructive border + ring on the group + aria-invalid on the control", () => {
    expect(markup).toContain('data-invalid="${invalid ? "true" : null}"');
    expect(markup).toContain("data-[invalid=true]:border-[var(--lv-color-destructive)]");
    expect(markup).toContain(
      "data-[invalid=true]:shadow-[0_0_0_3px_color-mix(in_srgb,var(--lv-color-destructive)_20%,transparent)]"
    );
    expect(markup).toContain('aria-invalid="${invalid ? "true" : null}"');
  });
});

describe("input-group/textarea.jte -- InputGroupTextarea variant", () => {
  const src = read("input-group/textarea.jte");
  const markup = markupOf("input-group/textarea.jte");

  test("is the group wrapping a real <textarea> (data-slot=input-group-control, resize-none)", () => {
    expect(markup).toMatch(/<textarea[\s\n]/);
    expect(markup).toContain("</textarea>");
    expect(markup).toContain('data-slot="input-group-control"');
    expect(markup).toContain("resize-none");
  });

  test("the group owns the focus ring, the textarea is borderless", () => {
    expect(markup).toContain('role="group"');
    expect(markup).toContain("focus-within:border-[var(--lv-color-ring)]");
    expect(markup).toContain("focus-within:shadow-[var(--lv-ring)]");
    expect(markup).toContain("border-0");
  });

  test("binds via l:model + carries name/id and renders value as text content", () => {
    expect(markup).toContain('name="${name}"');
    expect(markup).toContain('id="${areaId}"');
    expect(markup).toContain('l:model="${model}"');
    expect(markup).toContain(">${value}</textarea>");
  });

  test("supports the invalid error state (destructive border + ring + aria-invalid)", () => {
    expect(markup).toContain('data-invalid="${invalid ? "true" : null}"');
    expect(markup).toContain("data-[invalid=true]:border-[var(--lv-color-destructive)]");
    expect(markup).toContain('aria-invalid="${invalid ? "true" : null}"');
  });

  test("addons default to block alignment (above/below) for a textarea", () => {
    expect(src).toMatch(/@param String leadingAlign = "block-start"/);
    expect(src).toMatch(/@param String trailingAlign = "block-end"/);
  });

  test("never ships an inline <script> (strict CSP) and uses no hardcoded colour", () => {
    expect(src).not.toMatch(/<script/i);
    expect(src).not.toMatch(/#[0-9a-fA-F]{3,6}/);
  });
});
