/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
import { describe, expect, it, vi } from "vitest";

import { JsRegistry } from "../runtime/js-registry.js";

describe("CSP-safe $js registry (ADR-0024 #131)", () => {
  it("invokes a registered handler by name with args and context", () => {
    const reg = new JsRegistry();
    const root = document.createElement("div");
    const fn = vi.fn(() => 42);
    reg.register("answer", fn);
    const result = reg.invoke("answer", [1, 2], { root });
    expect(fn).toHaveBeenCalledWith([1, 2], { root });
    expect(result).toBe(42);
  });

  it("treats an unknown name as a logged no-op, never an eval", () => {
    const onMissing = vi.fn();
    const reg = new JsRegistry(onMissing);
    const result = reg.invoke("nope", []);
    expect(onMissing).toHaveBeenCalledWith("nope");
    expect(result).toBeUndefined();
  });

  it("applies a js effect list in order", () => {
    const reg = new JsRegistry();
    const calls: string[] = [];
    reg.register("a", () => calls.push("a"));
    reg.register("b", () => calls.push("b"));
    reg.applyEffect([{ name: "a" }, { name: "b" }, { name: "a" }]);
    expect(calls).toEqual(["a", "b", "a"]);
  });

  it("unsubscribe removes the handler", () => {
    const reg = new JsRegistry(() => {});
    const off = reg.register("x", () => "v");
    expect(reg.has("x")).toBe(true);
    off();
    expect(reg.has("x")).toBe(false);
  });
});
