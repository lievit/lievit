/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * lv-popover Stimulus controller -- the conversion exemplar for the native-popover seam
 * (popover-anchor.enhancer.ts). The controlled/uncontrolled doctrine (wire-410 fix) now lives in
 * the shared DismissableController base; this suite proves it through the REAL Stimulus
 * Application + the REAL lievit wire morph (no mocked $lievit, no mocked runtime: a fetch stub
 * captures the actual `_calls` the runtime POSTs).
 *
 * It mirrors popover-anchor.enhancer.test.ts assertion-for-assertion (opener record, focus return,
 * autofocus, aria-expanded sync, controlled-fires / uncontrolled-silent), and adds the morph-safety
 * proof the enhancer test could not state: after a real morph the controller still fires its close
 * EXACTLY once (no stacked listeners, no double round-trip).
 *
 * Substrate: happy-dom + the real @hotwired/stimulus Application started by startStimulus(),
 * which auto-loads controllers by filename. flushStimulus() awaits the MutationObserver.
 */
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";

import { LievitRuntime } from "../runtime/runtime.js";
import { morph } from "../runtime/morph.js";
import { startStimulus, stopStimulus, flushStimulus } from "../runtime/stimulus/application.js";

function makeRuntime(): { runtime: LievitRuntime; calledActions: string[] } {
  const calledActions: string[] = [];
  const fetchImpl = vi.fn(async (_url: unknown, init?: RequestInit) => {
    const body = JSON.parse((init?.body as string) ?? "{}") as Record<string, unknown>;
    const calls = body._calls as string[] | undefined;
    if (calls) {
      calledActions.push(...calls);
    }
    return new Response("<div></div>", {
      status: 200,
      headers: { "Lievit-Snapshot": "s2" },
    });
  });
  const runtime = new LievitRuntime({ fetchImpl: fetchImpl as unknown as typeof fetch });
  return { runtime, calledActions };
}

/** Dispatch a native-popover ToggleEvent (happy-dom may lack ToggleEvent; fall back to a patched Event). */
function fireToggle(panel: Element, newState: "open" | "closed"): void {
  let ev: Event;
  try {
    ev = new ToggleEvent("toggle", {
      newState,
      oldState: newState === "open" ? "closed" : "open",
      bubbles: false,
    });
  } catch {
    ev = new Event("toggle", { bubbles: false });
    Object.defineProperty(ev, "newState", { value: newState, writable: false });
  }
  panel.dispatchEvent(ev);
}

interface Mounted {
  componentRoot: HTMLElement;
  panel: HTMLElement;
  opener: HTMLButtonElement;
}

/** Build a component root + a `data-controller="lv-popover"` panel exactly as popover.jte emits it. */
function mountPanel(opts: {
  openerId?: string;
  hasAutofocus?: boolean;
  wireClose?: string;
  ariaExpanded?: boolean;
} = {}): Mounted {
  const openerId = opts.openerId ?? "the-opener";

  const opener = document.createElement("button");
  opener.id = openerId;
  opener.textContent = "Open";
  if (opts.ariaExpanded === true) {
    opener.setAttribute("aria-expanded", "false");
  }
  document.body.appendChild(opener);

  const componentRoot = document.createElement("div");
  componentRoot.setAttribute("data-lievit-component", "com.example.C");
  componentRoot.setAttribute("data-lievit-id", `cid-${Math.random().toString(36).slice(2)}`);
  componentRoot.setAttribute("data-lievit-snapshot", "s1");

  const panel = document.createElement("div");
  panel.id = "the-panel";
  panel.setAttribute("popover", "");
  panel.setAttribute("data-controller", "lv-popover");
  panel.setAttribute("data-lv-opener", openerId);
  if (opts.wireClose != null) {
    panel.setAttribute("data-lv-wire-close", opts.wireClose);
  }
  if (opts.hasAutofocus === true) {
    const input = document.createElement("input");
    input.setAttribute("data-lv-autofocus", "");
    panel.appendChild(input);
  } else {
    const p = document.createElement("p");
    p.textContent = "Panel content";
    panel.appendChild(p);
  }

  componentRoot.appendChild(panel);
  document.body.appendChild(componentRoot);
  return { componentRoot, panel, opener };
}

beforeEach(() => {
  document.body.innerHTML = "";
});

afterEach(() => {
  stopStimulus();
  document.body.innerHTML = "";
});

describe("lv-popover controller — native popover seam (real Stimulus + real runtime)", () => {
  it("records_opener_then_returns_focus_on_light_dismiss", async () => {
    const { runtime } = makeRuntime();
    const { panel, opener } = mountPanel({});
    startStimulus({ runtime });
    await flushStimulus();

    opener.focus();
    fireToggle(panel, "open");

    const outside = document.createElement("button");
    document.body.appendChild(outside);
    outside.focus();
    expect(document.activeElement).toBe(outside);

    fireToggle(panel, "closed");
    expect(document.activeElement).toBe(opener);
  });

  it("no_focus_return_when_browser_already_returned", async () => {
    const { runtime } = makeRuntime();
    const { panel, opener } = mountPanel({});
    startStimulus({ runtime });
    await flushStimulus();

    opener.focus();
    fireToggle(panel, "open");
    opener.focus();
    const focusSpy = vi.spyOn(opener, "focus");

    fireToggle(panel, "closed");
    expect(focusSpy).not.toHaveBeenCalled();
  });

  it("autofocus_moves_focus_to_data_lv_autofocus_after_open", async () => {
    const { runtime } = makeRuntime();
    const { panel } = mountPanel({ hasAutofocus: true });
    startStimulus({ runtime });
    await flushStimulus();

    const autofocusEl = panel.querySelector<HTMLInputElement>("[data-lv-autofocus]");
    fireToggle(panel, "open");
    await Promise.resolve(); // the focus is deferred via queueMicrotask
    expect(document.activeElement).toBe(autofocusEl);
  });

  it("controlled_panel_fires_close_once_per_light_dismiss", async () => {
    const { runtime, calledActions } = makeRuntime();
    const { panel, opener } = mountPanel({ wireClose: "close" });
    startStimulus({ runtime });
    await flushStimulus();

    opener.focus();
    fireToggle(panel, "open");
    const outside = document.createElement("button");
    document.body.appendChild(outside);
    outside.focus();
    fireToggle(panel, "closed");

    await new Promise((r) => setTimeout(r, 10));
    expect(calledActions.filter((a) => a === "close")).toHaveLength(1);
  });

  it("custom_close_action_via_data_lv_wire_close", async () => {
    const { runtime, calledActions } = makeRuntime();
    const { panel, opener } = mountPanel({ wireClose: "toggleOpen" });
    startStimulus({ runtime });
    await flushStimulus();

    opener.focus();
    fireToggle(panel, "open");
    const outside = document.createElement("button");
    document.body.appendChild(outside);
    outside.focus();
    fireToggle(panel, "closed");

    await new Promise((r) => setTimeout(r, 10));
    expect(calledActions).toContain("toggleOpen");
    expect(calledActions).not.toContain("close");
  });

  it("uncontrolled_panel_fires_no_wire_call_on_close (the 410 page-expired regression)", async () => {
    const { runtime, calledActions } = makeRuntime();
    const { panel, opener } = mountPanel({}); // no data-lv-wire-close
    startStimulus({ runtime });
    await flushStimulus();

    opener.focus();
    fireToggle(panel, "open");
    const outside = document.createElement("button");
    document.body.appendChild(outside);
    outside.focus();
    fireToggle(panel, "closed");

    await new Promise((r) => setTimeout(r, 10));
    expect(calledActions).toHaveLength(0);
  });

  it("uncontrolled_open_close_cycle_stays_client_side", async () => {
    const { runtime, calledActions } = makeRuntime();
    const { panel, opener } = mountPanel({});
    startStimulus({ runtime });
    await flushStimulus();

    opener.focus();
    fireToggle(panel, "open");
    fireToggle(panel, "closed");
    fireToggle(panel, "open");
    fireToggle(panel, "closed");

    await new Promise((r) => setTimeout(r, 10));
    expect(calledActions).toHaveLength(0);
  });

  it("aria_expanded_synced_true_on_open_and_false_on_close (only when opener opted in)", async () => {
    const { runtime } = makeRuntime();
    const { panel, opener } = mountPanel({ ariaExpanded: true });
    startStimulus({ runtime });
    await flushStimulus();

    opener.focus();
    fireToggle(panel, "open");
    expect(opener.getAttribute("aria-expanded")).toBe("true");

    const outside = document.createElement("button");
    document.body.appendChild(outside);
    outside.focus();
    fireToggle(panel, "closed");
    expect(opener.getAttribute("aria-expanded")).toBe("false");
  });

  it("aria_expanded_not_added_when_opener_did_not_declare_it", async () => {
    const { runtime } = makeRuntime();
    const { panel, opener } = mountPanel({}); // opener has no aria-expanded
    startStimulus({ runtime });
    await flushStimulus();

    expect(opener.hasAttribute("aria-expanded")).toBe(false);
    opener.focus();
    fireToggle(panel, "open");
    expect(opener.hasAttribute("aria-expanded")).toBe(false);
  });
});

describe("lv-popover controller — morph-safety (real lievit morph)", () => {
  it("after a real morph the controlled close still fires EXACTLY once (no stacked listeners)", async () => {
    const { runtime, calledActions } = makeRuntime();
    const { componentRoot, opener } = mountPanel({ wireClose: "close" });
    startStimulus({ runtime });
    await flushStimulus();

    // A real lievit wire morph re-renders the component subtree (idiomorph). The panel markup is
    // identical, so the controller must NOT be double-connected and the toggle handler must stay
    // single. (The enhancer's WeakSet/afterCall bookkeeping is gone; Stimulus owns this.)
    morph(
      componentRoot,
      `<div data-lievit-component="com.example.C" data-lievit-snapshot="s2">
         <div id="the-panel" popover="" data-controller="lv-popover" data-lv-opener="the-opener"
              data-lv-wire-close="close"><p>Panel content</p></div>
       </div>`,
    );
    await flushStimulus();

    const panel = componentRoot.querySelector<HTMLElement>("#the-panel")!;
    opener.focus();
    fireToggle(panel, "open");
    const outside = document.createElement("button");
    document.body.appendChild(outside);
    outside.focus();
    fireToggle(panel, "closed");

    await new Promise((r) => setTimeout(r, 10));
    expect(calledActions.filter((a) => a === "close")).toHaveLength(1);
  });

  it("a panel removed by a morph stops firing (disconnect tears the listener down)", async () => {
    const { runtime, calledActions } = makeRuntime();
    const { componentRoot, panel } = mountPanel({ wireClose: "close" });
    startStimulus({ runtime });
    await flushStimulus();

    // Morph the panel out of the tree.
    morph(
      componentRoot,
      `<div data-lievit-component="com.example.C" data-lievit-snapshot="s2"><span>gone</span></div>`,
    );
    await flushStimulus();

    // The detached node's toggle must no longer reach a live controller -> no wire call.
    fireToggle(panel, "closed");
    await new Promise((r) => setTimeout(r, 10));
    expect(calledActions).toHaveLength(0);
  });
});
