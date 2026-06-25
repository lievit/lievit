/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * lv-context-menu Stimulus controller -- the conversion of context-menu-trigger.enhancer.ts. The
 * irreducible client gesture (right-click / APG keyboard open, pointer positioning, light-dismiss,
 * focus restore) and the controlled/uncontrolled doctrine (wire-410 fix, now in the shared
 * DismissableController base) are proven through the REAL @hotwired/stimulus Application + the REAL
 * lievit wire morph (no mocked $lievit, no mocked runtime: a fetch stub captures the `_calls` the
 * runtime POSTs).
 *
 * It carries every branch the old context-menu.test.ts section C enhancer suite asserted
 * (preventDefault, data-menu-x/y stamping, ContextMenu key + Shift+F10, Escape close, outside-click
 * dismiss, inside-click keeps open, focus save+restore, idempotency), restated against the real
 * controller, PLUS the two doctrine cases the partial enhancer never had (controlled fires close /
 * uncontrolled silent) and the morph-safety the enhancer test could not state (one gesture => one
 * effect after a real morph; a removed element fires nothing).
 *
 * Substrate: happy-dom + the real Stimulus Application started by startStimulus() (auto-loads
 * controllers by filename). flushStimulus() awaits the MutationObserver.
 */
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";

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
  componentRoot: HTMLElement;
  root: HTMLElement;
  trigger: HTMLElement;
  panel: HTMLElement | null;
  panelId: string;
}

/** Build the DOM exactly as context-menu.jte emits it: a wire component wrapping the lv-context-menu root. */
function mountMenu(opts: { open?: boolean; wireClose?: string } = {}): Mounted {
  const open = opts.open ?? true;
  const panelId = "ctx-" + Math.random().toString(36).slice(2) + "-panel";

  const componentRoot = document.createElement("div");
  componentRoot.setAttribute("data-lievit-component", "com.example.C");
  componentRoot.setAttribute("data-lievit-id", `cid-${Math.random().toString(36).slice(2)}`);
  componentRoot.setAttribute("data-lievit-snapshot", "s1");

  const root = document.createElement("div");
  root.setAttribute("data-controller", "lv-context-menu");
  root.setAttribute("data-slot", "context-menu");
  root.setAttribute("data-panel-id", panelId);
  if (opts.wireClose != null) {
    root.setAttribute("data-lv-wire-close", opts.wireClose);
  }

  const trigger = document.createElement("div");
  trigger.setAttribute("data-slot", "context-menu-trigger");
  trigger.setAttribute("data-context-menu-for", panelId);
  trigger.setAttribute(
    "data-action",
    "contextmenu->lv-context-menu#openFromPointer keydown->lv-context-menu#openFromKeyboard",
  );
  trigger.tabIndex = 0;
  root.appendChild(trigger);

  let panel: HTMLElement | null = null;
  if (open) {
    panel = document.createElement("div");
    panel.id = panelId;
    panel.setAttribute("data-lv-context-menu-target", "panel");
    panel.setAttribute("data-slot", "context-menu-panel");
    panel.setAttribute("role", "menu");
    panel.setAttribute("tabindex", "-1");
    const item = document.createElement("button");
    item.setAttribute("role", "menuitem");
    item.textContent = "Rename";
    panel.appendChild(item);
    root.appendChild(panel);
  }

  componentRoot.appendChild(root);
  document.body.appendChild(componentRoot);
  return { componentRoot, root, trigger, panel, panelId };
}

function fireContextMenu(target: EventTarget, x: number, y: number): MouseEvent {
  const ev = new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: x, clientY: y });
  target.dispatchEvent(ev);
  return ev;
}

function pressKey(target: EventTarget, key: string, init: KeyboardEventInit = {}): KeyboardEvent {
  const ev = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(ev);
  return ev;
}

beforeEach(() => {
  document.body.innerHTML = "";
});

afterEach(() => {
  stopStimulus();
  document.body.innerHTML = "";
});

describe("lv-context-menu controller — open + positioning (real Stimulus)", () => {
  it("right_click_suppresses_native_menu_and_stamps_pointer_coordinates", async () => {
    const { runtime } = makeRuntime();
    const { trigger, panelId } = mountMenu();
    startStimulus({ runtime });
    await flushStimulus();

    const ev = fireContextMenu(trigger, 123, 456);

    expect(ev.defaultPrevented, "the native browser menu must be suppressed").toBe(true);
    const panel = document.getElementById(panelId)!;
    expect(panel.getAttribute("data-menu-x")).toBe("123");
    expect(panel.getAttribute("data-menu-y")).toBe("456");
  });

  it("contextmenu_key_opens_at_the_trigger_box (APG keyboard parity)", async () => {
    const { runtime } = makeRuntime();
    const { trigger, panelId } = mountMenu();
    startStimulus({ runtime });
    await flushStimulus();

    const ev = pressKey(trigger, "ContextMenu");

    expect(ev.defaultPrevented).toBe(true);
    const panel = document.getElementById(panelId)!;
    expect(panel.hasAttribute("data-menu-x")).toBe(true);
    expect(Number(panel.getAttribute("data-menu-x"))).toEqual(expect.any(Number));
  });

  it("shift_f10_opens_too (the other APG affordance)", async () => {
    const { runtime } = makeRuntime();
    const { trigger, panelId } = mountMenu();
    startStimulus({ runtime });
    await flushStimulus();

    const ev = pressKey(trigger, "F10", { shiftKey: true });

    expect(ev.defaultPrevented).toBe(true);
    expect(document.getElementById(panelId)!.hasAttribute("data-menu-x")).toBe(true);
  });

  it("a_plain_key_on_the_trigger_does_not_open (only ContextMenu / Shift+F10)", async () => {
    const { runtime } = makeRuntime();
    const { trigger, panelId } = mountMenu();
    startStimulus({ runtime });
    await flushStimulus();

    const ev = pressKey(trigger, "F10"); // no shift
    expect(ev.defaultPrevented).toBe(false);
    expect(document.getElementById(panelId)!.hasAttribute("data-menu-x")).toBe(false);
  });
});

describe("lv-context-menu controller — dismiss + focus", () => {
  it("escape_closes_and_clears_the_coordinate_attributes", async () => {
    const { runtime } = makeRuntime();
    const { trigger, panelId } = mountMenu();
    startStimulus({ runtime });
    await flushStimulus();

    fireContextMenu(trigger, 10, 20);
    const panel = document.getElementById(panelId)!;
    expect(panel.getAttribute("data-menu-x")).toBe("10");

    pressKey(document, "Escape");
    expect(panel.hasAttribute("data-menu-x")).toBe(false);
    expect(panel.hasAttribute("data-menu-y")).toBe(false);
  });

  it("outside_mousedown_closes_but_inside_mousedown_keeps_open", async () => {
    const { runtime } = makeRuntime();
    const { trigger, panel, panelId } = mountMenu();
    startStimulus({ runtime });
    await flushStimulus();

    fireContextMenu(trigger, 5, 5);
    expect(document.getElementById(panelId)!.hasAttribute("data-menu-x")).toBe(true);

    // inside: keeps open
    panel!.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    expect(document.getElementById(panelId)!.hasAttribute("data-menu-x")).toBe(true);

    // outside: closes
    document.body.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    expect(document.getElementById(panelId)!.hasAttribute("data-menu-x")).toBe(false);
  });

  it("escape_with_no_open_menu_is_a_noop", async () => {
    const { runtime } = makeRuntime();
    const { panelId } = mountMenu();
    startStimulus({ runtime });
    await flushStimulus();

    // never opened: Escape must not throw nor stamp/clear anything.
    expect(() => pressKey(document, "Escape")).not.toThrow();
    expect(document.getElementById(panelId)!.hasAttribute("data-menu-x")).toBe(false);
  });

  it("focus_returns_to_the_element_active_when_the_menu_opened", async () => {
    const { runtime } = makeRuntime();
    const { root, trigger } = mountMenu();
    const button = document.createElement("button");
    button.textContent = "Focusable";
    root.insertBefore(button, trigger);
    startStimulus({ runtime });
    await flushStimulus();

    button.focus();
    expect(document.activeElement).toBe(button);

    fireContextMenu(trigger, 1, 1);
    pressKey(document, "Escape");
    expect(document.activeElement).toBe(button);
  });
});

describe("lv-context-menu controller — controlled / uncontrolled doctrine (wire-410)", () => {
  it("controlled_menu_fires_its_close_action_once_on_dismiss", async () => {
    const { runtime, calledActions } = makeRuntime();
    const { trigger } = mountMenu({ wireClose: "close" });
    startStimulus({ runtime });
    await flushStimulus();

    fireContextMenu(trigger, 7, 7);
    document.body.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));

    await new Promise((r) => setTimeout(r, 10));
    expect(calledActions.filter((a) => a === "close")).toHaveLength(1);
  });

  it("custom_close_action_via_data_lv_wire_close", async () => {
    const { runtime, calledActions } = makeRuntime();
    const { trigger } = mountMenu({ wireClose: "dismissMenu" });
    startStimulus({ runtime });
    await flushStimulus();

    fireContextMenu(trigger, 7, 7);
    pressKey(document, "Escape");

    await new Promise((r) => setTimeout(r, 10));
    expect(calledActions).toContain("dismissMenu");
    expect(calledActions).not.toContain("close");
  });

  it("uncontrolled_menu_fires_no_wire_call_on_close (the 410 page-expired regression)", async () => {
    const { runtime, calledActions } = makeRuntime();
    const { trigger } = mountMenu(); // no data-lv-wire-close
    startStimulus({ runtime });
    await flushStimulus();

    fireContextMenu(trigger, 7, 7);
    document.body.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    pressKey(document, "Escape");

    await new Promise((r) => setTimeout(r, 10));
    expect(calledActions).toHaveLength(0);
  });
});

describe("lv-context-menu controller — morph-safety (real lievit morph)", () => {
  it("after_a_real_morph_one_gesture_still_fires_close_exactly_once (no stacked listeners)", async () => {
    const { runtime, calledActions } = makeRuntime();
    const { componentRoot, panelId } = mountMenu({ wireClose: "close" });
    startStimulus({ runtime });
    await flushStimulus();

    // A real wire morph re-renders the subtree (idiomorph). Identical markup => the controller must
    // not double-connect and the document dismiss listeners must stay single.
    morph(
      componentRoot,
      `<div data-lievit-component="com.example.C" data-lievit-snapshot="s2">
         <div data-controller="lv-context-menu" data-slot="context-menu" data-panel-id="${panelId}" data-lv-wire-close="close">
           <div data-slot="context-menu-trigger" data-context-menu-for="${panelId}"
                data-action="contextmenu->lv-context-menu#openFromPointer keydown->lv-context-menu#openFromKeyboard" tabindex="0"></div>
           <div id="${panelId}" data-lv-context-menu-target="panel" data-slot="context-menu-panel" role="menu" tabindex="-1"><button role="menuitem">Rename</button></div>
         </div>
       </div>`,
    );
    await flushStimulus();

    const trigger = componentRoot.querySelector<HTMLElement>('[data-slot="context-menu-trigger"]')!;
    fireContextMenu(trigger, 9, 9);
    document.body.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));

    await new Promise((r) => setTimeout(r, 10));
    expect(calledActions.filter((a) => a === "close")).toHaveLength(1);
  });

  it("a_menu_removed_by_a_morph_stops_firing (disconnect tears the listeners down)", async () => {
    const { runtime, calledActions } = makeRuntime();
    const { componentRoot, trigger } = mountMenu({ wireClose: "close" });
    startStimulus({ runtime });
    await flushStimulus();

    fireContextMenu(trigger, 3, 3); // open it

    // Morph the whole context-menu out of the tree.
    morph(
      componentRoot,
      `<div data-lievit-component="com.example.C" data-lievit-snapshot="s2"><span>gone</span></div>`,
    );
    await flushStimulus();

    // The torn-down document listeners must not fire close any more.
    pressKey(document, "Escape");
    document.body.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));

    await new Promise((r) => setTimeout(r, 10));
    expect(calledActions).toHaveLength(0);
  });
});
