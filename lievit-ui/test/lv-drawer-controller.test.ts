/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * lv-drawer Stimulus controller -- the conversion of the drawer partial's reliance on the shared
 * focus-trap.enhancer.ts. The focus-mechanics (Tab trap + scroll-lock + return-focus + initial
 * focus) live in the shared FocusTrap; the controlled/uncontrolled close doctrine (the wire-410
 * fix) lives in the shared DismissableController base. This suite proves the WHOLE contract
 * through the REAL Stimulus Application + the REAL lievit wire morph (no mocked $lievit, no mocked
 * runtime: a fetch stub captures the actual `_calls` the runtime POSTs).
 *
 * It pins, per the convention's mandatory cases:
 *  - behaviour parity: open -> trap active (initial focus moved in + body scroll-locked);
 *    close -> trap dropped (scroll-lock released + focus returned to the opener);
 *  - controlled fires / uncontrolled silent: a controlled panel (data-lv-wire-close present)
 *    fires its close on Escape exactly once; an uncontrolled / must-act panel (absent) is silent
 *    AND keeps the trap (Escape inert);
 *  - morph-safety: after a real morph the Escape close still fires EXACTLY once (no stacked
 *    document listeners); a panel removed by a morph tears its trap down (no leaked listener).
 *
 * Substrate: happy-dom + the real @hotwired/stimulus Application started by startStimulus(), which
 * auto-loads controllers by filename. flushStimulus() awaits the MutationObserver (the open-value
 * mutation a morph performs is observed there).
 */
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";

import { LievitRuntime } from "../runtime/runtime.js";
import { morph } from "../runtime/morph.js";
import { startStimulus, stopStimulus, flushStimulus } from "../runtime/stimulus/application.js";

const SCROLL_LOCK_ATTR = "data-lievit-trap-scroll-lock";

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

/** The controlled+modal panel markup exactly as drawer.jte emits it (component root = the caller's @Wire). */
function panelHtml(opts: { open: boolean; wireClose?: string }): string {
  const hidden = opts.open ? "" : "hidden";
  const wireClose = opts.wireClose != null ? `data-lv-wire-close="${opts.wireClose}"` : "";
  return `
    <div id="lv-drawer" data-slot="drawer-panel" data-placement="right" data-size="md"
         data-modal="true" role="dialog" aria-modal="true" aria-labelledby="lv-drawer-title"
         ${hidden}
         data-controller="lv-drawer"
         data-lv-drawer-open-value="${opts.open ? "true" : "false"}"
         ${wireClose}>
      <div data-slot="drawer-header">
        <h2 data-slot="drawer-title" id="lv-drawer-title">Detail</h2>
        <button type="button" data-slot="drawer-close" aria-label="Close">x</button>
      </div>
      <div data-slot="drawer-body"><a href="#one">one</a><a href="#two">two</a></div>
    </div>`;
}

interface Mounted {
  componentRoot: HTMLElement;
  panel: HTMLElement;
  opener: HTMLButtonElement;
}

/** Build the caller's component root + the drawer panel; the opener simulates the trigger that opened it. */
function mountDrawer(opts: { open: boolean; wireClose?: string }): Mounted {
  const opener = document.createElement("button");
  opener.id = "the-trigger";
  opener.textContent = "Open drawer";
  document.body.appendChild(opener);

  const componentRoot = document.createElement("div");
  componentRoot.setAttribute("data-lievit-component", "com.example.Detail");
  componentRoot.setAttribute("data-lievit-id", `cid-${Math.random().toString(36).slice(2)}`);
  componentRoot.setAttribute("data-lievit-snapshot", "s1");
  componentRoot.innerHTML = panelHtml(opts);

  document.body.appendChild(componentRoot);
  const panel = componentRoot.querySelector<HTMLElement>("#lv-drawer")!;
  return { componentRoot, panel, opener };
}

function pressEscape(): void {
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
}

beforeEach(() => {
  document.body.innerHTML = "";
  document.body.style.overflow = "";
  document.body.removeAttribute(SCROLL_LOCK_ATTR);
});

afterEach(async () => {
  // Remove the controller elements FIRST and let Stimulus observe the removal: that fires
  // disconnect() -> deactivateTrap, which removes each FocusTrap's document-level keydown listener
  // (FocusTrap binds on document, not the element, so a leaked Escape listener would bleed the
  // close call into the next test). This is the same morph-removal teardown the controller relies
  // on in production; stopStimulus() then forgets the application.
  document.body.innerHTML = "";
  await flushStimulus();
  stopStimulus();
  document.body.style.overflow = "";
  document.body.removeAttribute(SCROLL_LOCK_ATTR);
});

describe("lv-drawer controller — focus trap activation (real Stimulus + real runtime)", () => {
  it("an_open_panel_traps_focus_on_connect_moving_initial_focus_into_the_panel", async () => {
    const { runtime } = makeRuntime();
    const { panel } = mountDrawer({ open: true, wireClose: "closeDrawer" });
    startStimulus({ runtime });
    await flushStimulus();

    expect(panel.contains(document.activeElement)).toBe(true);
    expect(document.body.hasAttribute(SCROLL_LOCK_ATTR)).toBe(true);
  });

  it("a_closed_panel_does_not_trap (open=false => no scroll-lock, no focus move)", async () => {
    const { runtime } = makeRuntime();
    const { panel } = mountDrawer({ open: false, wireClose: "closeDrawer" });
    startStimulus({ runtime });
    await flushStimulus();

    expect(panel.contains(document.activeElement)).toBe(false);
    expect(document.body.hasAttribute(SCROLL_LOCK_ATTR)).toBe(false);
  });

  it("a_morph_flipping_open_false_to_true_activates_the_trap (the server-owned open path)", async () => {
    const { runtime } = makeRuntime();
    const { componentRoot } = mountDrawer({ open: false, wireClose: "closeDrawer" });
    startStimulus({ runtime });
    await flushStimulus();
    expect(document.body.hasAttribute(SCROLL_LOCK_ATTR)).toBe(false);

    // The server re-renders the partial with open=true: idiomorph removes `hidden` + flips the
    // open value; Stimulus fires openValueChanged(true) and the controller holds the trap.
    morph(
      componentRoot,
      `<div data-lievit-component="com.example.Detail" data-lievit-snapshot="s2">${panelHtml({
        open: true,
        wireClose: "closeDrawer",
      })}</div>`,
    );
    await flushStimulus();

    const panel = componentRoot.querySelector<HTMLElement>("#lv-drawer")!;
    expect(panel.contains(document.activeElement)).toBe(true);
    expect(document.body.hasAttribute(SCROLL_LOCK_ATTR)).toBe(true);
  });

  it("a_morph_flipping_open_true_to_false_releases_the_trap_and_returns_focus", async () => {
    const { runtime } = makeRuntime();
    const { componentRoot, opener } = mountDrawer({ open: false, wireClose: "closeDrawer" });
    opener.focus();
    startStimulus({ runtime });
    await flushStimulus();

    // open it (trap records the opener as the return target) ...
    morph(
      componentRoot,
      `<div data-lievit-component="com.example.Detail" data-lievit-snapshot="s2">${panelHtml({
        open: true,
        wireClose: "closeDrawer",
      })}</div>`,
    );
    await flushStimulus();
    expect(document.body.hasAttribute(SCROLL_LOCK_ATTR)).toBe(true);

    // ... then the server closes it: trap deactivates, scroll-lock lifts, focus returns to opener.
    morph(
      componentRoot,
      `<div data-lievit-component="com.example.Detail" data-lievit-snapshot="s3">${panelHtml({
        open: false,
        wireClose: "closeDrawer",
      })}</div>`,
    );
    await flushStimulus();

    expect(document.body.hasAttribute(SCROLL_LOCK_ATTR)).toBe(false);
    expect(document.activeElement).toBe(opener);
  });
});

describe("lv-drawer controller — controlled/uncontrolled close doctrine on Escape", () => {
  it("controlled_panel_fires_close_action_exactly_once_on_escape", async () => {
    const { runtime, calledActions } = makeRuntime();
    mountDrawer({ open: true, wireClose: "closeDrawer" });
    startStimulus({ runtime });
    await flushStimulus();

    pressEscape();
    await new Promise((r) => setTimeout(r, 10));
    expect(calledActions.filter((a) => a === "closeDrawer")).toHaveLength(1);
  });

  it("must_act_panel_without_wire_close_fires_no_call_and_keeps_the_trap (Escape inert)", async () => {
    const { runtime, calledActions } = makeRuntime();
    const { panel } = mountDrawer({ open: true }); // no data-lv-wire-close => uncontrolled / !closable
    startStimulus({ runtime });
    await flushStimulus();

    pressEscape();
    await new Promise((r) => setTimeout(r, 10));
    expect(calledActions).toHaveLength(0);
    // The trap still holds: Escape did not close, the body stays scroll-locked.
    expect(document.body.hasAttribute(SCROLL_LOCK_ATTR)).toBe(true);
    expect(panel.contains(document.activeElement)).toBe(true);
  });
});

describe("lv-drawer controller — morph-safety (real lievit morph)", () => {
  it("after_a_real_morph_the_escape_close_still_fires_exactly_once (no stacked listeners)", async () => {
    const { runtime, calledActions } = makeRuntime();
    const { componentRoot } = mountDrawer({ open: true, wireClose: "closeDrawer" });
    startStimulus({ runtime });
    await flushStimulus();

    // A real wire morph re-renders the open panel with identical markup. The controller must NOT
    // double-connect and the FocusTrap's document keydown must stay single.
    morph(
      componentRoot,
      `<div data-lievit-component="com.example.Detail" data-lievit-snapshot="s2">${panelHtml({
        open: true,
        wireClose: "closeDrawer",
      })}</div>`,
    );
    await flushStimulus();

    pressEscape();
    await new Promise((r) => setTimeout(r, 10));
    expect(calledActions.filter((a) => a === "closeDrawer")).toHaveLength(1);
  });

  it("a_panel_removed_by_a_morph_tears_the_trap_down (no leaked listener, scroll-lock released)", async () => {
    const { runtime, calledActions } = makeRuntime();
    const { componentRoot } = mountDrawer({ open: true, wireClose: "closeDrawer" });
    startStimulus({ runtime });
    await flushStimulus();
    expect(document.body.hasAttribute(SCROLL_LOCK_ATTR)).toBe(true);

    // Morph the panel out of the tree (e.g. destroyOnClose): disconnect() must deactivate the trap.
    morph(
      componentRoot,
      `<div data-lievit-component="com.example.Detail" data-lievit-snapshot="s2"><span>gone</span></div>`,
    );
    await flushStimulus();

    expect(document.body.hasAttribute(SCROLL_LOCK_ATTR)).toBe(false);
    pressEscape();
    await new Promise((r) => setTimeout(r, 10));
    expect(calledActions).toHaveLength(0);
  });
});
