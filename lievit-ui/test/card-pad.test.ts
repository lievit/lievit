/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * card-pad.test.ts — v-next: the old `pad` + `divided` API is gone.
 *
 * HISTORY: this file was originally "Parametrized padding + optional ruled header on card.jte",
 * pinning the `pad` (none|sm|md|lg) + `divided` (boolean) de-opinionation fix that avoided a
 * gest fork. In the Wave 3 re-forge both params were removed:
 *   - `pad` → replaced by `size` (sm|md|lg) + `noPadding` (boolean). The size param drives
 *     body, header, and footer padding off per-region space tokens (not one shared token).
 *   - `divided` → the separator under the header is now ALWAYS-RENDERED (aria-hidden, space-token
 *     height) when a header is present. There is no opt-in; the UI contract requires the separator.
 *
 * This file now pins the *new* spacing/separator surface introduced by size + noPadding, asserting
 * the same goals (caller controls density; no forced fork) on the new API. The full API + variant
 * + a11y contract lives in test/card.test.ts.
 */
import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const jteDir = join(import.meta.dirname, "..", "registry", "jte");
const src = readFileSync(join(jteDir, "card.jte"), "utf8");

describe("card -- size param replaces the old pad param (three-level density control)", () => {
  test('declares size with default "md"', () => {
    expect(src).toContain('@param String size = "md"');
  });

  test("sm size maps body padding to --lv-space-3 (tight layout)", () => {
    expect(src).toContain("var(--lv-space-3)");
    expect(src).toMatch(/case "sm"/);
  });

  test("md size maps body padding to --lv-space-4 (standard layout; md is the switch default branch)", () => {
    expect(src).toContain("var(--lv-space-4)");
    // md is the default case in the switch (no explicit case "md" label); the token must be present.
    expect(src).toContain("var(--lv-space-4)");
  });

  test("lg size maps body padding to --lv-space-6 (spacious layout)", () => {
    expect(src).toContain("var(--lv-space-6)");
    expect(src).toMatch(/case "lg"/);
  });

  test("data-size attribute on root lets the caller target density via CSS/JS without a fork", () => {
    expect(src).toContain('data-size="${size}"');
  });

  test("old pad param is GONE (the rename removes the fork source)", () => {
    // The old @param String pad = "md" that drove the gest fork is replaced by size.
    expect(src).not.toContain('@param String pad');
    expect(src).not.toMatch(/var gapClass = switch \(pad\)/);
    expect(src).not.toMatch(/var surfacePyCls = switch \(pad\)/);
  });
});

describe("card -- noPadding replaces pad='none' (full-bleed content)", () => {
  test("declares noPadding boolean (false by default, preserving the normal padding contract)", () => {
    expect(src).toContain("@param boolean noPadding = false");
  });

  test("noPadding=true strips body padding to 0 so table/image content bleeds to the card edge", () => {
    // The old pad="none" case used gap-0 + py-0 + px-0 on a shared token.
    // v-next: noPadding strips only body padding (bodyPad = "0"); header retains its padding.
    expect(src).toContain('noPadding ? "0"');
  });
});

describe("card -- separator replaces the old divided param (always-present under header)", () => {
  test("separator is ALWAYS rendered under header when header is present (no opt-in flag)", () => {
    // The old divided=false (default) produced no divider; divided=true added a border.
    // v-next: the separator is always present (data-slot=card-separator, aria-hidden=true,
    // height driven by --lv-color-border). The UI contract requires it for visual hierarchy.
    expect(src).toContain('data-slot="card-separator"');
    expect(src).toMatch(/aria-hidden="true"[^>]*data-slot="card-separator"|data-slot="card-separator"[^>]*aria-hidden="true"/);
  });

  test("separator uses --lv-color-border token (not a hardcoded colour)", () => {
    expect(src).toContain("var(--lv-color-border)");
  });

  test("old divided param is GONE (the separator is unconditional)", () => {
    expect(src).not.toContain("@param boolean divided");
    expect(src).not.toMatch(/headerDivCls/);
    expect(src).not.toMatch(/footerDivCls/);
  });

  test("footer separator (card-separator-footer) is also always-rendered when footer is present", () => {
    expect(src).toContain('data-slot="card-separator-footer"');
  });
});

describe("card -- no inline <script>, no on* handlers (CSP-clean smoke)", () => {
  test("no inline <script> tag", () => {
    expect(src).not.toMatch(/<script/i);
  });

  test("no inline on* handlers", () => {
    const markup = src.replace(/<%--[\s\S]*?--%>/g, "");
    const handlers = markup.match(/\son[a-z]+=/gi) ?? [];
    expect(handlers, `unexpected inline handlers: ${handlers.join(", ")}`).toEqual([]);
  });
});
