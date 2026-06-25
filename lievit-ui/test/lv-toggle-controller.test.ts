/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * lv-toggle Stimulus controller -- the conversion of the server-only toggle.jte press into a
 * Stimulus controller carrying the controlled/uncontrolled doctrine for a BUTTON (not an overlay).
 * Proven through the REAL Stimulus Application (started by startStimulus, which auto-loads
 * controllers by filename) + the REAL lievit wire morph + a fetch stub that records every wire
 * action POSTed (no mocked $lievit, no mocked runtime).
 *
 * It pins both doctrine branches as real controller behaviour:
 *   - UNCONTROLLED (no l:click): a click flips aria-pressed + the mirrored data-pressed CLIENT-SIDE
 *     with ZERO wire round-trip (the capability the server-only partial lacked).
 *   - CONTROLLED (l:click="<action>"): the controller DEFERS -- it does not flip and issues no wire
 *     call; the runtime's own l:click rides the click and the morph reconciles aria-pressed.
 * plus the morph-safety the old (absent) enhancer could not state: after a real idiomorph the
 * controller flips EXACTLY once per click (no stacked listeners), and a button removed by a morph
 * flips nothing (disconnect tore the binding down).
 *
 * Substrate: happy-dom + the real @hotwired/stimulus Application. flushStimulus() awaits the
 * MutationObserver so the controller is connected before a gesture is driven.
 */
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";

import { LievitRuntime } from "../runtime/runtime.js";
import { morph } from "../runtime/morph.js";
import { startStimulus, stopStimulus, flushStimulus } from "../runtime/stimulus/application.js";

// ---------------------------------------------------------------------------
// Real runtime with a fetch stub that records the wire actions POSTed.
// ---------------------------------------------------------------------------
function makeRuntime(): { runtime: LievitRuntime; calledActions: string[] } {
  const calledActions: string[] = [];
  const fetchImpl = vi.fn(async (_url: unknown, init?: RequestInit) => {
    const body = JSON.parse((init?.body as string) ?? "{}") as Record<string, unknown>;
    const calls = body._calls as string[] | undefined;
    if (calls) calledActions.push(...calls);
    return new Response("<div></div>", { status: 200, headers: { "Lievit-Snapshot": "s2" } });
  });
  const runtime = new LievitRuntime({ fetchImpl: fetchImpl as unknown as typeof fetch });
  return { runtime, calledActions };
}

interface Mounted {
  componentRoot: HTMLElement;
  button: HTMLButtonElement;
}

/**
 * Build a `[data-lievit-component]` root containing a toggle button wired exactly as toggle.jte
 * emits it: data-slot + data-controller="lv-toggle" + data-action="click->lv-toggle#toggle" +
 * data-pressed/aria-pressed, and (CONTROLLED only) the l:click wire action.
 */
function mountToggle(opts: { pressed?: boolean; wireClick?: string } = {}): Mounted {
  const { pressed = false, wireClick } = opts;
  const state = pressed ? "true" : "false";

  const componentRoot = document.createElement("div");
  componentRoot.setAttribute("data-lievit-component", "com.example.C");
  componentRoot.setAttribute("data-lievit-id", `cid-${Math.random().toString(36).slice(2)}`);
  componentRoot.setAttribute("data-lievit-snapshot", "s1");

  const button = document.createElement("button");
  button.setAttribute("type", "button");
  button.setAttribute("data-slot", "toggle");
  button.setAttribute("data-controller", "lv-toggle");
  button.setAttribute("data-action", "click->lv-toggle#toggle");
  button.setAttribute("data-variant", "outline");
  button.setAttribute("data-size", "md");
  button.setAttribute("data-pressed", state);
  button.setAttribute("aria-pressed", state);
  if (wireClick != null) button.setAttribute("l:click", wireClick);
  button.textContent = "Bold";

  componentRoot.appendChild(button);
  document.body.appendChild(componentRoot);
  return { componentRoot, button };
}

/** Settle any microtasks a (deferred) wire call would have scheduled before asserting `calls`. */
function settle(): Promise<void> {
  return new Promise((r) => setTimeout(r, 10));
}

beforeEach(() => {
  document.body.innerHTML = "";
});

afterEach(() => {
  stopStimulus();
  document.body.innerHTML = "";
});

describe("lv-toggle controller — uncontrolled press (client-side, real Stimulus + real runtime)", () => {
  it("a_click_flips_aria_pressed_false_to_true_client_side", async () => {
    const { runtime } = makeRuntime();
    const { button } = mountToggle({ pressed: false });
    startStimulus({ runtime });
    await flushStimulus();

    button.click();

    expect(button.getAttribute("aria-pressed")).toBe("true");
  });

  it("a_click_flips_aria_pressed_true_back_to_false (round-trip of the press)", async () => {
    const { runtime } = makeRuntime();
    const { button } = mountToggle({ pressed: true });
    startStimulus({ runtime });
    await flushStimulus();

    button.click();
    expect(button.getAttribute("aria-pressed")).toBe("false");
    button.click();
    expect(button.getAttribute("aria-pressed")).toBe("true");
  });

  it("data_pressed_is_kept_in_lock_step_with_aria_pressed", async () => {
    const { runtime } = makeRuntime();
    const { button } = mountToggle({ pressed: false });
    startStimulus({ runtime });
    await flushStimulus();

    button.click();
    expect(button.getAttribute("aria-pressed")).toBe("true");
    expect(button.getAttribute("data-pressed")).toBe("true");
  });

  it("uncontrolled_press_fires_no_wire_call (ZERO round-trip — the doctrine's silent branch)", async () => {
    const { runtime, calledActions } = makeRuntime();
    const { button } = mountToggle({ pressed: false }); // no l:click
    startStimulus({ runtime });
    await flushStimulus();

    button.click();
    button.click();

    await settle();
    expect(calledActions).toHaveLength(0);
  });
});

describe("lv-toggle controller — controlled press (server-owned, the deferring branch)", () => {
  it("controlled_button_is_not_flipped_by_the_controller (the server owns pressed)", async () => {
    const { runtime } = makeRuntime();
    const { button } = mountToggle({ pressed: false, wireClick: "toggleBold" });
    startStimulus({ runtime });
    await flushStimulus();

    button.click();

    // The controller defers: it leaves aria-pressed for the server's morph to reconcile, so it must
    // NOT have flipped it client-side. (The runtime's own l:click is the round-trip's owner; it is
    // not bound in this substrate because installAllFeatures/scan was not run here.)
    expect(button.getAttribute("aria-pressed")).toBe("false");
    expect(button.getAttribute("data-pressed")).toBe("false");
  });

  it("controlled_button_issues_no_wire_call_from_the_controller", async () => {
    const { runtime, calledActions } = makeRuntime();
    const { button } = mountToggle({ pressed: false, wireClick: "toggleBold" });
    startStimulus({ runtime });
    await flushStimulus();

    button.click();

    await settle();
    // The controller never imports the wire bridge: the controlled round-trip is the runtime's
    // l:click responsibility, never a second call from here.
    expect(calledActions).toHaveLength(0);
  });

  it("a_blank_l_click_is_treated_as_uncontrolled (flips client-side)", async () => {
    const { runtime, calledActions } = makeRuntime();
    const { button } = mountToggle({ pressed: false, wireClick: "   " }); // blank => not controlled
    startStimulus({ runtime });
    await flushStimulus();

    button.click();

    await settle();
    expect(button.getAttribute("aria-pressed")).toBe("true");
    expect(calledActions).toHaveLength(0);
  });
});

describe("lv-toggle controller — morph-safety (real lievit morph)", () => {
  it("after a real morph one click flips EXACTLY once (no stacked listeners)", async () => {
    const { runtime } = makeRuntime();
    const { componentRoot } = mountToggle({ pressed: false });
    startStimulus({ runtime });
    await flushStimulus();

    // A real lievit wire morph re-renders the component subtree (idiomorph). The button markup is
    // identical, so Stimulus must keep ONE live controller (no double data-action binding). If the
    // listener were stacked, a single click would flip twice = net unchanged; we assert it flipped.
    morph(componentRoot, componentRoot.outerHTML);
    await flushStimulus();

    const button = componentRoot.querySelector<HTMLButtonElement>('[data-slot="toggle"]')!;
    button.click();

    expect(button.getAttribute("aria-pressed")).toBe("true");
  });

  it("a button removed by a morph flips nothing (disconnect tore the binding down)", async () => {
    const { runtime } = makeRuntime();
    const { componentRoot, button } = mountToggle({ pressed: false });
    startStimulus({ runtime });
    await flushStimulus();

    // Morph the button out of the tree.
    morph(
      componentRoot,
      `<div data-lievit-component="com.example.C" data-lievit-snapshot="s2"><span>gone</span></div>`,
    );
    await flushStimulus();

    // The detached node's click must no longer reach a live controller -> no flip.
    button.click();
    expect(button.getAttribute("aria-pressed")).toBe("false");
  });
});
