/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * shadcn fidelity Type-2 (#464) -- form-controls compound parts + features.
 * Structural golden over the partial SOURCE (the partials compile in the Java world; this JS
 * suite pins the token-driven styling, the a11y contract and the slot/param API as text):
 *   - field.jte      clean v-next API: status+message for validation intent (error/errors removed)
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

describe("field.jte -- clean v-next API (error/errors removed; status+message owns validation intent)", () => {
  const src = read("field.jte");
  const markup = markupOf("field.jte");

  test("does NOT declare error or errors params (back-compat error-path removed)", () => {
    expect(src).not.toMatch(/@param java\.util\.List<String> errors/);
    expect(src).not.toMatch(/@param String error /);
  });

  test("does NOT render a role=alert error region (field is not an error-summary)", () => {
    expect(markup).not.toContain('role="alert"');
    expect(markup).not.toContain('data-slot="field-error"');
  });

  test("does NOT carry data-invalid (error-path removed; status param owns intent)", () => {
    expect(src).not.toContain("data-invalid=");
    expect(src).not.toContain("data-[invalid=true]");
  });

  test("status param drives data-status on root (the clean intent channel)", () => {
    expect(src).toContain('data-status="${status != null ? status : ""}"');
    expect(src).toContain("@param String status = null");
  });

  test("message param is always in DOM as aria-live polite region (no role=alert reflow)", () => {
    expect(markup).toContain('aria-live="polite"');
    expect(markup).toContain('data-slot="field-message"');
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

describe("switch.jte -- size scale (v-next: px-based toolbar-aligned geometry)", () => {
  // v-next re-forge replaced the old rem-fraction geometry with px-based toolbar-aligned
  // track sizes and --lv-space-* tokens for thumb diameter. Full coverage in switch.test.ts.
  const src = read("switch.jte");
  const markup = markupOf("switch.jte");

  test("declares a size param (md default)", () => {
    expect(src).toMatch(/@param String size = "md"/);
  });

  test("sm track is h-[18px] w-[32px], thumb is size-[var(--lv-space-5)]", () => {
    expect(src).toContain('"h-[18px] w-[32px]"');
    expect(src).toContain('"size-[var(--lv-space-5)]"');
  });

  test("md track is h-[22px] w-[40px] (default / shadcn baseline), thumb is size-[var(--lv-space-6)]", () => {
    expect(src).toContain('"h-[22px] w-[40px]"');
    expect(src).toContain('"size-[var(--lv-space-6)]"');
  });

  test("lg track is h-[28px] w-[50px], thumb is size-[var(--lv-space-7)]", () => {
    expect(src).toContain('"h-[28px] w-[50px]"');
    expect(src).toContain('"size-[var(--lv-space-7)]"');
  });

  test("data-size is exposed on the root, computed trackClass + thumbClass interpolated on the elements", () => {
    expect(markup).toContain('data-size="${size}"');
    expect(markup).toContain("${trackClass}");
    expect(markup).toContain("${thumbClass}");
  });
});

describe("input-group.jte -- slot-based compose model (v-next re-forge)", () => {
  // NOTE: The old block-align API (leadingAlign/trailingAlign, data-align, has-[block-start/end]
  // selectors) was deliberately REMOVED in Wave 4. The new surface composes the control via a
  // required `content` Content slot; addons/elements go into 4 flanking slots
  // (leadingAddon, trailingAddon, leadingElement, trailingElement). The block-alignment feature
  // is now the caller's responsibility via layout wrappers.
  const src = read("input-group.jte");
  const markup = markupOf("input-group.jte");

  test("core control comes through a required `content` Content slot (not a hardcoded <input>)", () => {
    expect(src).toMatch(/@param gg\.jte\.Content content/);
    expect(markup).toContain("${content}");
    // No hardcoded inner <input> — the caller supplies the control
    // (the old name/id/type/placeholder params for the inner input are gone)
    expect(src).not.toMatch(/@param String name\b/);
    expect(src).not.toMatch(/@param String placeholder\b/);
  });

  test("declares leadingAddon, trailingAddon, leadingElement, trailingElement slot params", () => {
    expect(src).toMatch(/@param gg\.jte\.Content leadingAddon/);
    expect(src).toMatch(/@param gg\.jte\.Content trailingAddon/);
    expect(src).toMatch(/@param gg\.jte\.Content leadingElement/);
    expect(src).toMatch(/@param gg\.jte\.Content trailingElement/);
  });

  test("role=group is CONDITIONAL on ariaLabel/ariaLabelledBy (WAI-ARIA grouping rule)", () => {
    // A gratuitous role=group without an accessible name is a WAI-ARIA error;
    // the new surface only emits it when a shared label is provided.
    expect(src).toContain("ariaLabel");
    expect(src).toContain("ariaLabelledBy");
    expect(src).toContain("hasGroupLabel");
    expect(markup).toContain('role="${hasGroupLabel ? "group" : null}"');
    // Old unconditional role=group is gone (deliberate removal: the anti-pattern is corrected)
  });

  test("invalid state: aria-invalid + data-invalid on the group root + destructive --lv-ring token", () => {
    // The invalid prop drives a destructive border + focus-within ring using the canonical
    // --lv-ring-destructive token (not a hardcoded box-shadow string).
    expect(src).toMatch(/@param boolean invalid = false/);
    expect(markup).toContain('aria-invalid="${invalid ? "true" : null}"');
    expect(markup).toContain('data-invalid="${invalid ? "true" : null}"');
    expect(markup).toContain("data-[invalid=true]:border-[var(--lv-color-destructive)]");
    expect(markup).toContain("data-[invalid=true]:focus-within:shadow-[var(--lv-ring-destructive)]");
  });

  test("group root carries data-slot=input-group + data-size (hook for adopter CSS + tests)", () => {
    expect(markup).toContain('data-slot="input-group"');
    expect(markup).toContain('data-size="${size}"');
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
