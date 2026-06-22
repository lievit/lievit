/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LievitRuntime, startLievit } from "../runtime/index.js";
import { installAllFeatures } from "../runtime/features/index.js";

/**
 * Runtime regression net for the two client-island wire bugs that escaped every test because no test
 * exercised the boot ORDER + the morph's treatment of client-owned bind markers in a real DOM. Both
 * surfaced first in an adopter (gest's server-first calendar), but they are RUNTIME bugs, so the
 * regression lives here, against the real {@link LievitRuntime} + morph + features:
 *
 *  - BUG 1 (empty on entry / init never fires): a deferred-module page bundle runs after
 *    DOMContentLoaded, so the runtime scans the DOM SYNCHRONOUSLY on start(); an `l:init` directive
 *    registered AFTER the scan was invisible to it, so a deferred-paint skeleton's `l:init="load"`
 *    silently no-opped and the component stayed empty on mount. Fixed: {@link startLievit} takes a
 *    `register` callback that installs features BEFORE the first scan. The second describe locks the
 *    order via the real entry point.
 *  - BUG 2 (click loop / stacked listeners): the morph stripped the client-only directive bind
 *    markers (`data-lievit-bound-*`, `data-lievit-init-fired`) on every re-render (the server never
 *    authors them, so a naive "remove what the new markup dropped" reconcile deleted them); the
 *    post-morph re-scan then re-bound the directive and STACKED a duplicate listener (one click -> N
 *    wire calls; an `l:init` re-fired in a loop). Fixed: the morph preserves the client-owned markers.
 *    The first describe locks one-call-per-click + at-most-one init fire.
 */

const COMPONENT = "com.example.Deferred";

function rootOpen(snapshot: string): string {
  return `<div data-lievit-component="${COMPONENT}" data-lievit-id="cid" data-lievit-snapshot="${snapshot}">`;
}

// The not-loaded body the server renders on mount: a skeleton carrying l:init="load" + nav buttons.
function skeletonBody(snapshot: string): string {
  return (
    `${rootOpen(snapshot)}` +
    `<button l:click="next" data-next>next</button>` +
    `<div data-skeleton l:init="load"></div></div>`
  );
}

// The loaded body the server renders once loaded=true: the real content (no skeleton, no l:init).
function loadedBody(snapshot: string, count: number): string {
  return (
    `${rootOpen(snapshot)}` +
    `<button l:click="next" data-next>next</button>` +
    `<div data-content>${count}</div></div>`
  );
}

describe("runtime: l:init paint + l:click rebind (BUG 1 + BUG 2 regression)", () => {
  let runtime: LievitRuntime;
  let calls: Array<{ calls: string[] }>;
  let count: number;

  beforeEach(() => {
    calls = [];
    count = 0;
    document.body.innerHTML = skeletonBody("snap-0");

    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body)) as { _calls?: string[] };
      const c = body._calls ?? [];
      calls.push({ calls: c });
      if (c.includes("next")) count += 1;
      // Once load (or any nav) fired, the server renders the LOADED body (loaded=true).
      const html = loadedBody("snap-1", count);
      return new Response(html, { status: 200, headers: { "Lievit-Snapshot": "snap-1" } });
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    runtime = new LievitRuntime({ csrfToken: "t", csrfHeader: "X-CSRF-TOKEN" });
    installAllFeatures(runtime);
    runtime.start(document.body);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  // Let microtasks (l:init queueMicrotask) + the awaited fetch settle.
  async function settle(): Promise<void> {
    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  it("BUG 1: the content paints on mount (l:init fires load) without any user click", async () => {
    await settle();
    expect(document.querySelector("[data-content]"), "content must paint after mount").not.toBeNull();
    expect(document.querySelector("[data-skeleton]"), "skeleton must be gone after load").toBeNull();
  });

  it("BUG 1+loop: l:init fires load exactly once on mount (no init re-fire loop)", async () => {
    await settle();
    const loadCalls = calls.filter((c) => c.calls.includes("load"));
    expect(loadCalls.length, "load must fire exactly once on mount").toBe(1);
  });

  it("morph preserves the client-owned init-fired marker across re-render", async () => {
    await settle();
    // After load morphed in the loaded body, the init-fired marker the runtime stamped must survive
    // (the morph must NOT strip it just because the server's new markup never carries it).
    const root = document.querySelector(`[data-lievit-component="${COMPONENT}"]`) as Element;
    expect(root, "component root present").not.toBeNull();
    // No second load fired after the morph (a stripped marker would let a re-scan re-fire init).
    const settled = calls.length;
    await settle();
    expect(calls.length, "no further wire calls after settle (no init re-fire)").toBe(settled);
  });

  it("BUG 2: clicking next sends exactly one wire call per click (no stacked listeners)", async () => {
    await settle();
    const before = calls.length;
    (document.querySelector("[data-next]") as HTMLElement).click();
    await settle();
    const nextCalls = calls.slice(before).filter((c) => c.calls.includes("next"));
    expect(nextCalls.length, "one click on next => exactly one next wire call").toBe(1);
  });

  it("BUG 2: repeated clicks stay one-call-per-click after several morphs", async () => {
    await settle();
    let before = calls.length;
    for (let i = 0; i < 3; i++) {
      (document.querySelector("[data-next]") as HTMLElement).click();
      await settle();
      const sent = calls.slice(before).filter((c) => c.calls.includes("next")).length;
      expect(sent, `click ${i + 1} => exactly one next call (no duplicate handlers)`).toBe(1);
      before = calls.length;
    }
  });

  it("BUG 2: no stray wire calls keep firing after a click settles (no loop)", async () => {
    await settle();
    (document.querySelector("[data-next]") as HTMLElement).click();
    await settle();
    const settledCount = calls.length;
    await settle();
    expect(calls.length, "no wire calls fire after the click settles").toBe(settledCount);
  });
});

describe("runtime: startLievit register callback installs features before the first scan (BUG 1 root)", () => {
  // The page bundle is a deferred module script: by the time it runs, document.readyState is no
  // longer "loading", so startLievit() scans the DOM SYNCHRONOUSLY. The register callback must run
  // BEFORE that scan so the `init` directive is registered when the skeleton's l:init is seen; the
  // old shape (startLievit(opts) THEN installAllFeatures(rt)) registered after the scan and the grid
  // stayed empty on mount (BUG 1). This locks the register-callback order via the real entry point.
  let calls: Array<{ calls: string[] }>;

  beforeEach(() => {
    calls = [];
    document.body.innerHTML =
      `<div data-lievit-component="${COMPONENT}" data-lievit-id="cid2" data-lievit-snapshot="s0">` +
      `<div data-skeleton l:init="load"></div></div>`;
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body)) as { _calls?: string[] };
      calls.push({ calls: body._calls ?? [] });
      const html =
        `<div data-lievit-component="${COMPONENT}" data-lievit-id="cid2" data-lievit-snapshot="s1">` +
        `<div data-content>ok</div></div>`;
      return new Response(html, { status: 200, headers: { "Lievit-Snapshot": "s1" } });
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  it("BUG 1: l:init paints on mount when startLievit registers features first", async () => {
    // readyState is "complete" in the test DOM (the deferred-module case), so start() runs
    // synchronously inside startLievit; the register callback must have installed `init` before it.
    startLievit({ csrfToken: "t", csrfHeader: "X-CSRF-TOKEN" }, (rt) => installAllFeatures(rt));
    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
      await new Promise((r) => setTimeout(r, 0));
    }
    expect(calls.some((c) => c.calls.includes("load")), "l:init must fire load on mount").toBe(true);
    expect(document.querySelector("[data-content]"), "content must paint on mount").not.toBeNull();
  });
});
