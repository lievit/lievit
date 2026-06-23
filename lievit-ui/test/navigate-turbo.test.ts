/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * The Turbo Drive glue (ADR-0085). lievit retired its hand-rolled SPA navigation and adopted Turbo
 * Drive; `installNavigate` is now the thin residual glue this suite pins:
 *
 *  1. **wire re-bind after a swap** — on `turbo:load`, the glue re-runs `runtime.start(document.body)`
 *     so a wire component that Turbo swapped in as fresh, unbound DOM gets its directives bound and
 *     `onComponentInit` fired. This is the load-bearing glue: without it, a navigated-to page's
 *     `l:*` components are inert.
 *  2. **the Turbo → lievit event bridge** — Turbo's `turbo:before-visit` / `turbo:before-render` /
 *     `turbo:load` are translated into lievit's `lievit:navigate` / `lievit:navigating` /
 *     `lievit:navigated` CustomEvents, the vocabulary `current.ts` (active-link re-eval) and
 *     `broadcast.ts` (channel teardown) already listen on, so those features keep working unmodified.
 *
 * happy-dom note: this exercises the GLUE in isolation by dispatching the `turbo:*` DOM events the
 * way Turbo Drive fires them. Turbo's ACTUAL fetch + body swap + history is a real-browser concern
 * (it intercepts clicks and rewrites the document); that end-to-end path needs a Playwright pass and
 * is NOT asserted here (see ADR-0085 "what still needs a real-browser pass").
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { LievitRuntime } from "../runtime/runtime.js";
import { installNavigate } from "../runtime/features/navigate.js";

const teardowns: Array<() => void> = [];

beforeEach(() => {
  document.body.innerHTML = "";
});

afterEach(() => {
  while (teardowns.length > 0) {
    teardowns.pop()!();
  }
});

/** Fires a Turbo lifecycle event the way Turbo Drive does (a CustomEvent on `document`). */
function fireTurbo(name: string, detail: Record<string, unknown> = {}): void {
  document.dispatchEvent(new CustomEvent(name, { detail, bubbles: true }));
}

describe("Turbo Drive glue: wire re-bind after a swap (ADR-0085)", () => {
  it("binds a freshly swapped-in wire component on turbo:load (onComponentInit fires)", () => {
    const rt = new LievitRuntime();
    const initialized: string[] = [];
    teardowns.push(rt.use({ onComponentInit: (ctx) => initialized.push(ctx.componentId) }));
    teardowns.push(installNavigate(rt, { win: window }));

    // Turbo swapped in a new body with a component that has NOT been bound yet (no start() ran on it).
    document.body.innerHTML =
      '<div data-lievit-component="C" data-lievit-id="c1" data-lievit-snapshot="snap-1"></div>';
    expect(initialized).toEqual([]); // nothing bound yet

    fireTurbo("turbo:load");

    expect(initialized).toContain("c1"); // the glue re-scanned the new body and bound the component
  });

  it("re-binding the same body across swaps is safe (no throw; directive scan is marker-guarded)", () => {
    const errors: unknown[] = [];
    const rt = new LievitRuntime({ onError: (_, d) => errors.push(d) });
    teardowns.push(installNavigate(rt, { win: window }));

    document.body.innerHTML =
      '<div data-lievit-component="C" data-lievit-id="c1" data-lievit-snapshot="snap-1">' +
      '<button l:click="go">x</button></div>';

    // `start()` registers component STATE once (the `states` map is keyed by element), but re-fires
    // the lifecycle `componentInit` per call and re-scans directives. The re-scan is guarded by the
    // per-element bind markers, so calling it on every Turbo swap binds each directive at most once.
    expect(() => {
      fireTurbo("turbo:load");
      fireTurbo("turbo:load");
    }).not.toThrow();
    expect(errors).toEqual([]);
  });
});

describe("Turbo Drive glue: Turbo → lievit event bridge (ADR-0085)", () => {
  it("turbo:before-visit emits lievit:navigate (the broadcast-channel teardown signal)", () => {
    const rt = new LievitRuntime();
    teardowns.push(installNavigate(rt, { win: window }));
    const got: Array<{ url: unknown }> = [];
    const on = (e: Event): void => {
      got.push({ url: (e as CustomEvent).detail?.url });
    };
    window.addEventListener("lievit:navigate", on);
    teardowns.push(() => window.removeEventListener("lievit:navigate", on));

    fireTurbo("turbo:before-visit", { url: "https://example.test/next" });

    expect(got).toHaveLength(1);
    expect(got[0]!.url).toBe("https://example.test/next");
  });

  it("turbo:before-render emits lievit:navigating, turbo:load emits lievit:navigated", () => {
    const rt = new LievitRuntime();
    teardowns.push(installNavigate(rt, { win: window }));
    const seen: string[] = [];
    const names = ["lievit:navigate", "lievit:navigating", "lievit:navigated"] as const;
    const listeners = names.map((n) => {
      const fn = (): void => void seen.push(n);
      window.addEventListener(n, fn);
      return () => window.removeEventListener(n, fn);
    });
    teardowns.push(...listeners);

    fireTurbo("turbo:before-render");
    fireTurbo("turbo:load");

    expect(seen).toContain("lievit:navigating");
    expect(seen).toContain("lievit:navigated");
  });

  it("the unsubscribe detaches the Turbo listeners (no more bridged events fire)", () => {
    const rt = new LievitRuntime();
    const stop = installNavigate(rt, { win: window });
    const seen: string[] = [];
    const on = (): void => void seen.push("navigated");
    window.addEventListener("lievit:navigated", on);
    teardowns.push(() => window.removeEventListener("lievit:navigated", on));

    stop(); // detach
    fireTurbo("turbo:load");

    expect(seen).toEqual([]); // nothing bridged after teardown
  });
});
