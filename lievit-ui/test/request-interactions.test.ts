/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LievitRuntime } from "../runtime/runtime.js";

/** A LievitRuntime whose re-mount is observable instead of reloading the page. */
class TestRuntime extends LievitRuntime {
  remounted = false;
  protected override remount(): void {
    this.remounted = true;
  }
}

/**
 * A fetch double that never resolves on its own: each call parks a deferred the test settles by
 * hand. It honors the abort signal (rejecting with an `AbortError`, like the real fetch), so a
 * superseded in-flight call surfaces as the runtime sees it. Records the headers of every call.
 */
function deferredFetch() {
  const calls: { resolve: (html: string, snapshot: string) => void; aborted: boolean; signal?: AbortSignal }[] = [];
  const fetchImpl = vi.fn((_url: URL | RequestInfo, init?: RequestInit) => {
    const signal = init?.signal ?? undefined;
    const entry = { aborted: false, signal } as (typeof calls)[number] & { resolve: (h: string, s: string) => void };
    return new Promise<Response>((resolve, reject) => {
      entry.resolve = (html, snapshot) => resolve(new Response(html, { status: 200, headers: { "Lievit-Snapshot": snapshot } }));
      if (signal != null) {
        signal.addEventListener("abort", () => {
          entry.aborted = true;
          reject(new DOMException("aborted", "AbortError"));
        });
      }
      calls.push(entry as (typeof calls)[number]);
    });
  });
  return { fetchImpl, calls };
}

function mount(id: string, snapshot = "s1"): HTMLElement {
  const el = document.createElement("div");
  el.setAttribute("data-lievit-component", "com.example.C");
  el.setAttribute("data-lievit-id", id);
  el.setAttribute("data-lievit-snapshot", snapshot);
  el.innerHTML = `<button l:click="act">go</button>`;
  document.body.appendChild(el);
  return el;
}

describe("request interactions: per-scope concurrency matrix (#95)", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("a user action cancels an in-flight poll for the same component scope", async () => {
    const { fetchImpl, calls } = deferredFetch();
    const root = mount("cid");
    const runtime = new TestRuntime({ fetchImpl });
    runtime.start();

    void runtime.refresh(root, { poll: true });
    await vi.waitFor(() => expect(calls.length).toBe(1));

    void runtime.callAction(root, "act");
    await vi.waitFor(() => expect(calls.length).toBe(2));

    expect(calls[0].aborted).toBe(true); // the poll's fetch was aborted
    expect(calls[1].aborted).toBe(false); // the user action proceeds
  });

  it("a poll never cancels an in-flight user action; the poll is dropped (no new fetch)", async () => {
    const { fetchImpl, calls } = deferredFetch();
    const root = mount("cid");
    const runtime = new TestRuntime({ fetchImpl });
    runtime.start();

    void runtime.callAction(root, "act");
    await vi.waitFor(() => expect(calls.length).toBe(1));

    void runtime.refresh(root, { poll: true });
    // give the microtask queue a chance: a dropped poll issues no fetch.
    await Promise.resolve();
    await Promise.resolve();

    expect(calls.length).toBe(1);
    expect(calls[0].aborted).toBe(false);
  });

  it("a later poll cancels an earlier in-flight poll for the same scope", async () => {
    const { fetchImpl, calls } = deferredFetch();
    const root = mount("cid");
    const runtime = new TestRuntime({ fetchImpl });
    runtime.start();

    void runtime.refresh(root, { poll: true });
    await vi.waitFor(() => expect(calls.length).toBe(1));
    void runtime.refresh(root, { poll: true });
    await vi.waitFor(() => expect(calls.length).toBe(2));

    expect(calls[0].aborted).toBe(true);
    expect(calls[1].aborted).toBe(false);
  });

  it("a user action does NOT cancel a different component's in-flight poll (distinct scopes)", async () => {
    const { fetchImpl, calls } = deferredFetch();
    const rootA = mount("cidA");
    const rootB = mount("cidB");
    const runtime = new TestRuntime({ fetchImpl });
    runtime.start();

    void runtime.refresh(rootA, { poll: true });
    await vi.waitFor(() => expect(calls.length).toBe(1));
    void runtime.callAction(rootB, "act");
    await vi.waitFor(() => expect(calls.length).toBe(2));

    expect(calls[0].aborted).toBe(false); // component A's poll is untouched by component B's action
  });

  it("a user action cancels an in-flight poll on the SAME component but a different island runs free", async () => {
    const { fetchImpl, calls } = deferredFetch();
    const root = mount("cid");
    const runtime = new TestRuntime({ fetchImpl });
    runtime.start();

    // whole-component poll in flight
    void runtime.refresh(root, { poll: true });
    await vi.waitFor(() => expect(calls.length).toBe(1));
    // an island-targeted action on the same component is a DIFFERENT scope: it must not abort the poll
    void runtime.callIsland(root, "act", "sidebar");
    await vi.waitFor(() => expect(calls.length).toBe(2));

    expect(calls[0].aborted).toBe(false);
  });

  it("the request hook can inject a custom header onto the outgoing call", async () => {
    const { fetchImpl } = deferredFetch();
    const root = mount("cid");
    const runtime = new TestRuntime({ fetchImpl });
    runtime.start();
    runtime.intercept({
      onSend: (req) => {
        req.headers["X-Custom"] = "42";
      },
    });

    void runtime.callAction(root, "act");
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalled());

    const init = (fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect((init.headers as Record<string, string>)["X-Custom"]).toBe("42");
  });
});
