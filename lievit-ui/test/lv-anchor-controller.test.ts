/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * lv-anchor Stimulus controller -- the CSS Anchor Positioning polyfill seam (the `@polyfill-placeholder`
 * gap in popover-anchor.enhancer.ts, now shipped). Proven through the REAL Stimulus Application started
 * by startStimulus() (auto-loads controllers by filename) + the REAL lievit wire morph -- no mocked
 * $lievit, no mocked controller. The ONE thing stubbed is the polyfill LOADER itself (so the suite
 * neither downloads @oddbird nor needs a layout engine happy-dom does not have); the engage/no-engage
 * DECISION and the once-per-page idempotency are exercised for real.
 *
 * Substrate: happy-dom + real @hotwired/stimulus. flushStimulus() awaits the MutationObserver.
 */
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";

import { LievitRuntime } from "../runtime/runtime.js";
import { morph } from "../runtime/morph.js";
import { startStimulus, stopStimulus, flushStimulus } from "../runtime/stimulus/application.js";
import {
  ensureAnchorPolyfill,
  supportsCssAnchorPositioning,
  __setAnchorPolyfillSeams,
  __resetAnchorPolyfill,
} from "../runtime/stimulus/controllers/lv-anchor-controller.js";

function makeRuntime(): LievitRuntime {
  const fetchImpl = vi.fn(async () =>
    new Response("<div></div>", { status: 200, headers: { "Lievit-Snapshot": "s2" } }),
  );
  return new LievitRuntime({ fetchImpl: fetchImpl as unknown as typeof fetch });
}

/** Build a component root + the popover panel exactly as popover.jte emits it (both controllers). */
function mountAnchoredPanel(id = "the-panel"): { componentRoot: HTMLElement; panel: HTMLElement } {
  const opener = document.createElement("button");
  opener.id = `${id}-trigger`;
  document.body.appendChild(opener);

  const componentRoot = document.createElement("div");
  componentRoot.setAttribute("data-lievit-component", "com.example.C");
  componentRoot.setAttribute("data-lievit-id", `cid-${Math.random().toString(36).slice(2)}`);
  componentRoot.setAttribute("data-lievit-snapshot", "s1");

  const panel = document.createElement("div");
  panel.id = id;
  panel.setAttribute("popover", "");
  // Exactly as popover.jte stamps it: the popover seam + the anchor-polyfill seam on the same panel.
  panel.setAttribute("data-controller", "lv-popover lv-anchor");
  panel.setAttribute("data-lv-opener", `${id}-trigger`);
  panel.setAttribute("style", "position-anchor:--the-panel-trigger;position-area:bottom span-right;");
  panel.appendChild(document.createElement("p"));

  componentRoot.appendChild(panel);
  document.body.appendChild(componentRoot);
  return { componentRoot, panel };
}

beforeEach(() => {
  document.body.innerHTML = "";
  __resetAnchorPolyfill();
});

afterEach(() => {
  stopStimulus();
  document.body.innerHTML = "";
  __resetAnchorPolyfill();
});

describe("lv-anchor controller — polyfill engagement (real Stimulus + real runtime)", () => {
  it("engages_the_polyfill_when_native_anchor_support_is_absent: an anchored panel connecting loads + applies the polyfill exactly once", async () => {
    const load = vi.fn(async () => undefined);
    __setAnchorPolyfillSeams({ supports: () => false, load });

    startStimulus({ runtime: makeRuntime() });
    mountAnchoredPanel();
    await flushStimulus();
    await Promise.resolve(); // let the fire-and-forget ensureAnchorPolyfill() settle

    expect(load).toHaveBeenCalledTimes(1);
  });

  it("does_not_engage_the_polyfill_when_native_support_is_present: a supporting browser downloads + runs nothing", async () => {
    const load = vi.fn(async () => undefined);
    __setAnchorPolyfillSeams({ supports: () => true, load });

    startStimulus({ runtime: makeRuntime() });
    mountAnchoredPanel();
    await flushStimulus();
    await Promise.resolve();

    expect(load).not.toHaveBeenCalled();
  });

  it("loads_at_most_once_for_many_anchored_panels: two panels connecting share the single page-level load", async () => {
    const load = vi.fn(async () => undefined);
    __setAnchorPolyfillSeams({ supports: () => false, load });

    startStimulus({ runtime: makeRuntime() });
    mountAnchoredPanel("panel-a");
    mountAnchoredPanel("panel-b");
    await flushStimulus();
    await Promise.resolve();

    expect(load).toHaveBeenCalledTimes(1);
  });

  it("load_failure_is_swallowed: a rejected loader resolves false and never throws out of connect()", async () => {
    const load = vi.fn(async () => {
      throw new Error("chunk 404");
    });
    __setAnchorPolyfillSeams({ supports: () => false, load });

    // The controller's connect() must not surface the rejection; the engagement settles to false.
    startStimulus({ runtime: makeRuntime() });
    mountAnchoredPanel();
    await flushStimulus();

    await expect(ensureAnchorPolyfill()).resolves.toBe(false);
    expect(load).toHaveBeenCalledTimes(1);
  });
});

describe("lv-anchor controller — morph-safety (real lievit morph)", () => {
  it("does_not_reload_after_a_wire_morph_replaces_the_panel: the singleton engagement is reused (one download total)", async () => {
    const load = vi.fn(async () => undefined);
    __setAnchorPolyfillSeams({ supports: () => false, load });

    startStimulus({ runtime: makeRuntime() });
    const { componentRoot } = mountAnchoredPanel();
    await flushStimulus();
    await Promise.resolve();
    expect(load).toHaveBeenCalledTimes(1);

    // A real wire morph re-renders the subtree: the panel disconnects + a fresh one reconnects.
    morph(
      componentRoot,
      `<div data-lievit-component="com.example.C" data-lievit-snapshot="s2">
         <div id="the-panel" popover="" data-controller="lv-popover lv-anchor"
              data-lv-opener="the-panel-trigger"
              style="position-anchor:--the-panel-trigger;position-area:bottom span-right;"><p></p></div>
       </div>`,
    );
    await flushStimulus();
    await Promise.resolve();

    // Reconnect re-calls ensureAnchorPolyfill(), which returns the already-settled promise: no reload.
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("engages_for_a_controlled_popover_injected_by_a_morph: a panel that appears only after a round-trip still loads the polyfill", async () => {
    const load = vi.fn(async () => undefined);
    __setAnchorPolyfillSeams({ supports: () => false, load });

    // Controlled popover: the panel is absent until the server opens it via a morph.
    const componentRoot = document.createElement("div");
    componentRoot.setAttribute("data-lievit-component", "com.example.C");
    componentRoot.setAttribute("data-lievit-id", "cid-controlled");
    componentRoot.setAttribute("data-lievit-snapshot", "s1");
    document.body.appendChild(componentRoot);

    startStimulus({ runtime: makeRuntime() });
    await flushStimulus();
    await Promise.resolve();
    expect(load).not.toHaveBeenCalled(); // no anchored surface yet

    morph(
      componentRoot,
      `<div data-lievit-component="com.example.C" data-lievit-snapshot="s2">
         <div id="cp" popover="" data-controller="lv-popover lv-anchor" data-lv-opener="cp-trigger"
              data-lv-wire-close="close"
              style="position-anchor:--cp-trigger;position-area:bottom span-right;"><p></p></div>
       </div>`,
    );
    await flushStimulus();
    await Promise.resolve();

    expect(load).toHaveBeenCalledTimes(1);
  });
});

describe("supportsCssAnchorPositioning — feature detection", () => {
  it("returns_a_boolean_and_reports_unsupported_in_a_non_anchor_environment: happy-dom has no native anchor layout", () => {
    // happy-dom does not implement CSS Anchor Positioning, so the real probe must report false
    // (which is exactly the engine class that needs the polyfill). The contract is a pure boolean.
    const result = supportsCssAnchorPositioning();
    expect(typeof result).toBe("boolean");
    expect(result).toBe(false);
  });
});
