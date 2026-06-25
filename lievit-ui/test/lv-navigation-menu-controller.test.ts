/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * lv-navigation-menu Stimulus controller -- the conversion of the collection-nav enhancer's "nav"
 * mode (APG Disclosure Navigation) for the navigation-menu component. This suite proves the
 * keyboard behaviour through the REAL Stimulus Application (auto-loaded by filename) + the REAL
 * lievit wire morph (no mocked $lievit, no mocked runtime: a fetch stub captures the actual `_calls`
 * the runtime POSTs).
 *
 * It mirrors the nav-mode assertions in collection-nav.enhancer.test.ts (arrow focus, Home/End,
 * wrap, skip-disabled, typeahead, tabindex never mutated, no aria-activedescendant, Escape action),
 * adds the controlled/uncontrolled both-branches proof (escape action fires only when declared), and
 * the morph-safety proofs the enhancer test could not state (after a real morph the controller still
 * fires its escape action EXACTLY once; a nav removed by a morph fires nothing).
 *
 * Substrate: happy-dom + the real @hotwired/stimulus Application started by startStimulus().
 * flushStimulus() awaits the MutationObserver.
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

type ItemDef = { text: string; disabled?: boolean };

interface Built {
  componentRoot: HTMLElement;
  nav: HTMLElement;
  items: HTMLButtonElement[];
}

/** Build a navigation-menu <nav> exactly as navigation-menu.jte emits it (data-controller + the
 *  established data-lievit-collection* config surface), inside a component root for the wire. */
function buildNav(opts: {
  items: ItemDef[];
  orientation?: "vertical" | "horizontal" | "both";
  wrap?: boolean;
  escapeAction?: string;
}): Built {
  const componentRoot = document.createElement("div");
  componentRoot.setAttribute("data-lievit-component", "com.example.Nav");
  componentRoot.setAttribute("data-lievit-id", `cid-${Math.random().toString(36).slice(2)}`);
  componentRoot.setAttribute("data-lievit-snapshot", "s1");

  const nav = document.createElement("nav");
  nav.setAttribute("data-slot", "navigation-menu");
  nav.setAttribute("data-controller", "lv-navigation-menu");
  nav.setAttribute("data-action", "keydown->lv-navigation-menu#onKeydown");
  nav.setAttribute("data-lievit-collection", "");
  nav.setAttribute("data-lievit-collection-mode", "nav");
  nav.setAttribute("data-lievit-collection-orientation", opts.orientation ?? "vertical");
  if (opts.wrap === true) {
    nav.setAttribute("data-lievit-collection-wrap", "true");
  }
  if (opts.escapeAction != null) {
    nav.setAttribute("data-lievit-collection-escape-action", opts.escapeAction);
  }

  const items: HTMLButtonElement[] = [];
  for (const def of opts.items) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.setAttribute("data-lievit-item", "");
    btn.id = `nav-${Math.random().toString(36).slice(2)}`;
    btn.textContent = def.text;
    // APG Disclosure Navigation: ALL items start at tabindex=0 (no roving regime).
    btn.tabIndex = 0;
    if (def.disabled === true) {
      btn.setAttribute("aria-disabled", "true");
    }
    nav.appendChild(btn);
    items.push(btn);
  }

  componentRoot.appendChild(nav);
  document.body.appendChild(componentRoot);
  return { componentRoot, nav, items };
}

/** Dispatch a keydown on the nav root (where the data-action binds the controller's handler). */
function key(el: Element, k: string, opts: KeyboardEventInit = {}): void {
  el.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true, ...opts }));
}

beforeEach(() => {
  document.body.innerHTML = "";
});

afterEach(() => {
  stopStimulus();
  document.body.innerHTML = "";
});

describe("lv-navigation-menu controller — APG Disclosure Navigation (real Stimulus + real runtime)", () => {
  it("arrow_down_moves_focus_in_vertical_nav", async () => {
    const { runtime } = makeRuntime();
    const { nav, items } = buildNav({
      items: [{ text: "Home" }, { text: "Products" }, { text: "About" }],
      orientation: "vertical",
    });
    startStimulus({ runtime });
    await flushStimulus();

    items[0].focus();
    key(nav, "ArrowDown");
    expect(document.activeElement).toBe(items[1]);
  });

  it("arrow_up_moves_focus_backwards_in_vertical_nav", async () => {
    const { runtime } = makeRuntime();
    const { nav, items } = buildNav({
      items: [{ text: "Home" }, { text: "Products" }, { text: "About" }],
      orientation: "vertical",
    });
    startStimulus({ runtime });
    await flushStimulus();

    items[2].focus();
    key(nav, "ArrowUp");
    expect(document.activeElement).toBe(items[1]);
  });

  it("tabindex_is_never_mutated", async () => {
    const { runtime } = makeRuntime();
    const { nav, items } = buildNav({
      items: [{ text: "A" }, { text: "B" }, { text: "C" }],
      orientation: "vertical",
    });
    startStimulus({ runtime });
    await flushStimulus();

    items[0].focus();
    key(nav, "ArrowDown");
    key(nav, "ArrowDown");
    key(nav, "ArrowUp");
    for (const item of items) {
      expect(item.tabIndex).toBe(0);
    }
  });

  it("aria_activedescendant_is_never_written", async () => {
    const { runtime } = makeRuntime();
    const { nav, items } = buildNav({
      items: [{ text: "A" }, { text: "B" }],
      orientation: "vertical",
    });
    startStimulus({ runtime });
    await flushStimulus();

    items[0].focus();
    key(nav, "ArrowDown");
    expect(nav.hasAttribute("aria-activedescendant")).toBe(false);
  });

  it("home_focuses_first_enabled_item", async () => {
    const { runtime } = makeRuntime();
    const { nav, items } = buildNav({
      items: [{ text: "Home" }, { text: "Products" }, { text: "About" }],
      orientation: "vertical",
    });
    startStimulus({ runtime });
    await flushStimulus();

    items[2].focus();
    key(nav, "Home");
    expect(document.activeElement).toBe(items[0]);
  });

  it("end_focuses_last_enabled_item", async () => {
    const { runtime } = makeRuntime();
    const { nav, items } = buildNav({
      items: [{ text: "Home" }, { text: "Products" }, { text: "About" }],
      orientation: "vertical",
    });
    startStimulus({ runtime });
    await flushStimulus();

    items[0].focus();
    key(nav, "End");
    expect(document.activeElement).toBe(items[2]);
  });

  it("skips_disabled_items", async () => {
    const { runtime } = makeRuntime();
    const { nav, items } = buildNav({
      items: [{ text: "Home" }, { text: "Hidden", disabled: true }, { text: "About" }],
      orientation: "vertical",
    });
    startStimulus({ runtime });
    await flushStimulus();

    items[0].focus();
    key(nav, "ArrowDown");
    expect(document.activeElement).toBe(items[2]);
  });

  it("horizontal_arrow_right_moves_focus", async () => {
    const { runtime } = makeRuntime();
    const { nav, items } = buildNav({
      items: [{ text: "Home" }, { text: "Products" }, { text: "Docs" }],
      orientation: "horizontal",
    });
    startStimulus({ runtime });
    await flushStimulus();

    items[0].focus();
    key(nav, "ArrowRight");
    expect(document.activeElement).toBe(items[1]);
  });

  it("vertical_ignores_horizontal_arrows", async () => {
    const { runtime } = makeRuntime();
    const { nav, items } = buildNav({
      items: [{ text: "Home" }, { text: "Products" }],
      orientation: "vertical",
    });
    startStimulus({ runtime });
    await flushStimulus();

    items[0].focus();
    key(nav, "ArrowRight"); // not a navigation key in vertical mode
    expect(document.activeElement).toBe(items[0]);
  });

  it("wraps_at_the_end_when_wrap_is_true", async () => {
    const { runtime } = makeRuntime();
    const { nav, items } = buildNav({
      items: [{ text: "Home" }, { text: "Products" }, { text: "About" }],
      orientation: "vertical",
      wrap: true,
    });
    startStimulus({ runtime });
    await flushStimulus();

    items[items.length - 1].focus();
    key(nav, "ArrowDown"); // wraps to first
    expect(document.activeElement).toBe(items[0]);
  });

  it("typeahead_moves_focus_and_repeated_char_cycles", async () => {
    const { runtime } = makeRuntime();
    const { nav, items } = buildNav({
      items: [{ text: "Home" }, { text: "Products" }, { text: "Pricing" }, { text: "About" }],
      orientation: "horizontal",
    });
    startStimulus({ runtime });
    await flushStimulus();

    items[0].focus();
    key(nav, "p"); // → Products
    expect(document.activeElement).toBe(items[1]);

    key(nav, "p"); // repeated → Pricing
    expect(document.activeElement).toBe(items[2]);
  });

  it("typeahead_does_not_mutate_tabindex", async () => {
    const { runtime } = makeRuntime();
    const { nav, items } = buildNav({
      items: [{ text: "Alpha" }, { text: "Beta" }],
      orientation: "horizontal",
    });
    startStimulus({ runtime });
    await flushStimulus();

    items[0].focus();
    key(nav, "b");
    expect(document.activeElement).toBe(items[1]);
    for (const item of items) {
      expect(item.tabIndex).toBe(0);
    }
  });

  // --- controlled / uncontrolled doctrine (assert BOTH branches) -------------------------------

  it("escape_fires_the_escape_action_when_declared (controlled)", async () => {
    const { runtime, calledActions } = makeRuntime();
    const { nav } = buildNav({
      items: [{ text: "Home" }],
      orientation: "vertical",
      escapeAction: "closeNav",
    });
    startStimulus({ runtime });
    await flushStimulus();

    key(nav, "Escape");
    await new Promise((r) => setTimeout(r, 10));
    expect(calledActions).toContain("closeNav");
  });

  it("escape_fires_no_wire_call_when_no_escape_action (uncontrolled — the 410 guard)", async () => {
    const { runtime, calledActions } = makeRuntime();
    const { nav } = buildNav({
      items: [{ text: "Home" }],
      orientation: "vertical",
      // no escapeAction => uncontrolled
    });
    startStimulus({ runtime });
    await flushStimulus();

    key(nav, "Escape");
    await new Promise((r) => setTimeout(r, 10));
    expect(calledActions).toHaveLength(0);
  });
});

describe("lv-navigation-menu controller — morph-safety (real lievit morph)", () => {
  it("after a real morph the escape action still fires EXACTLY once (no stacked listeners)", async () => {
    const { runtime, calledActions } = makeRuntime();
    const { componentRoot } = buildNav({
      items: [{ text: "Home" }, { text: "Products" }],
      orientation: "vertical",
      escapeAction: "closeNav",
    });
    startStimulus({ runtime });
    await flushStimulus();

    // A real lievit wire morph re-renders the component subtree (idiomorph). The nav markup is
    // identical, so the controller must NOT be double-connected and the keydown action stays single.
    morph(componentRoot, componentRoot.outerHTML);
    await flushStimulus();

    const nav = componentRoot.querySelector<HTMLElement>('[data-controller~="lv-navigation-menu"]')!;
    key(nav, "Escape");
    await new Promise((r) => setTimeout(r, 10));
    expect(calledActions.filter((a) => a === "closeNav")).toHaveLength(1);
  });

  it("a nav removed by a morph stops firing (disconnect tears the listener down)", async () => {
    const { runtime, calledActions } = makeRuntime();
    const { componentRoot, nav } = buildNav({
      items: [{ text: "Home" }],
      orientation: "vertical",
      escapeAction: "closeNav",
    });
    startStimulus({ runtime });
    await flushStimulus();

    // Morph the nav out of the tree.
    morph(
      componentRoot,
      `<div data-lievit-component="com.example.Nav" data-lievit-snapshot="s2"><span>gone</span></div>`,
    );
    await flushStimulus();

    // The detached node's keydown must no longer reach a live controller -> no wire call.
    key(nav, "Escape");
    await new Promise((r) => setTimeout(r, 10));
    expect(calledActions).toHaveLength(0);
  });
});
