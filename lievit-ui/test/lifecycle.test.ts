/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
import { describe, expect, it, vi } from "vitest";

import { LifecycleBus, type ComponentContext } from "../runtime/lifecycle.js";

const ctx: ComponentContext = { root: document.createElement("div"), componentId: "C1" };

describe("lifecycle bus (extension point)", () => {
  it("fires registered hooks in order across phases", () => {
    const order: string[] = [];
    const bus = new LifecycleBus();
    bus.register({
      beforeCall: () => order.push("before"),
      afterCall: () => order.push("after"),
    });

    bus.beforeCall({ ...ctx, calls: ["go"], updates: {} });
    bus.afterCall({ ...ctx, status: 200, ok: true, reason: null });

    expect(order).toEqual(["before", "after"]);
  });

  it("isolates a throwing hook so the call is never aborted", () => {
    const reported: string[] = [];
    const bus = new LifecycleBus((phase) => reported.push(phase));
    const ran = vi.fn();
    bus.register({
      beforeCall: () => {
        throw new Error("buggy indicator");
      },
    });
    bus.register({ beforeCall: ran });

    expect(() => bus.beforeCall({ ...ctx, calls: [], updates: {} })).not.toThrow();
    expect(reported).toEqual(["beforeCall"]); // the throw was reported
    expect(ran).toHaveBeenCalledOnce(); // the next hook still ran
  });

  it("unsubscribes a hook on the returned disposer", () => {
    const bus = new LifecycleBus();
    const seen = vi.fn();
    const off = bus.register({ onModelChange: seen });

    bus.modelChange(ctx, "f", 1);
    off();
    bus.modelChange(ctx, "f", 2);

    expect(seen).toHaveBeenCalledOnce();
  });
});
