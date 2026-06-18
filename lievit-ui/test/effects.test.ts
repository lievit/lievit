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

  it("triggers a browser download for the download effect, decoding name + content + type (#161)", () => {
    const downloads: { name: string; content: string; type: string }[] = [];
    const content = btoa("id,name\n1,a\n");
    const effects = parseEffects(
      JSON.stringify({ download: { name: "export.csv", content, type: "text/csv" } }),
    );

    applyEffects(effects, window, vi.fn(), (d) => downloads.push(d));

    expect(downloads).toHaveLength(1);
    expect(downloads[0].name).toBe("export.csv");
    expect(downloads[0].type).toBe("text/csv");
    expect(atob(downloads[0].content)).toBe("id,name\n1,a\n");
  });

  it("triggers the download before redirecting (download is additive, not a swap) (#161)", () => {
    const order: string[] = [];
    const navigate = vi.fn(() => order.push("navigated"));
    applyEffects(
      { download: { name: "a.txt", content: btoa("x"), type: "text/plain" }, redirect: "/done" },
      window,
      navigate,
      () => order.push("downloaded"),
    );

    expect(order).toEqual(["downloaded", "navigated"]);
  });

  it("does not download when the action returned nothing (#161)", () => {
    const trigger = vi.fn();
    applyEffects(parseEffects('{"returns":1}'), window, vi.fn(), trigger);
    expect(trigger).not.toHaveBeenCalled();
  });
});
