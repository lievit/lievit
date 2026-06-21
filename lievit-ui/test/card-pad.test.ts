/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * Parametrized padding + optional ruled header on card.jte (the de-opinionation fix).
 *
 * shadcn's card hardcodes the level-6 spacing token for the gap, the vertical padding, and every
 * region's horizontal padding, and gest forked _partials/card.jte to get a tight content panel.
 * This pins the two knobs that remove the fork: pad (none|sm|md|lg, default md=the old level-6
 * baseline) scaling ALL the spacing off ONE token, and divided (default false) opting into a
 * ruled separator under the header / above the footer without a forced divider. As with the other
 * static-partials suites, this asserts on the partial SOURCE as text.
 */
import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const jteDir = join(import.meta.dirname, "..", "registry", "jte");
const src = readFileSync(join(jteDir, "card.jte"), "utf8");

/** pad level -> the single spacing token it drives (gap + surface py + per-region px). */
const PAD_SCALE: ReadonlyArray<readonly [string, string | null]> = [
  ["none", null],
  ["sm", "--lv-space-3"],
  ["md", "--lv-space-6"], // the shadcn level-6 baseline + default
  ["lg", "--lv-space-8"],
];

describe("card -- parametrized padding (pad)", () => {
  test("declares pad with the documented default md", () => {
    expect(src, "pad param missing").toContain('@param String pad = "md"');
  });

  for (const [level, token] of PAD_SCALE) {
    test(`pad="${level}" maps to ${token ?? "no-spacing (none)"}`, () => {
      if (token === null) {
        // "none" -> the caller owns spacing: gap-0 + py-0 + px-0, no token.
        expect(src).toMatch(/case "none"\s*->\s*"gap-0"/);
        expect(src).toMatch(/case "none"\s*->\s*"py-0"/);
        expect(src).toMatch(/case "none"\s*->\s*"px-0"/);
      } else {
        // the level drives gap + py + px off the SAME token (each as a full var() utility).
        expect(src, `gap ${level} must drive ${token}`).toContain(`gap-[var(${token})]`);
        expect(src, `py ${level} must drive ${token}`).toContain(`py-[var(${token})]`);
        expect(src, `px ${level} must drive ${token}`).toContain(`px-[var(${token})]`);
      }
    });
  }

  test("ONE token drives gap + surface py + per-region px (internal consistency at any density)", () => {
    // the three classes are computed per-level (one token), not hardcoded to level-6 anymore.
    expect(src).toMatch(/var gapClass = switch \(pad\)/);
    expect(src).toMatch(/var surfacePyCls = switch \(pad\)/);
    expect(src).toMatch(/var regionPxCls = switch \(pad\)/);
    // and they are interpolated onto the elements.
    expect(src).toContain("${gapClass}");
    expect(src).toContain("${surfacePyCls}");
    expect(src).toContain("${regionPxCls}");
  });

  test("the surface no longer hardcodes the level-6 gap/padding (the fork cause is gone)", () => {
    // the old fixed gap-[var(--lv-space-6)] + py-[var(--lv-space-6)] on the surface are now tokenized.
    expect(src, "surface gap must be parametrized").not.toContain("flex flex-col gap-[var(--lv-space-6)]");
    expect(src, "per-region px must be parametrized").not.toContain('class="px-[var(--lv-space-6)] text-[length:var(--lv-text-base)]"');
  });

  test('pad="none" collapses all spacing to *-0 so the caller owns it', () => {
    expect(src).toContain('gap-0');
    expect(src).toContain('py-0');
    expect(src).toContain('px-0');
  });
});

describe("card -- optional ruled header/footer (divided)", () => {
  test("declares divided as a boolean defaulting to false (borderless shadcn card)", () => {
    expect(src, "divided param missing").toContain("@param boolean divided = false");
  });

  test("divided=true adds a border-bottom under the header and a border-top above the footer", () => {
    expect(src).toMatch(/divided \?\s*" border-b border-\[var\(--lv-color-border\)\]/);
    expect(src).toMatch(/divided \?\s*" border-t border-\[var\(--lv-color-border\)\]/);
  });

  test("divided=false adds NO divider (the header stays optional, no forced rule)", () => {
    // the ternaries fall to "" when not divided -> no border class injected.
    expect(src).toMatch(/headerDivCls = divided \? [^;]*: "";/);
    expect(src).toMatch(/footerDivCls = divided \? [^;]*: "";/);
    expect(src).toContain("${headerDivCls}");
    expect(src).toContain("${footerDivCls}");
  });

  test("the header is still OPTIONAL (renders only when a title/description/action is supplied)", () => {
    expect(src).toContain("@if(hasHeader)");
    expect(src).toContain("!{var hasHeader = hasTitle || description != null || action != null;}");
  });
});

describe("card -- back-compat with the existing slot set is preserved", () => {
  test("the full shadcn slot set + data-slot regions are untouched", () => {
    for (const slot of ["card", "card-header", "card-title", "card-description", "card-action", "card-content", "card-footer"]) {
      expect(src, `data-slot="${slot}" missing`).toContain(`data-slot="${slot}"`);
    }
  });

  test("the title-over-heading precedence + labelled-region a11y are unchanged", () => {
    expect(src).toContain("@if(title != null)${title}@else${heading}@endif");
    expect(src).toContain('role="${hasTitle ? "region" : null}"');
    expect(src).toContain('aria-labelledby="${hasTitle ? headingId : null}"');
  });

  test("the pre-existing params (heading/headingId/title/description/action/footer/content) stay", () => {
    expect(src).toContain("@param String heading = null");
    expect(src).toContain('@param String headingId = "lv-card-heading"');
    expect(src).toContain("@param gg.jte.Content title = null");
    expect(src).toContain("@param gg.jte.Content description = null");
    expect(src).toContain("@param gg.jte.Content action = null");
    expect(src).toContain("@param gg.jte.Content footer = null");
    expect(src).toContain("@param gg.jte.Content content");
  });

  test("the surface still reads the card tokens (tint + radius + elevation)", () => {
    expect(src).toContain("bg-[var(--lv-color-card)]");
    expect(src).toContain("rounded-[var(--lv-radius-xl)]");
    expect(src).toContain("shadow-[var(--lv-shadow-sm)]");
    expect(src).toContain("border-[var(--lv-color-border)]");
  });

  test("no inline <script>, no on* handlers (CSP-clean)", () => {
    expect(src).not.toMatch(/<script/i);
    const inlineHandlers = src.match(/\son[a-z]+=/gi) ?? [];
    expect(inlineHandlers, `unexpected inline handlers: ${inlineHandlers.join(", ")}`).toEqual([]);
  });
});
