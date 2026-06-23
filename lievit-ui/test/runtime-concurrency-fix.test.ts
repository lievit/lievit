/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LievitRuntime } from "../runtime/runtime.js";

/**
 * Real-runtime regression tests for the two silent lost-update races (#7 island-vs-whole-component,
 * #8 `.async` same-scope). They drive the REAL runtime in happy-dom with a deferred fetch so the
 * completion order of concurrent calls is controlled by the test, then assert the observable `@Wire`
 * mirror (`$lievit.$get`) and the rotated snapshot. Each test fails before its fix.
 */

/** Encodes a `wire` object into a JWT-like snapshot the runtime's `decodeWire` can read. */
function snapshotWith(wire: Record<string, unknown>): string {
  const payload = btoa(JSON.stringify({ cid: "cid", cls: "C", wire }))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `h.${payload}.sig`;
}

/** A fetch whose responses are released one at a time, so the test owns the completion order. */
function deferredFetch() {
  const gates: Array<(r: Response) => void> = [];
  const fetchImpl = vi.fn(
    (_url: URL | RequestInfo, init?: RequestInit) =>
      new Promise<Response>((resolve, reject) => {
        gates.push((r) => resolve(r));
        // Honor the abort signal like the real fetch (a superseded call rejects with an AbortError).
        init?.signal?.addEventListener("abort", () =>
          reject(new DOMException("aborted", "AbortError")),
        );
      }),
  );
  function release(i: number, html: string, headers: Record<string, string>): void {
    gates[i]!(new Response(html, { status: 200, headers }));
  }
  return { fetchImpl, release };
}

describe("runtime concurrency lost-update fixes (#7, #8)", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  // --- #7: an island re-render must not silently wipe a local edit made while it was in flight ---- //

  it("an in-flight island call does not clear a pending l:model edit committed on the component (#7)", async () => {
    // The component holds two fields. An island action goes on the wire; WHILE it is in flight the
    // user types into a different field. Before the fix the island's commit cleared the WHOLE pending
    // set (`pendingPaths.clear()` + delete every pendingUpdate), silently dropping the just-typed edit
    // even though the island response never addressed it. After the fix the island commit drops only
    // the paths IT sent, so the new edit survives to ride the NEXT call.
    const snap = snapshotWith({ list: "old", note: "" });
    document.body.innerHTML =
      `<div data-lievit-component="C" data-lievit-id="cid" data-lievit-snapshot="${snap}">` +
      `<input l:model="note">` +
      `<button data-island l:island.sidebar="reload">reload</button></div>`;
    const root = document.body.firstElementChild as HTMLElement;
    const { fetchImpl, release } = deferredFetch();
    const runtime = new LievitRuntime({ fetchImpl });
    runtime.start();

    // Fire the island action (bypasses the component commit queue, shares the one snapshot).
    (root.querySelector("[data-island]") as HTMLElement).click();
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(1));

    // While the island call is on the wire, the user types into `note` (a deferred l:model edit).
    const input = root.querySelector("input")!;
    input.value = "typed-while-inflight";
    input.dispatchEvent(new Event("input"));

    // The island response comes back: it re-rendered the sidebar and rotated the snapshot, knowing
    // nothing about `note` (its wire still has note="").
    release(
      0,
      `<div data-lievit-component="C" data-lievit-id="cid"><input l:model="note">` +
        `<button data-island l:island.sidebar="reload">reload</button></div>`,
      { "Lievit-Snapshot": snapshotWith({ list: "fresh", note: "" }) },
    );
    await vi.waitFor(() =>
      expect(runtime.$lievit(root)!.$get("list")).toBe("fresh"),
    );

    // The edit the user made while the island was in flight was NOT wiped: it is still the ephemeral
    // value (and still pending), so the next action carries it.
    expect(runtime.$lievit(root)!.$get("note")).toBe("typed-while-inflight");
  });

  // --- #8: a stateful `.async` action must not silently clobber @Wire state -------------------- //

  it("a .async action is renderless: its response never rotates the shared snapshot (#8)", async () => {
    // `.async` bypasses the commit queue to run in parallel; the markup advertises safe parallel
    // @Wire mutation it cannot deliver (no CAS on the snapshot). The fix restricts `.async` to
    // side-effect-only: its response is ignored for snapshot/@Wire purposes, so it cannot clobber.
    const snap = snapshotWith({ count: 1 });
    document.body.innerHTML =
      `<div data-lievit-component="C" data-lievit-id="cid" data-lievit-snapshot="${snap}">` +
      `<button l:async="ping">ping</button></div>`;
    const root = document.body.firstElementChild as HTMLElement;
    const { fetchImpl, release } = deferredFetch();
    const runtime = new LievitRuntime({ fetchImpl });
    // A lifecycle hook gives a deterministic "the call fully settled" signal (afterCall fires on both
    // the renderless and the legacy path), so the assertion does not race the async commit.
    let settled = false;
    runtime.use({ afterCall: () => (settled = true) });
    runtime.start();

    (root.querySelector("button") as HTMLElement).click();
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(1));

    // The .async response tries to assert count=999 AND rotate the snapshot. It must be ignored for
    // state: the snapshot does NOT rotate and the @Wire mirror stays the authoritative pre-call value.
    release(
      0,
      `<div data-lievit-component="C" data-lievit-id="cid"><button l:async="ping">ping</button></div>`,
      { "Lievit-Snapshot": snapshotWith({ count: 999 }) },
    );
    await vi.waitFor(() => expect(settled).toBe(true));

    // The shared snapshot was NOT rotated by the renderless .async response (pre-fix it rotated to
    // the count=999 token).
    expect(root.getAttribute("data-lievit-snapshot")).toBe(snap);
    // The @Wire mirror was not clobbered by the .async response (pre-fix it became 999).
    expect(runtime.$lievit(root)!.$get("count")).toBe(1);
  });

  it("a .async action still fires its side effects (dispatch event) (#8)", async () => {
    // Renderless does not mean inert: a side-effect-only action's effects (dispatch / redirect / js)
    // must still apply. This pins that the restriction is "no @Wire/render", not "no effects".
    const snap = snapshotWith({ count: 1 });
    document.body.innerHTML =
      `<div data-lievit-component="C" data-lievit-id="cid" data-lievit-snapshot="${snap}">` +
      `<button l:async="ping">ping</button></div>`;
    const root = document.body.firstElementChild as HTMLElement;
    const { fetchImpl, release } = deferredFetch();
    const runtime = new LievitRuntime({ fetchImpl });
    const seen: string[] = [];
    runtime.on("pinged", () => seen.push("pinged"));
    runtime.start();

    (root.querySelector("button") as HTMLElement).click();
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(1));
    release(
      0,
      `<div data-lievit-component="C" data-lievit-id="cid"><button l:async="ping">ping</button></div>`,
      { "Lievit-Snapshot": snap, "Lievit-Effects": '{"dispatch":[{"name":"pinged"}]}' },
    );
    await vi.waitFor(() => expect(seen).toContain("pinged"));
  });
});
