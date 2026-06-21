/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * lievit-ui alert.jte -- the Filament-CALLOUT footer extension. alert.jte already covers
 * severity + icon + title + description (pinned by static-partials-w1a.test.ts); Filament's
 * Callout adds a footer / controls region below the description, which gest currently hand-rolls
 * in its status_banner 5+ times. This focused suite lives in its OWN file (NOT the shared
 * static-partials-w1a suite) to avoid touching the multi-component file, and asserts ONLY the
 * footer delta plus that the addition is BACK-COMPAT (the pre-existing title/description/action
 * contract is untouched). Source-as-text assertions; the real-compiler golden runs out of band.
 */
import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const jteDir = join(import.meta.dirname, "..", "registry", "jte");
const src = readFileSync(join(jteDir, "alert.jte"), "utf8");

describe("alert callout -- footer slot (the Filament-callout delta)", () => {
  test("declares an optional gg.jte.Content footer param defaulting to null", () => {
    expect(src).toContain("@param gg.jte.Content footer = null");
  });

  test("renders the footer region only when footer is set (purely additive)", () => {
    expect(src).toMatch(/@if\(footer != null\)/);
    expect(src).toContain('data-slot="alert-footer"');
    expect(src).toContain("${footer}");
  });

  // the slot names appear once in the doc comment and once in the markup; lastIndexOf pins the
  // MARKUP occurrence (the comment block precedes the rendered body).
  test("the footer sits in the content column (col 2), below the description", () => {
    const descIdx = src.lastIndexOf('data-slot="alert-description"');
    const footerIdx = src.lastIndexOf('data-slot="alert-footer"');
    expect(footerIdx).toBeGreaterThan(-1);
    expect(footerIdx, "footer must render after the description").toBeGreaterThan(descIdx);
    // pinned to the second grid column, like the title/description/action slots
    const footerBlock = src.slice(footerIdx, footerIdx + 240);
    expect(footerBlock).toContain("grid-column:2");
  });

  test("the footer lays its controls out as a wrapping flex row, token-driven spacing", () => {
    const footerIdx = src.lastIndexOf('data-slot="alert-footer"');
    const footerBlock = src.slice(footerIdx, footerIdx + 260);
    expect(footerBlock).toContain("display:flex");
    expect(footerBlock).toContain("flex-wrap:wrap");
    expect(footerBlock).toContain("gap:var(--lv-space-3)");
  });

  test("the usage doc shows a callout-with-footer example", () => {
    expect(src).toContain("footer = @@`");
  });
});

describe("alert callout -- BACK-COMPAT (the w1a contract is untouched)", () => {
  test("the pre-existing param API still stands", () => {
    expect(src).toContain('@param String variant = "info"');
    expect(src).toContain('@param String icon = ""');
    expect(src).toContain("@param gg.jte.Content title = null");
    expect(src).toContain("@param String heading = null");
    expect(src).toContain("@param gg.jte.Content description = null");
    expect(src).toContain("@param gg.jte.Content action = null");
    expect(src).toContain("@param gg.jte.Content content");
  });

  test("severity still drives the live role (destructive/warning assertive, info/success polite)", () => {
    expect(src).toContain('role="${urgent ? "alert" : "status"}"');
    expect(src).toMatch(/"destructive"\.equals\(variant\)/);
    expect(src).toMatch(/"warning"\.equals\(variant\)/);
  });

  test("title still renders before the description, and the action slot still exists", () => {
    expect(src.lastIndexOf('data-slot="alert-title"')).toBeLessThan(
      src.lastIndexOf('data-slot="alert-description"'),
    );
    expect(src).toContain('data-slot="alert-action"');
  });

  test("the footer does NOT displace the action slot -- both regions coexist", () => {
    // action stays the end-pinned control; footer is the new controls/footer region after it.
    const actionIdx = src.lastIndexOf('data-slot="alert-action"');
    const footerIdx = src.lastIndexOf('data-slot="alert-footer"');
    expect(actionIdx).toBeGreaterThan(-1);
    expect(footerIdx).toBeGreaterThan(actionIdx);
  });

  test("still ships no inline <script> / on* handlers (CSP-clean)", () => {
    expect(src).not.toMatch(/<script/i);
    const inlineHandlers = src.match(/\son[a-z]+=/gi) ?? [];
    expect(inlineHandlers, `unexpected inline handlers: ${inlineHandlers.join(", ")}`).toEqual([]);
  });
});
