/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * notification-bell -- the native-popover seam, driven by the shared `lv-popover` Stimulus
 * controller (the conversion of `popover-anchor.enhancer.ts`). The bell is a hand-rolled native
 * popover (trigger button + role="region" panel); its one irreducible client bit -- focus-return
 * to the bell on light-dismiss (click-outside) -- is owned by the shared lv-popover controller, so
 * the conversion is `data-controller="lv-popover"` + `data-lv-opener` on the panel, NO duplicated
 * focus/dismiss controller. The controlled/uncontrolled doctrine (wire-410 fix) lives ONCE in the
 * shared DismissableController base.
 *
 * The bell template is UNCONTROLLED by design (its open state is browser-owned: it never stamps
 * data-lv-wire-close), so its close is purely client-side with ZERO wire round-trip. This suite is
 * the REAL-controller + REAL-morph proof for the bell's own panel DOM, exactly as
 * notification-bell.jte emits it: it builds that DOM, starts the REAL Stimulus Application (which
 * auto-loads lv-popover by filename) wired to the REAL LievitRuntime (a fetch stub captures the
 * `_calls` the runtime POSTs), drives native-popover toggle events, and asserts the observable DOM
 * + the wire calls. Per the convention's whole-contract rule it asserts BOTH branches of the
 * controlled/uncontrolled doctrine on the bell's panel shape (uncontrolled-silent is the bell's
 * real behaviour; the controlled variant documents that the silence is by-design, not a dead
 * controller), and proves the morph-safety the legacy enhancer test could not: after a real lievit
 * morph one light-dismiss returns focus EXACTLY once (no stacked listeners).
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
 * Build a component root + a notification-bell panel exactly as notification-bell.jte emits it: the
 * icon-only bell <button id="${id}-trigger" popovertarget=...> + the role="region" panel carrying
 * data-controller="lv-popover" and data-lv-opener="${id}-trigger". `wireClose` opts INTO the
 * controlled branch (data-lv-wire-close present) to document the doctrine boundary; the real bell
 * template omits it (uncontrolled, browser-owned open state).
 */
function mountBell(opts: { id?: string; wireClose?: string } = {}): Mounted {
  const id = opts.id ?? "lv-notification-bell";
  const triggerId = `${id}-trigger`;

  const componentRoot = document.createElement("div");
  componentRoot.setAttribute("data-lievit-component", "com.example.Bell");
  componentRoot.setAttribute("data-lievit-id", `cid-${Math.random().toString(36).slice(2)}`);
  componentRoot.setAttribute("data-lievit-snapshot", "s1");

  const wrapper = document.createElement("span");
  wrapper.setAttribute("data-slot", "notification-bell");

  const trigger = document.createElement("button");
  trigger.id = triggerId;
  trigger.type = "button";
  trigger.setAttribute("data-slot", "notification-bell-trigger");
  trigger.setAttribute("data-unread-count", "3");
  trigger.setAttribute("popovertarget", id);
  trigger.setAttribute("aria-haspopup", "listbox");
  trigger.setAttribute("aria-label", "Notifications, 3 unread");
  trigger.textContent = "bell";

  const panel = document.createElement("div");
  panel.id = id;
  panel.setAttribute("popover", "auto");
  panel.setAttribute("data-controller", "lv-popover");
  panel.setAttribute("data-lv-opener", triggerId);
  panel.setAttribute("data-slot", "notification-bell-panel");
  panel.setAttribute("role", "region");
  panel.setAttribute("aria-label", "Notifications");
  if (opts.wireClose != null) {
    panel.setAttribute("data-lv-wire-close", opts.wireClose);
  }
  const p = document.createElement("p");
  p.setAttribute("data-slot", "notification-bell-empty");
  p.textContent = "No notifications";
  panel.appendChild(p);

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

describe("lv-popover on the notification-bell panel — popover seam (real Stimulus + real runtime)", () => {
  it("returns focus to the bell on light-dismiss (click-outside)", async () => {
    const { runtime } = makeRuntime();
    const { panel, trigger } = mountBell({});
    startStimulus({ runtime });
    await flushStimulus();

    trigger.focus();
    fireToggle(panel, "open");

    // Click-outside: focus is elsewhere and the browser did NOT return it to the bell.
    const outside = document.createElement("button");
    document.body.appendChild(outside);
    outside.focus();
    expect(document.activeElement).toBe(outside);

    fireToggle(panel, "closed");
    expect(document.activeElement).toBe(trigger);
  });

  it("does not move focus when the browser already returned it to the bell (native Esc)", async () => {
    const { runtime } = makeRuntime();
    const { panel, trigger } = mountBell({});
    startStimulus({ runtime });
    await flushStimulus();

    trigger.focus();
    fireToggle(panel, "open");
    trigger.focus(); // the native popover Esc returns focus to the invoker
    const focusSpy = vi.spyOn(trigger, "focus");

    fireToggle(panel, "closed");
    expect(focusSpy).not.toHaveBeenCalled();
  });

  it("UNCONTROLLED bell fires NO wire call on close (the 410 page-expired regression)", async () => {
    const { runtime, calledActions } = makeRuntime();
    const { panel, trigger } = mountBell({}); // no data-lv-wire-close — the bell's real DOM
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
    const { panel, trigger } = mountBell({});
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

  it("CONTROLLED variant fires its close action EXACTLY once (doctrine boundary — bell omits it by design)", async () => {
    // The bell template never stamps data-lv-wire-close; this variant proves the silence above is
    // the uncontrolled DOCTRINE, not a dead controller: the same shared controller on the same bell
    // panel shape DOES round-trip once when the open state is server-owned.
    const { runtime, calledActions } = makeRuntime();
    const { panel, trigger } = mountBell({ wireClose: "close" });
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

  it("does not add aria-expanded to the bell (it declares aria-haspopup only, never opted into the mirror)", async () => {
    const { runtime } = makeRuntime();
    const { panel, trigger } = mountBell({});
    startStimulus({ runtime });
    await flushStimulus();

    expect(trigger.hasAttribute("aria-expanded")).toBe(false);
    trigger.focus();
    fireToggle(panel, "open");
    // The controller mirrors aria-expanded ONLY when the trigger already declared it; the bell
    // never did, so the controller must not invent it.
    expect(trigger.hasAttribute("aria-expanded")).toBe(false);
  });
});

describe("lv-popover on the notification-bell panel — morph-safety (real lievit morph)", () => {
  it("after a real morph one light-dismiss returns focus EXACTLY once (no stacked listeners)", async () => {
    const { runtime } = makeRuntime();
    const { componentRoot, trigger } = mountBell({});
    startStimulus({ runtime });
    await flushStimulus();

    // A real lievit wire morph re-renders the bell subtree (idiomorph) with identical markup; the
    // controller must NOT double-connect and the toggle handler must stay single (otherwise the
    // focus-return would fire twice).
    morph(
      componentRoot,
      `<div data-lievit-component="com.example.Bell" data-lievit-snapshot="s2">
         <span data-slot="notification-bell">
           <button id="lv-notification-bell-trigger" type="button" data-slot="notification-bell-trigger"
                   data-unread-count="3" popovertarget="lv-notification-bell" aria-haspopup="listbox"
                   aria-label="Notifications, 3 unread">bell</button>
           <div id="lv-notification-bell" popover="auto" data-controller="lv-popover"
                data-lv-opener="lv-notification-bell-trigger" data-slot="notification-bell-panel"
                role="region" aria-label="Notifications">
             <p data-slot="notification-bell-empty">No notifications</p>
           </div>
         </span>
       </div>`,
    );
    await flushStimulus();

    const panel = componentRoot.querySelector<HTMLElement>("#lv-notification-bell")!;
    trigger.focus();
    fireToggle(panel, "open");
    const outside = document.createElement("button");
    document.body.appendChild(outside);
    outside.focus();
    const focusSpy = vi.spyOn(trigger, "focus");

    fireToggle(panel, "closed");
    expect(focusSpy).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(trigger);
  });

  it("a panel removed by a morph stops firing (disconnect tears the listener down)", async () => {
    const { runtime } = makeRuntime();
    const { componentRoot, panel, trigger } = mountBell({});
    startStimulus({ runtime });
    await flushStimulus();

    morph(
      componentRoot,
      `<div data-lievit-component="com.example.Bell" data-lievit-snapshot="s2"><span>gone</span></div>`,
    );
    await flushStimulus();

    // The detached node's toggle must no longer reach a live controller -> no focus move, no throw.
    const outside = document.createElement("button");
    document.body.appendChild(outside);
    outside.focus();
    const focusSpy = vi.spyOn(trigger, "focus");

    fireToggle(panel, "closed");
    await new Promise((r) => setTimeout(r, 10));
    expect(focusSpy).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(outside);
  });
});
