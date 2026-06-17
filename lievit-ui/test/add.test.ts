/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
import { describe, test, expect } from "vitest";
import { planAdd } from "../cli/add.js";
import type { Registry } from "../cli/registry.js";

const registry: Registry = {
  name: "test",
  homepage: "x",
  items: [
    {
      name: "tokens",
      type: "registry:tokens",
      description: "tokens",
      dependencies: [],
      registryDependencies: [],
      files: [{ path: "tokens/lievit-tokens.css", type: "registry:tokens", target: "styles/lievit-tokens.css", content: ":root{}" }],
      tokens: [],
      docs: "import the css",
    },
    {
      name: "light-dom",
      type: "registry:lib",
      description: "helper",
      dependencies: [],
      registryDependencies: [],
      files: [{ path: "components/light-dom/light-dom.ts", type: "registry:lib", target: "components/ui/light-dom.ts", content: "export {}" }],
      tokens: [],
      docs: "",
    },
    {
      name: "button",
      type: "registry:ui",
      description: "button",
      dependencies: ["lit"],
      registryDependencies: ["tokens", "light-dom"],
      files: [{ path: "components/button/button.ts", type: "registry:ui", target: "components/ui/button.ts", content: "// button" }],
      tokens: ["color"],
      docs: "register lv-button",
    },
  ],
};

describe("planAdd", () => {
  test("plans copies for the component and its transitive deps under the alias root", () => {
    const plan = planAdd(registry, ["button"], { root: "src" }, new Set());
    expect(plan.actions.map((a) => `${a.kind} ${a.dest}`)).toEqual([
      "copy src/styles/lievit-tokens.css",
      "copy src/components/ui/light-dom.ts",
      "copy src/components/ui/button.ts",
    ]);
  });

  test("collects npm dependencies of the closure", () => {
    const plan = planAdd(registry, ["button"], { root: "src" }, new Set());
    expect(plan.npmDependencies).toEqual(["lit"]);
  });

  test("emits docs only for items that declare them", () => {
    const plan = planAdd(registry, ["button"], { root: "src" }, new Set());
    expect(plan.docs).toEqual(["tokens: import the css", "button: register lv-button"]);
  });

  test("skips an existing destination by default (owned-edit safety)", () => {
    const existing = new Set(["src/components/ui/button.ts"]);
    const plan = planAdd(registry, ["button"], { root: "src" }, existing);
    const button = plan.actions.find((a) => a.dest.endsWith("button.ts"));
    expect(button?.kind).toBe("skip");
  });

  test("overwrites an existing destination when overwrite is set", () => {
    const existing = new Set(["src/components/ui/button.ts"]);
    const plan = planAdd(registry, ["button"], { root: "src" }, existing, true);
    const button = plan.actions.find((a) => a.dest.endsWith("button.ts"));
    expect(button?.kind).toBe("overwrite");
  });

  test("an empty alias root leaves target paths unprefixed", () => {
    const plan = planAdd(registry, ["tokens"], { root: "" }, new Set());
    expect(plan.actions[0].dest).toBe("styles/lievit-tokens.css");
  });
});
