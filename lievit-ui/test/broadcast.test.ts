/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LievitRuntime } from "../runtime/runtime.js";
import {
  installBroadcast,
  parseBroadcastEvent,
  type BroadcastSource,
} from "../runtime/features/broadcast.js";

beforeEach(() => {
  document.body.innerHTML = "";
});

/** A fake broadcast source the test drives: it captures the handler and lets the test feed frames. */
function fakeSource(): {
  source: BroadcastSource;
  push: (data: string) => void;
  closed: () => boolean;
} {
  let handler: ((data: string) => void) | undefined;
  let isClosed = false;
  return {
    source: {
      onMessage(h) {
        handler = h;
        return () => {
          isClosed = true;
        };
      },
    },
    push: (data) => handler?.(data),
    closed: () => isClosed,
  };
}

describe("broadcast event parsing (#304/#45)", () => {
  it("parses a valid broadcast envelope (name + detail + optional routing)", () => {
    expect(parseBroadcastEvent('{"name":"saved","detail":{"id":7}}')).toEqual({
      name: "saved",
      detail: { id: 7 },
    });
    expect(parseBroadcastEvent('{"name":"ping"}')).toEqual({ name: "ping" });
    expect(parseBroadcastEvent('{"name":"saved","to":"com.example.Bell"}')).toEqual({
      name: "saved",
      to: "com.example.Bell",
    });
  });

  it("rejects a frame that is not a valid envelope (no name, not JSON)", () => {
    expect(parseBroadcastEvent("not json")).toBeNull();
    expect(parseBroadcastEvent('{"detail":{}}')).toBeNull();
    expect(parseBroadcastEvent('{"name":123}')).toBeNull();
    expect(parseBroadcastEvent(":heartbeat")).toBeNull(); // an SSE comment / heartbeat is ignored
  });
});

describe("installBroadcast (#304 live push, #45 echo listener bridge)", () => {
  it("re-emits a pushed event on window and on the runtime JS bus", () => {
    const { source, push } = fakeSource();
    const rt = new LievitRuntime();
    installBroadcast(rt, { source });

    const onWindow = vi.fn();
    window.addEventListener("lievit-admin-notify", onWindow as EventListener);
    const onBus = vi.fn();
    rt.on("lievit-admin-notify", onBus);

    push('{"name":"lievit-admin-notify","detail":{"title":"Assigned to you"}}');

    expect(onWindow).toHaveBeenCalledOnce();
    expect((onWindow.mock.calls[0]![0] as CustomEvent).detail).toEqual({
      title: "Assigned to you",
    });
    expect(onBus).toHaveBeenCalledWith({ title: "Assigned to you" });
  });

  it("delivers a per-user bell-refresh to the mounted bell component over the wire (#304 live bell)", async () => {
    document.body.innerHTML =
      '<div data-lievit-component="com.example.Bell" data-lievit-id="bell" data-lievit-snapshot="s0">' +
      '<span>0</span></div>';
    const fetchImpl = vi.fn(
      async () =>
        new Response('<div data-lievit-component="com.example.Bell"><span>1</span></div>', {
          status: 200,
          headers: { "Lievit-Snapshot": "s1" },
        }),
    ) as unknown as typeof fetch;

    const { source, push } = fakeSource();
    const rt = new LievitRuntime({ fetchImpl });
    rt.start();
    installBroadcast(rt, { source });

    push('{"name":"lievit-notifications-refresh","to":"com.example.Bell"}');
    await new Promise((r) => setTimeout(r, 0));

    // The bell received the pushed event as a wire call carrying it in _events (server re-runs @LievitOn).
    expect(fetchImpl).toHaveBeenCalledOnce();
    const init = (fetchImpl as unknown as { mock: { calls: [string, RequestInit][] } }).mock
      .calls[0]![1];
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body._events).toEqual([{ name: "lievit-notifications-refresh", detail: null }]);
  });

  it("unsubscribes (closes the source) when the page navigates away", () => {
    const { source, closed } = fakeSource();
    const rt = new LievitRuntime();
    installBroadcast(rt, { source });

    expect(closed()).toBe(false);
    window.dispatchEvent(new CustomEvent("lievit:navigate"));
    expect(closed()).toBe(true);
  });

  it("ignores a malformed frame without throwing", () => {
    const { source, push } = fakeSource();
    const rt = new LievitRuntime();
    const onBus = vi.fn();
    rt.on("x", onBus);
    installBroadcast(rt, { source });

    expect(() => push("garbage")).not.toThrow();
    expect(onBus).not.toHaveBeenCalled();
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});
