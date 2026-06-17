/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildRegistry, serializeRegistry } from "../cli/build-registry.js";
import { resolve, type Registry } from "../cli/registry.js";

const registryRoot = join(import.meta.dirname, "..", "registry");
const built = buildRegistry(registryRoot);

const TIER_1 = [
  "button",
  "input",
  "textarea",
  "label",
  "badge",
  "card",
  "separator",
  "spinner",
  "alert",
];

const TIER_2 = [
  "checkbox",
  "select",
  "switch",
  "field",
  "toast",
  "tooltip",
  "progress",
];

describe("built registry.json", () => {
  test("ships every tier-1 primitive the research flagged", () => {
    const names = new Set(built.items.map((i) => i.name));
    for (const t of TIER_1) {
      expect(names, `missing tier-1 component: ${t}`).toContain(t);
    }
  });

  test("ships every tier-2 component", () => {
    const names = new Set(built.items.map((i) => i.name));
    for (const t of TIER_2) {
      expect(names, `missing tier-2 component: ${t}`).toContain(t);
    }
  });

  test("ships the tokens and light-dom base items", () => {
    const names = built.items.map((i) => i.name);
    expect(names).toContain("tokens");
    expect(names).toContain("light-dom");
  });

  test("every file declares non-empty inlined content with an Apache header", () => {
    for (const item of built.items) {
      for (const file of item.files) {
        expect(file.content, `${item.name}/${file.path} has no content`).toBeTruthy();
        expect(
          file.content,
          `${item.name}/${file.path} missing Apache header`
        ).toContain("Licensed under the Apache License, Version 2.0");
      }
    }
  });

  test("every registryDependency edge resolves to a known item", () => {
    const names = new Set(built.items.map((i) => i.name));
    for (const item of built.items) {
      for (const dep of item.registryDependencies) {
        expect(names, `${item.name} depends on unknown ${dep}`).toContain(dep);
      }
    }
  });

  test("resolving any tier-1 component succeeds and pulls in its tokens", () => {
    for (const t of TIER_1) {
      const closure = resolve(built, [t]).map((i) => i.name);
      expect(closure, `${t} should pull tokens`).toContain("tokens");
    }
  });

  test("every component references --lv-* tokens, never a hardcoded hex value", () => {
    for (const item of built.items) {
      if (item.type !== "registry:ui") {
        continue;
      }
      for (const file of item.files) {
        // the css lives in a `static readonly css` block; assert it uses var(--lv-*)
        // and contains no raw hex colour (#rrggbb / #rgb), which would bypass tokens.
        const css = file.content ?? "";
        expect(css, `${item.name} should use --lv-* tokens`).toMatch(/var\(--lv-/);
        const hex = css.match(/#[0-9a-fA-F]{3,8}\b/);
        // #fff is allowed nowhere: tokens carry every colour. Flag any hardcoded hex.
        expect(hex, `${item.name} hardcodes a colour: ${hex?.[0]}`).toBeNull();
      }
    }
  });

  test("the committed registry.json matches a fresh build (no drift)", () => {
    const committed = readFileSync(join(registryRoot, "registry.json"), "utf8");
    expect(committed).toBe(serializeRegistry(built));
  });

  test("is shaped as a valid Registry (name, homepage, items[])", () => {
    const reg: Registry = built;
    expect(reg.name).toBe("lievit-ui");
    expect(reg.homepage).toMatch(/^https?:\/\//);
    expect(Array.isArray(reg.items)).toBe(true);
    expect(reg.items.length).toBeGreaterThanOrEqual(TIER_1.length + 2);
  });
});
