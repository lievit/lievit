/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
import { describe, test, expect } from "vitest";
import {
  resolve,
  collectNpmDependencies,
  type Registry,
  type RegistryItem,
} from "../cli/registry.js";

function item(
  name: string,
  registryDependencies: string[] = [],
  dependencies: string[] = []
): RegistryItem {
  return {
    name,
    type: "registry:ui",
    description: name,
    dependencies,
    registryDependencies,
    files: [{ path: `components/${name}/${name}.ts`, type: "registry:ui", target: `components/ui/${name}.ts` }],
    tokens: [],
    docs: "",
  };
}

function registryOf(...items: RegistryItem[]): Registry {
  return { name: "test", homepage: "x", items };
}

describe("resolve", () => {
  test("returns a single item with no dependencies", () => {
    const reg = registryOf(item("badge"));
    expect(resolve(reg, ["badge"]).map((i) => i.name)).toEqual(["badge"]);
  });

  test("includes transitive registryDependencies, dependency before dependent", () => {
    const reg = registryOf(
      item("button", ["tokens", "light-dom"]),
      item("tokens"),
      item("light-dom")
    );
    const order = resolve(reg, ["button"]).map((i) => i.name);
    expect(order).toContain("tokens");
    expect(order).toContain("light-dom");
    expect(order.indexOf("tokens")).toBeLessThan(order.indexOf("button"));
    expect(order.indexOf("light-dom")).toBeLessThan(order.indexOf("button"));
  });

  test("de-duplicates a dependency shared by two requested items", () => {
    const reg = registryOf(
      item("button", ["tokens"]),
      item("input", ["tokens"]),
      item("tokens")
    );
    const order = resolve(reg, ["button", "input"]).map((i) => i.name);
    expect(order.filter((n) => n === "tokens")).toHaveLength(1);
  });

  test("is cycle-safe (a -> b -> a does not loop)", () => {
    const reg = registryOf(item("a", ["b"]), item("b", ["a"]));
    const order = resolve(reg, ["a"]).map((i) => i.name);
    expect(order.sort()).toEqual(["a", "b"]);
  });

  test("throws on an unknown name", () => {
    const reg = registryOf(item("badge"));
    expect(() => resolve(reg, ["nope"])).toThrow(/unknown registry item: nope/);
  });

  test("throws on a dangling registryDependencies edge", () => {
    const reg = registryOf(item("button", ["missing"]));
    expect(() => resolve(reg, ["button"])).toThrow(/unknown registry item: missing/);
  });
});

describe("collectNpmDependencies", () => {
  test("unions and sorts deps across items, de-duplicated", () => {
    const items = [item("button", [], ["lit"]), item("chart", [], ["d3", "lit"])];
    expect(collectNpmDependencies(items)).toEqual(["d3", "lit"]);
  });

  test("returns empty for items with no npm deps", () => {
    expect(collectNpmDependencies([item("tokens")])).toEqual([]);
  });
});
