/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
import { describe, expect, it, vi } from "vitest";

import {
  applyEffects,
  consumeEffectsHeader,
  parseEffects,
} from "../runtime/effects.js";

describe("effects channel client (ADR-0012)", () => {
  it("treats a missing header as no effects (backward compatible)", () => {
    expect(parseEffects(null)).toBeNull();
    expect(parseEffects(undefined)).toBeNull();
    expect(parseEffects("")).toBeNull();
    // a no-op: nothing thrown, no navigation
    expect(() => applyEffects(null)).not.toThrow();
  });

  it("parses the redirect effect and navigates", () => {
    const navigate = vi.fn();
    const effects = parseEffects('{"redirect":"/done"}');

    expect(effects?.redirect).toBe("/done");
    applyEffects(effects, window, navigate);
    expect(navigate).toHaveBeenCalledWith("/done");
  });

  it("re-emits a dispatched event as a window CustomEvent the client receives", () => {
    const received: CustomEvent[] = [];
    const target = new EventTarget();
    target.addEventListener("saved", (e) => received.push(e as CustomEvent));

    consumeEffectsHeader('{"dispatch":[{"name":"saved","detail":{"id":7}}]}', target, vi.fn());

    expect(received).toHaveLength(1);
    expect(received[0].type).toBe("saved");
    expect(received[0].detail).toEqual({ id: 7 });
  });

  it("dispatches before redirecting so listeners react before navigation", () => {
    const order: string[] = [];
    const target = new EventTarget();
    target.addEventListener("saved", () => order.push("dispatched"));
    const navigate = vi.fn(() => order.push("navigated"));

    applyEffects(
      { dispatch: [{ name: "saved" }], redirect: "/done" },
      target,
      navigate,
    );

    expect(order).toEqual(["dispatched", "navigated"]);
  });

  it("exposes a return value with no DOM effect", () => {
    const navigate = vi.fn();
    const effects = consumeEffectsHeader('{"returns":42}', window, navigate);

    expect(effects?.returns).toBe(42);
    expect(navigate).not.toHaveBeenCalled();
  });
});
