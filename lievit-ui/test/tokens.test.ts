/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * The design-token contract (issue #428). The token file is the brand-able seam every
 * component reads, so this suite pins:
 *   - backward compatibility: the 31 v0.1 token NAMES still exist (the 28 components rely on them);
 *   - completeness: the Filament/shadcn-grade vocabulary is present (semantic colours with -fg,
 *     surfaces, border/input/ring, radius/space/type/shadow/z/motion scales);
 *   - dark mode: a .dark / [data-theme=dark] block re-points the colour tokens.
 * It is the documented structure the DONE criteria ask for: edit a token -> a test tells you
 * which contract you touched.
 */
import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const tokensCss = readFileSync(
  join(import.meta.dirname, "..", "registry", "tokens", "lievit-tokens.css"),
  "utf8"
);

/** Every `--lv-foo:` custom-property name declared anywhere in the file. */
const declared = new Set(
  [...tokensCss.matchAll(/(--lv-[a-z0-9-]+)\s*:/g)].map((m) => m[1])
);

/**
 * The :root rule body and the dark rule body, sliced on the actual SELECTORS (anchored to a
 * newline + `{` so the prose `:root` / `.dark` mentions inside the header comment do not match).
 */
const rootStart = tokensCss.search(/\n:root\s*\{/);
const darkStart = tokensCss.search(/\n\.dark\s*,/);
const rootBlock = tokensCss.slice(rootStart, darkStart);
const darkBlock = tokensCss.slice(darkStart);
const rootDeclared = new Set(
  [...rootBlock.matchAll(/(--lv-[a-z0-9-]+)\s*:/g)].map((m) => m[1])
);

/** The 31 names shipped in v0.1; the 28 existing components read these by name. */
const V0_1_NAMES = [
  "--lv-color-bg",
  "--lv-color-fg",
  "--lv-color-surface",
  "--lv-color-border",
  "--lv-color-muted",
  "--lv-color-primary",
  "--lv-color-primary-fg",
  "--lv-color-success",
  "--lv-color-success-fg",
  "--lv-color-warning",
  "--lv-color-warning-fg",
  "--lv-color-info",
  "--lv-color-info-fg",
  "--lv-color-danger",
  "--lv-color-danger-fg",
  "--lv-space-1",
  "--lv-space-2",
  "--lv-space-3",
  "--lv-space-4",
  "--lv-space-5",
  "--lv-space-6",
  "--lv-radius-sm",
  "--lv-radius-md",
  "--lv-font-sans",
  "--lv-text-sm",
  "--lv-text-base",
  "--lv-text-lg",
  "--lv-leading",
  "--lv-shadow-sm",
  "--lv-shadow-md",
  "--lv-ring",
];

describe("design tokens", () => {
  test("keeps every v0.1 token name (backward compatible with the 28 components)", () => {
    for (const name of V0_1_NAMES) {
      expect(declared, `dropped v0.1 token: ${name}`).toContain(name);
    }
    expect(V0_1_NAMES.length).toBe(31);
  });

  test("ships a full semantic colour set, each intent with a paired -fg", () => {
    const intents = [
      "primary",
      "secondary",
      "muted",
      "accent",
      "destructive",
      "success",
      "warning",
      "info",
      "danger",
    ];
    for (const intent of intents) {
      expect(declared, `missing --lv-color-${intent}`).toContain(`--lv-color-${intent}`);
      expect(declared, `missing --lv-color-${intent}-fg`).toContain(
        `--lv-color-${intent}-fg`
      );
    }
  });

  test("ships card/popover surfaces and border/input/ring", () => {
    for (const t of [
      "--lv-color-card",
      "--lv-color-card-fg",
      "--lv-color-popover",
      "--lv-color-popover-fg",
      "--lv-color-input",
      "--lv-color-ring",
    ]) {
      expect(declared, `missing surface/border token: ${t}`).toContain(t);
    }
  });

  test("ships a radius scale derived from a brandable --lv-radius base", () => {
    for (const t of [
      "--lv-radius",
      "--lv-radius-sm",
      "--lv-radius-md",
      "--lv-radius-lg",
      "--lv-radius-full",
    ]) {
      expect(declared, `missing radius token: ${t}`).toContain(t);
    }
  });

  test("ships a type scale (sizes, weights, line-heights) + mono font", () => {
    for (const t of [
      "--lv-font-mono",
      "--lv-text-xs",
      "--lv-text-xl",
      "--lv-text-2xl",
      "--lv-font-normal",
      "--lv-font-medium",
      "--lv-font-semibold",
      "--lv-font-bold",
      "--lv-leading-tight",
      "--lv-leading-relaxed",
    ]) {
      expect(declared, `missing type token: ${t}`).toContain(t);
    }
  });

  test("ships a shadow ramp, z-index layers and motion tokens", () => {
    for (const t of [
      "--lv-shadow-xs",
      "--lv-shadow-lg",
      "--lv-shadow-xl",
      "--lv-z-dropdown",
      "--lv-z-overlay",
      "--lv-z-modal",
      "--lv-z-popover",
      "--lv-z-toast",
      "--lv-duration",
      "--lv-ease",
    ]) {
      expect(declared, `missing structural token: ${t}`).toContain(t);
    }
  });

  test("ships chart + sidebar palettes for data-viz and the app shell", () => {
    for (const t of [
      "--lv-color-chart-1",
      "--lv-color-chart-5",
      "--lv-color-sidebar",
      "--lv-color-sidebar-fg",
      "--lv-color-sidebar-accent",
    ]) {
      expect(declared, `missing palette token: ${t}`).toContain(t);
    }
  });

  test("ships icon sizing tokens consumed by the icon partial", () => {
    expect(declared).toContain("--lv-icon-size");
    expect(declared).toContain("--lv-icon-stroke");
  });

  test("has a dark-mode block selectable by .dark and [data-theme=dark]", () => {
    expect(tokensCss).toMatch(/\.dark\s*,\s*\[data-theme="dark"\]/);
  });

  test("dark mode re-points colours but NOT structural tokens (no drift, single source)", () => {
    const darkDeclared = new Set(
      [...darkBlock.matchAll(/(--lv-[a-z0-9-]+)\s*:/g)].map((m) => m[1])
    );
    // colours and shadows are re-pointed in dark
    expect(darkDeclared).toContain("--lv-color-bg");
    expect(darkDeclared).toContain("--lv-color-primary");
    // structural tokens are theme-invariant: declared once in :root, never repeated in dark
    for (const t of ["--lv-space-4", "--lv-radius", "--lv-text-base", "--lv-z-modal", "--lv-duration"]) {
      expect(rootDeclared, `${t} should be in :root`).toContain(t);
      expect(darkDeclared, `${t} must NOT be re-declared in dark`).not.toContain(t);
    }
  });

  test("every dark override targets a token that exists in :root (no orphan overrides)", () => {
    const darkNames = [...darkBlock.matchAll(/(--lv-[a-z0-9-]+)\s*:/g)].map((m) => m[1]);
    for (const name of darkNames) {
      expect(rootDeclared, `dark overrides unknown token ${name}`).toContain(name);
    }
  });
});
