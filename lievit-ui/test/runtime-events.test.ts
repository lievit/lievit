/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LievitRuntime } from "../runtime/runtime.js";

/** Mounts a dispatcher component (A) and a listener component (B) of distinct names. */
function mountPair(): { a: HTMLElement; b: HTMLElement } {
  document.body.innerHTML =
    '<div data-lievit-component="com.example.A" data-lievit-id="a" data-lievit-snapshot="sa">' +
    '<button l:click="save">save</button></div>' +
    '<div data-lievit-component="com.example.B" data-lievit-id="b" data-lievit-snapshot="sb">' +
    "<span>B</span></div>";
  const [a, b] = Array.from(document.body.children) as HTMLElement[];
  return { a, b };
}

function ok(componentName: string, headers: Record<string, string> = {}): Response {
  return new Response(`<div data-lievit-component="${componentName}"></div>`, {
    status: 200,
    headers,
  });
}

function bodyOf(call: unknown): Record<string, unknown> {
  const init = (call as [string, RequestInit])[1];
  return JSON.parse(init.body as string) as Record<string, unknown>;
}

function urlOf(call: unknown): string {
  return (call as [string])[0];
}

describe("LievitRuntime event delivery (#43, ADR-0030)", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("routes a global dispatch from A to B as an _events wire call", async () => {
    const { a } = mountPair();
    const fetchImpl = vi.fn(async (input: URL | RequestInfo) => {
      // A's save action returns a global dispatch; B's delivery returns a plain re-render.
      const url = String(input);
      if (url.includes("/a/")) {
        return ok("com.example.A", {
          "Lievit-Effects": '{"dispatch":[{"name":"saved","detail":{"id":3}}]}',
        });
      }
      return ok("com.example.B");
    });
    const runtime = new LievitRuntime({ fetchImpl });
    runtime.start();

    (a.querySelector("button") as HTMLElement).click();

    await vi.waitFor(() => {
      const bCall = fetchImpl.mock.calls.find((c) => urlOf(c).includes("/b/"));
      expect(bCall).toBeDefined();
    });
    const bCall = fetchImpl.mock.calls.find((c) => urlOf(c).includes("/b/"))!;
    expect(bodyOf(bCall)._events).toEqual([{ name: "saved", detail: { id: 3 } }]);
    // A does not receive its own global dispatch (no second /a/ call carrying _events).
    const aEventCalls = fetchImpl.mock.calls.filter(
      (c) => urlOf(c).includes("/a/") && bodyOf(c)._events != null,
    );
    expect(aEventCalls).toHaveLength(0);
  });

  it("invokes a JS listener registered via runtime.on with the event detail", async () => {
    const { a } = mountPair();
    let first = true;
    const fetchImpl = vi.fn(async () => {
      if (first) {
        first = false;
        return ok("com.example.A", {
          "Lievit-Effects": '{"dispatch":[{"name":"ping","detail":{"n":1}}]}',
        });
      }
      return ok("com.example.B");
    });
    const runtime = new LievitRuntime({ fetchImpl });
    runtime.start();
    const seen: unknown[] = [];
    runtime.on("ping", (detail) => seen.push(detail));

    (a.querySelector("button") as HTMLElement).click();

    await vi.waitFor(() => expect(seen).toHaveLength(1));
    expect(seen[0]).toEqual({ n: 1 });
  });

  it("routes dispatchSelf only back to the dispatching component", async () => {
    const { a } = mountPair();
    // Only the first call (the action) emits the self event; the delivery re-render is clean, so
    // there is no dispatch loop.
    let first = true;
    const fetchImpl = vi.fn(async () => {
      if (first) {
        first = false;
        return ok("com.example.A", {
          "Lievit-Effects": '{"dispatch":[{"name":"tick","self":true}]}',
        });
      }
      return ok("com.example.A");
    });
    const runtime = new LievitRuntime({ fetchImpl });
    runtime.start();

    (a.querySelector("button") as HTMLElement).click();

    // The self event delivers an _events call back to A, never to B.
    await vi.waitFor(() => {
      const selfDelivery = fetchImpl.mock.calls.find(
        (c) => urlOf(c).includes("/a/") && bodyOf(c)._events != null,
      );
      expect(selfDelivery).toBeDefined();
    });
    const bCall = fetchImpl.mock.calls.find((c) => urlOf(c).includes("/b/"));
    expect(bCall).toBeUndefined();
  });
});
