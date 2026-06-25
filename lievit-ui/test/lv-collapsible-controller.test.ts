/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * lv-collapsible Stimulus controller -- the conversion of the collapsible WIRE component
 * (registry/wire/collapsible). There was no enhancer before (the disclosure rode the core
 * l:click="toggle" directive, which always round-tripped); this suite proves the controller through
 * the REAL Stimulus Application + the REAL lievit wire morph (no mocked $lievit, no mocked runtime:
 * a fetch stub captures the actual `_calls` the runtime POSTs).
 *
 * It pins the WHOLE controlled/uncontrolled contract (assert BOTH branches, never just the happy
 * one): a CONTROLLED disclosure (data-lv-wire-toggle present, as the WIRE template stamps) rides
 * the wire EXACTLY once and lets the server drive; an UNCONTROLLED one (attribute absent) flips
 * purely client-side with ZERO round-trip and keeps the APG a11y contract (aria-expanded + region
 * hidden) and the shadcn data-state hook in sync. Plus the morph-safety proof the old directive
 * could not state: after a real morph one click => one effect (no stacked listeners).
 *
 * Substrate: happy-dom + the real @hotwired/stimulus Application started by startStimulus(), which
 * auto-loads controllers by filename. flushStimulus() awaits the MutationObserver.
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

interface Mounted {
  root: HTMLElement;
  trigger: HTMLButtonElement;
  region: HTMLElement;
  chevron: HTMLElement;
}

/**
 * Builds the collapsible component root EXACTLY as collapsible.jte emits it. `wireToggle` present =>
 * CONTROLLED (the WIRE template's stamping); omitted => UNCONTROLLED (a standalone include).
 */
function mountCollapsible(
  opts: { open?: boolean; wireToggle?: string; disabled?: boolean; parent?: HTMLElement } = {},
): Mounted {
  const open = opts.open ?? false;
  const parent = opts.parent ?? document.body;

  const root = document.createElement("div");
  root.setAttribute("data-lievit-component", "com.example.Collapsible");
  root.setAttribute("data-lievit-id", `cid-${Math.random().toString(36).slice(2)}`);
  root.setAttribute("data-lievit-snapshot", "s1");
  root.setAttribute("data-controller", "lv-collapsible");
  root.setAttribute("data-slot", "collapsible");
  root.setAttribute("data-state", open ? "open" : "closed");
  if (opts.wireToggle != null) {
    root.setAttribute("data-lv-wire-toggle", opts.wireToggle);
  }
  root.setAttribute("data-lv-collapsible-disabled-value", opts.disabled === true ? "true" : "false");

  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.id = "lv-collapsible-trigger";
  trigger.setAttribute("aria-expanded", open ? "true" : "false");
  trigger.setAttribute("aria-controls", "lv-collapsible-panel");
  trigger.setAttribute("data-action", "click->lv-collapsible#toggle");
  trigger.setAttribute("data-lv-collapsible-target", "trigger");
  trigger.setAttribute("data-slot", "collapsible-trigger");
  trigger.setAttribute("data-collapsible-trigger", "");

  const label = document.createElement("span");
  label.setAttribute("data-collapsible-label", "");
  label.textContent = "Section";
  trigger.appendChild(label);

  const chevron = document.createElement("span");
  chevron.setAttribute("aria-hidden", "true");
  chevron.setAttribute("data-lv-collapsible-target", "chevron");
  chevron.style.transform = `rotate(${open ? "180" : "0"}deg)`;
  trigger.appendChild(chevron);
  root.appendChild(trigger);

  const region = document.createElement("div");
  region.id = "lv-collapsible-panel";
  region.setAttribute("role", "region");
  region.setAttribute("aria-labelledby", "lv-collapsible-trigger");
  region.toggleAttribute("hidden", !open);
  region.setAttribute("data-lv-collapsible-target", "region");
  region.setAttribute("data-slot", "collapsible-content");
  region.setAttribute("data-collapsible-region", "");
  region.innerHTML = `<p data-collapsible-body>Collapsible content.</p>`;
  root.appendChild(region);

  parent.appendChild(root);
  return { root, trigger, region, chevron };
}

beforeEach(() => {
  document.body.innerHTML = "";
});

afterEach(() => {
  stopStimulus();
  document.body.innerHTML = "";
});

describe("lv-collapsible controller — uncontrolled client-side disclosure (real Stimulus)", () => {
  it("a click flips closed->open purely client-side (aria + hidden + data-state) with ZERO wire call", async () => {
    const { runtime, calledActions } = makeRuntime();
    const { root, trigger, region, chevron } = mountCollapsible({ open: false }); // no wireToggle
    startStimulus({ runtime });
    await flushStimulus();

    trigger.click();

    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(region.hasAttribute("hidden")).toBe(false);
    expect(root.getAttribute("data-state")).toBe("open");
    expect(chevron.style.transform).toBe("rotate(180deg)");

    await new Promise((r) => setTimeout(r, 10));
    expect(calledActions).toHaveLength(0); // the 410 page-expired regression: never round-trip
  });

  it("a second click flips open->closed and removes the region from the a11y tree (still no wire)", async () => {
    const { runtime, calledActions } = makeRuntime();
    const { root, trigger, region, chevron } = mountCollapsible({ open: true });
    startStimulus({ runtime });
    await flushStimulus();

    trigger.click();

    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(region.hasAttribute("hidden")).toBe(true);
    expect(root.getAttribute("data-state")).toBe("closed");
    expect(chevron.style.transform).toBe("rotate(0deg)");

    await new Promise((r) => setTimeout(r, 10));
    expect(calledActions).toHaveLength(0);
  });
});

describe("lv-collapsible controller — controlled disclosure rides the wire (real runtime)", () => {
  it("a click fires the named wire toggle action EXACTLY once and the server owns the open state", async () => {
    const { runtime, calledActions } = makeRuntime();
    const { trigger } = mountCollapsible({ open: false, wireToggle: "toggle" });
    startStimulus({ runtime });
    await flushStimulus();

    trigger.click();

    await new Promise((r) => setTimeout(r, 10));
    expect(calledActions.filter((a) => a === "toggle")).toHaveLength(1);
  });

  it("honours a custom wire action name from data-lv-wire-toggle", async () => {
    const { runtime, calledActions } = makeRuntime();
    const { trigger } = mountCollapsible({ open: false, wireToggle: "expand" });
    startStimulus({ runtime });
    await flushStimulus();

    trigger.click();

    await new Promise((r) => setTimeout(r, 10));
    expect(calledActions).toContain("expand");
    expect(calledActions).not.toContain("toggle");
  });
});

describe("lv-collapsible controller — disabled trigger is a no-op on both paths", () => {
  it("a disabled controlled trigger neither flips locally nor round-trips", async () => {
    const { runtime, calledActions } = makeRuntime();
    const { root, trigger, region } = mountCollapsible({
      open: false,
      wireToggle: "toggle",
      disabled: true,
    });
    startStimulus({ runtime });
    await flushStimulus();

    trigger.click();

    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(region.hasAttribute("hidden")).toBe(true);
    expect(root.getAttribute("data-state")).toBe("closed");

    await new Promise((r) => setTimeout(r, 10));
    expect(calledActions).toHaveLength(0);
  });

  it("a disabled uncontrolled trigger does not flip the disclosure", async () => {
    const { runtime, calledActions } = makeRuntime();
    const { root, trigger, region } = mountCollapsible({ open: false, disabled: true });
    startStimulus({ runtime });
    await flushStimulus();

    trigger.click();

    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(region.hasAttribute("hidden")).toBe(true);
    expect(root.getAttribute("data-state")).toBe("closed");
    expect(calledActions).toHaveLength(0);
  });
});

describe("lv-collapsible controller — morph-safety (real lievit morph)", () => {
  it("after a real morph the controlled toggle still fires EXACTLY once (no stacked listeners)", async () => {
    const { runtime, calledActions } = makeRuntime();
    const { root } = mountCollapsible({ open: false, wireToggle: "toggle" });
    startStimulus({ runtime });
    await flushStimulus();

    // A real lievit wire morph re-renders the component subtree (idiomorph). The markup is
    // identical, so the controller must NOT be double-connected and the data-action must stay
    // single -- the WeakSet/afterCall bookkeeping is gone; Stimulus owns this.
    morph(root, root.outerHTML);
    await flushStimulus();

    const trigger = root.querySelector<HTMLButtonElement>("#lv-collapsible-trigger")!;
    trigger.click();

    await new Promise((r) => setTimeout(r, 10));
    expect(calledActions.filter((a) => a === "toggle")).toHaveLength(1);
  });

  it("after a real morph the uncontrolled flip still runs EXACTLY once per click", async () => {
    const { runtime, calledActions } = makeRuntime();
    const { root } = mountCollapsible({ open: false });
    startStimulus({ runtime });
    await flushStimulus();

    morph(root, root.outerHTML);
    await flushStimulus();

    const trigger = root.querySelector<HTMLButtonElement>("#lv-collapsible-trigger")!;
    const region = root.querySelector<HTMLElement>("#lv-collapsible-panel")!;
    trigger.click();

    // One click after the morph => exactly one flip (open). A stacked listener would flip twice
    // (open then closed) and leave it collapsed.
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(region.hasAttribute("hidden")).toBe(false);
    expect(root.getAttribute("data-state")).toBe("open");
    expect(calledActions).toHaveLength(0);
  });

  it("a collapsible removed by a morph stops firing (disconnect tears the action down)", async () => {
    const { runtime, calledActions } = makeRuntime();
    const parent = document.createElement("div");
    parent.id = "host";
    document.body.appendChild(parent);
    const { trigger } = mountCollapsible({ open: false, wireToggle: "toggle", parent });
    startStimulus({ runtime });
    await flushStimulus();

    // Morph the collapsible OUT of the tree.
    morph(parent, `<div id="host"><span>gone</span></div>`);
    await flushStimulus();

    // The detached trigger's click must no longer reach a live controller -> no wire call.
    trigger.click();
    await new Promise((r) => setTimeout(r, 10));
    expect(calledActions).toHaveLength(0);
  });
});
