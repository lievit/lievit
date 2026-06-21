/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * lievit-ui theme-switcher partial -- a light/dark/system segmented control (Filament's
 * components/theme-switcher). Like the other static-partials suites, this Node harness has no JTE
 * compiler, so it asserts on the partial SOURCE as text: it pins the @param API, the WAI-ARIA
 * radiogroup structure (role=radiogroup + three role=radio options + aria-checked + roving
 * tabindex driven by `current`), the data-* enhancer seam (data-lievit-theme-switcher +
 * data-storage-key + data-theme-value), the three theme icons (sun/moon/monitor), the
 * token-driven styling, and the a11y/CSP contract (NO inline script -- persistence is delegated
 * to a later enhancer off the data-* hook). The real-compiler golden runs out of band.
 */
import { describe, test, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const jteDir = join(import.meta.dirname, "..", "registry", "jte");
const src = readFileSync(join(jteDir, "theme-switcher.jte"), "utf8");
const iconsDir = join(import.meta.dirname, "..", "registry", "icons");

describe("theme-switcher -- params & docs API", () => {
  test("declares the documented param API with defaults", () => {
    expect(src).toContain('@param String current = "system"');
    expect(src).toContain("@param boolean labels = false");
    expect(src).toContain('@param String storageKey = "lievit-theme"');
    expect(src).toContain('@param String label = "Tema"');
    expect(src).toContain("@param String lightLabel");
    expect(src).toContain("@param String darkLabel");
    expect(src).toContain("@param String systemLabel");
    expect(src).toContain("@param String cssClass");
  });

  test("usage doc uses <%-- --%> (not @* *@) and shows the @template.lievit.theme-switcher call", () => {
    expect(src).toContain("<%--");
    expect(src).toContain("--%>");
    expect(src, "must NOT use @* *@ comment syntax").not.toMatch(/@\*/);
    expect(src).toMatch(/Usage:/);
    expect(src).toContain("@@template.lievit.theme-switcher(");
  });
});

describe("theme-switcher -- WAI-ARIA radiogroup structure", () => {
  test("the track is a labelled radiogroup", () => {
    expect(src).toContain('role="radiogroup"');
    expect(src).toContain('aria-label="${label}"');
    expect(src).toContain('data-slot="theme-switcher"');
  });

  test("renders exactly three role=radio options, one per theme value", () => {
    const radios = src.match(/role="radio"/g) ?? [];
    expect(radios.length, "expected three radio options").toBe(3);
    expect(src).toContain('data-theme-value="light"');
    expect(src).toContain('data-theme-value="dark"');
    expect(src).toContain('data-theme-value="system"');
  });

  test("aria-checked is server-owned, driven by `current` (1-of-3 selection)", () => {
    expect(src).toContain('aria-checked="${"light".equals(current) ? "true" : "false"}"');
    expect(src).toContain('aria-checked="${"dark".equals(current) ? "true" : "false"}"');
    expect(src).toContain('aria-checked="${"system".equals(current) ? "true" : "false"}"');
  });

  test("roving tabindex: the active option is tabbable (0), the rest are not (-1) -- APG contract", () => {
    expect(src).toContain('tabindex="${"light".equals(current) ? "0" : "-1"}"');
    expect(src).toContain('tabindex="${"dark".equals(current) ? "0" : "-1"}"');
    expect(src).toContain('tabindex="${"system".equals(current) ? "0" : "-1"}"');
  });

  test("each option is a real <button type=button> with an accessible name", () => {
    const buttons = src.match(/type="button"/g) ?? [];
    expect(buttons.length).toBe(3);
    expect(src).toContain('aria-label="${lightLabel}"');
    expect(src).toContain('aria-label="${darkLabel}"');
    expect(src).toContain('aria-label="${systemLabel}"');
  });
});

describe("theme-switcher -- icons & active styling", () => {
  test("composes the sun / moon / monitor icons via the icon partial", () => {
    expect(src).toContain('@template.lievit.icon(name = "sun", size = "1rem")');
    expect(src).toContain('@template.lievit.icon(name = "moon", size = "1rem")');
    expect(src).toContain('@template.lievit.icon(name = "monitor", size = "1rem")');
  });

  test("the three icons are vendored in registry/icons (the icon partial can resolve them)", () => {
    for (const name of ["sun", "moon", "monitor"]) {
      expect(existsSync(join(iconsDir, `${name}.svg`)), `missing icon: ${name}.svg`).toBe(true);
    }
  });

  test("the active option paints the accent surface from the tokens (not a flat grey)", () => {
    expect(src).toContain("aria-[checked=true]:bg-[var(--lv-color-accent)]");
    expect(src).toContain("aria-[checked=true]:text-[var(--lv-color-accent-fg)]");
  });

  test("the options join like a button-group (collapsed inner rounding + shared borders)", () => {
    expect(src).toContain("[&:not(:first-child)]:rounded-l-none");
    expect(src).toContain("[&:not(:first-child)]:border-l-0");
    expect(src).toContain("[&:not(:last-child)]:rounded-r-none");
  });

  test("the icon is decorative (aria-hidden); the visible label is opt-in via `labels`", () => {
    expect(src).toMatch(/aria-hidden="true"/);
    expect(src).toMatch(/@if\(labels\)/);
    expect(src).toContain('data-slot="theme-switcher-label"');
  });
});

describe("theme-switcher -- enhancer seam & CSP cleanliness", () => {
  test("exposes the data-* enhancer hook + storage key (persistence is the enhancer's job)", () => {
    expect(src).toContain("data-lievit-theme-switcher");
    expect(src).toContain('data-storage-key="${storageKey}"');
    expect(src).toContain('data-current="${current}"');
  });

  test("ships NO inline <script> and ZERO inline on* handlers (the CSP refuses them)", () => {
    expect(src).not.toMatch(/<script/i);
    const inlineHandlers = src.match(/\son[a-z]+=/gi) ?? [];
    expect(inlineHandlers, `unexpected inline handlers: ${inlineHandlers.join(", ")}`).toEqual([]);
  });

  test("no Font Awesome / wa-icon / Lit residue", () => {
    expect(src.toLowerCase()).not.toMatch(/font-?awesome|wa-icon|fa-/);
    expect(src.toLowerCase()).not.toMatch(/customelement|litelement|import .*\blit\b/);
  });

  test("styling is token-driven (no bare hex colours, no raw px spacing)", () => {
    expect(src, "leaked a hardcoded hex colour").not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    const stripped = src
      .replace(/\[[^\]]*\]/g, "[]")
      .replace(/var\(--lv-[^)]*\)/g, "");
    const numericUtils = stripped.match(/\b(?:p|px|py|pt|pb|pl|pr|m|mx|my|mb|mt|gap|h|w|text|size|space)-[1-9]/g) ?? [];
    expect(numericUtils, `non-token numeric utilities: ${numericUtils.join(", ")}`).toEqual([]);
  });
});
