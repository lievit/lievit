/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * dropdown-menu -- the native-popover seam, driven by the shared `lv-popover` Stimulus controller
 * (the conversion of `popover-anchor.enhancer.ts`). The dropdown-menu panel reuses the exact same
 * seam contract as `popover.jte` (`popover` + `data-lv-opener` + `data-lv-wire-close`), so the
 * conversion is `data-controller="lv-popover"` on the panel -- NO duplicated focus/dismiss
 * controller. The controlled/uncontrolled doctrine (wire-410 fix) lives ONCE in the shared
 * DismissableController base.
 *
 * This suite is the REAL-controller + REAL-morph proof for the dropdown-menu panel DOM (role=menu +
 * the collection-nav attributes + data-controller="lv-popover"), exactly as dropdown-menu.jte emits
 * it: it builds that DOM, starts the REAL Stimulus Application (which auto-loads lv-popover by
 * filename) wired to the REAL LievitRuntime (a fetch stub captures the `_calls` the runtime POSTs),
 * drives native-popover toggle events, and asserts the observable DOM + the wire calls. It mirrors
 * lv-popover-controller.test.ts assertion-for-assertion against the menu's own markup, and proves
 * the morph-safety the legacy enhancer test could not: after a real lievit morph the controlled
 * close still fires EXACTLY once (no stacked listeners, no double round-trip).
 *
 * Substrate: happy-dom + the real @hotwired/stimulus Application started by startStimulus().
 * flushStimulus() awaits the MutationObserver. No mocked $lievit, no mocked runtime.
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
  trigger: HTMLButtonElement;
}

/**
 * Build a component root + a dropdown-menu panel exactly as dropdown-menu.jte emits it: a real
 * trigger <button> + the role="menu" panel carrying data-controller="lv-popover", the popover seam
 * attributes, and the collection-nav contract (which is independent of this controller). `open`
 * picks CONTROLLED (data-lv-wire-close present) vs UNCONTROLLED (absent), matching the template's
 * `${open ? escapeAction : null}` null-elision.
 */
function mountMenu(opts: { open?: boolean; escapeAction?: string; id?: string } = {}): Mounted {
  const id = opts.id ?? "user-menu";
  const triggerId = `${id}-trigger`;
  const controlled = opts.open === true;
  const escapeAction = opts.escapeAction ?? "close";

  const componentRoot = document.createElement("div");
  componentRoot.setAttribute("data-lievit-component", "com.example.Menu");
  componentRoot.setAttribute("data-lievit-id", `cid-${Math.random().toString(36).slice(2)}`);
  componentRoot.setAttribute("data-lievit-snapshot", "s1");

  const wrapper = document.createElement("span");
  wrapper.setAttribute("data-slot", "dropdown-menu");
  wrapper.setAttribute("data-open", controlled ? "true" : "false");

  const trigger = document.createElement("button");
  trigger.id = triggerId;
  trigger.type = "button";
  trigger.setAttribute("data-slot", "dropdown-menu-trigger");
  trigger.setAttribute("aria-haspopup", "menu");
  // The trigger renders aria-expanded server-side (it opts into the disclosure-sync contract).
  trigger.setAttribute("aria-expanded", controlled ? "true" : "false");
  trigger.setAttribute("aria-controls", id);
  if (!controlled) {
    trigger.setAttribute("popovertarget", id);
  }
  trigger.textContent = "Open menu";

  const panel = document.createElement("div");
  panel.id = id;
  panel.setAttribute("popover", "auto");
  panel.setAttribute("data-controller", "lv-popover");
  if (controlled) {
    panel.setAttribute("open", "");
  }
  panel.setAttribute("data-slot", "dropdown-menu-content");
  panel.setAttribute("role", "menu");
  panel.setAttribute("aria-labelledby", triggerId);
  panel.setAttribute("aria-orientation", "vertical");
  panel.setAttribute("data-lv-opener", triggerId);
  if (controlled) {
    panel.setAttribute("data-lv-wire-close", escapeAction);
  }
  // collection-nav contract (independent of lv-popover; present so the DOM matches the template).
  panel.setAttribute("data-lievit-collection", "");
  panel.setAttribute("data-lievit-collection-roving-tabindex", "true");
  panel.setAttribute("data-manual-activation", "true");

  const item = document.createElement("button");
  item.setAttribute("data-slot", "dropdown-menu-item");
  item.setAttribute("role", "menuitem");
  item.setAttribute("tabindex", "-1");
  item.textContent = "Profile";
  panel.appendChild(item);

  wrapper.appendChild(trigger);
  wrapper.appendChild(panel);
  componentRoot.appendChild(wrapper);
  document.body.appendChild(componentRoot);
  return { componentRoot, panel, trigger };
}

beforeEach(() => {
  document.body.innerHTML = "";
});

afterEach(() => {
  stopStimulus();
  document.body.innerHTML = "";
});

describe("lv-popover on the dropdown-menu panel — popover seam (real Stimulus + real runtime)", () => {
  it("returns focus to the trigger on light-dismiss (click-outside)", async () => {
    const { runtime } = makeRuntime();
    const { panel, trigger } = mountMenu({});
    startStimulus({ runtime });
    await flushStimulus();

    trigger.focus();
    fireToggle(panel, "open");

    const outside = document.createElement("button");
    document.body.appendChild(outside);
    outside.focus();
    expect(document.activeElement).toBe(outside);

    fireToggle(panel, "closed");
    expect(document.activeElement).toBe(trigger);
  });

  it("does not move focus when the browser already returned it to the trigger", async () => {
    const { runtime } = makeRuntime();
    const { panel, trigger } = mountMenu({});
    startStimulus({ runtime });
    await flushStimulus();

    trigger.focus();
    fireToggle(panel, "open");
    trigger.focus();
    const focusSpy = vi.spyOn(trigger, "focus");

    fireToggle(panel, "closed");
    expect(focusSpy).not.toHaveBeenCalled();
  });

  it("CONTROLLED panel fires its close action EXACTLY once per light-dismiss", async () => {
    const { runtime, calledActions } = makeRuntime();
    const { panel, trigger } = mountMenu({ open: true });
    startStimulus({ runtime });
    await flushStimulus();

    trigger.focus();
    fireToggle(panel, "open");
    const outside = document.createElement("button");
    document.body.appendChild(outside);
    outside.focus();
    fireToggle(panel, "closed");

    await new Promise((r) => setTimeout(r, 10));
    expect(calledActions.filter((a) => a === "close")).toHaveLength(1);
  });

  it("CONTROLLED panel honours a custom escapeAction via data-lv-wire-close", async () => {
    const { runtime, calledActions } = makeRuntime();
    const { panel, trigger } = mountMenu({ open: true, escapeAction: "toggleOpen" });
    startStimulus({ runtime });
    await flushStimulus();

    trigger.focus();
    fireToggle(panel, "open");
    const outside = document.createElement("button");
    document.body.appendChild(outside);
    outside.focus();
    fireToggle(panel, "closed");

    await new Promise((r) => setTimeout(r, 10));
    expect(calledActions).toContain("toggleOpen");
    expect(calledActions).not.toContain("close");
  });

  it("UNCONTROLLED panel fires NO wire call on close (the 410 page-expired regression)", async () => {
    const { runtime, calledActions } = makeRuntime();
    const { panel, trigger } = mountMenu({}); // open=false => no data-lv-wire-close
    startStimulus({ runtime });
    await flushStimulus();

    trigger.focus();
    fireToggle(panel, "open");
    const outside = document.createElement("button");
    document.body.appendChild(outside);
    outside.focus();
    fireToggle(panel, "closed");

    await new Promise((r) => setTimeout(r, 10));
    expect(calledActions).toHaveLength(0);
  });

  it("UNCONTROLLED open/close cycles stay entirely client-side (no round-trip)", async () => {
    const { runtime, calledActions } = makeRuntime();
    const { panel, trigger } = mountMenu({});
    startStimulus({ runtime });
    await flushStimulus();

    trigger.focus();
    fireToggle(panel, "open");
    fireToggle(panel, "closed");
    fireToggle(panel, "open");
    fireToggle(panel, "closed");

    await new Promise((r) => setTimeout(r, 10));
    expect(calledActions).toHaveLength(0);
  });

  it("mirrors aria-expanded on the trigger: true on open, false on close", async () => {
    const { runtime } = makeRuntime();
    const { panel, trigger } = mountMenu({}); // trigger declares aria-expanded server-side
    startStimulus({ runtime });
    await flushStimulus();

    trigger.focus();
    fireToggle(panel, "open");
    expect(trigger.getAttribute("aria-expanded")).toBe("true");

    const outside = document.createElement("button");
    document.body.appendChild(outside);
    outside.focus();
    fireToggle(panel, "closed");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });
});

describe("lv-popover on the dropdown-menu panel — morph-safety (real lievit morph)", () => {
  it("after a real morph the CONTROLLED close still fires EXACTLY once (no stacked listeners)", async () => {
    const { runtime, calledActions } = makeRuntime();
    const { componentRoot, trigger } = mountMenu({ open: true });
    startStimulus({ runtime });
    await flushStimulus();

    // A real lievit wire morph re-renders the menu subtree (idiomorph) with identical markup; the
    // controller must NOT double-connect and the toggle handler must stay single.
    morph(
      componentRoot,
      `<div data-lievit-component="com.example.Menu" data-lievit-snapshot="s2">
         <span data-slot="dropdown-menu" data-open="true">
           <button id="user-menu-trigger" type="button" data-slot="dropdown-menu-trigger"
                   aria-haspopup="menu" aria-expanded="true" aria-controls="user-menu">Open menu</button>
           <div id="user-menu" popover="auto" data-controller="lv-popover" open
                data-slot="dropdown-menu-content" role="menu" aria-labelledby="user-menu-trigger"
                aria-orientation="vertical" data-lv-opener="user-menu-trigger"
                data-lv-wire-close="close" data-lievit-collection
                data-lievit-collection-roving-tabindex="true" data-manual-activation="true">
             <button data-slot="dropdown-menu-item" role="menuitem" tabindex="-1">Profile</button>
           </div>
         </span>
       </div>`,
    );
    await flushStimulus();

    const panel = componentRoot.querySelector<HTMLElement>("#user-menu")!;
    trigger.focus();
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
    const { componentRoot, panel } = mountMenu({ open: true });
    startStimulus({ runtime });
    await flushStimulus();

    morph(
      componentRoot,
      `<div data-lievit-component="com.example.Menu" data-lievit-snapshot="s2"><span>gone</span></div>`,
    );
    await flushStimulus();

    // The detached node's toggle must no longer reach a live controller -> no wire call.
    fireToggle(panel, "closed");
    await new Promise((r) => setTimeout(r, 10));
    expect(calledActions).toHaveLength(0);
  });
});
