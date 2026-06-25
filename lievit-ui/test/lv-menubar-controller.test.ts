/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * lv-menubar Stimulus controller -- the conversion of the menubar's slice of
 * collection-nav.enhancer.ts (horizontal roving-tabindex APG Menubar). This suite proves the
 * keyboard behaviour through the REAL Stimulus Application + the REAL lievit wire morph (no mocked
 * $lievit, no mocked runtime): a fetch stub captures any `_calls` the runtime would POST, so the
 * UNCONTROLLED contract (zero round-trips) is asserted on the real wire, not assumed.
 *
 * It mirrors collection-nav.enhancer.test.ts assertion-for-assertion for the menubar config
 * (ArrowRight/Left navigation, wrap, Home/End, disabled-skip, typeahead, ArrowDown opens submenu,
 * ArrowRight in horizontal is navigation NOT submenu-open) and adds the morph-safety proof the
 * enhancer test could not state: after a real morph one ArrowRight moves focus EXACTLY one item
 * (no stacked listeners, no double-jump) and a morphed-out bar fires nothing.
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
    return new Response("<div></div>", { status: 200, headers: { "Lievit-Snapshot": "s2" } });
  });
  const runtime = new LievitRuntime({ fetchImpl: fetchImpl as unknown as typeof fetch });
  return { runtime, calledActions };
}

/** Press a key ON an element (bubbles to the bar root, where the controller listens). */
function key(el: Element, k: string): KeyboardEvent {
  const ev = new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true });
  el.dispatchEvent(ev);
  return ev;
}

interface ItemSpec {
  label: string;
  /** aria-haspopup="menu" (a dropdown-menu trigger / submenu parent). */
  submenu?: boolean;
  /** aria-disabled="true". */
  disabled?: boolean;
}

/** The bar HTML exactly as menubar.jte emits it (role=menubar + the collection contract attrs). */
function barHtml(items: ItemSpec[]): string {
  const triggers = items
    .map((it, i) => {
      const tabindex = i === 0 ? "0" : "-1";
      const pop = it.submenu === true ? ' aria-haspopup="menu"' : "";
      const dis = it.disabled === true ? ' aria-disabled="true"' : "";
      return `<button type="button" role="menuitem" data-lievit-item tabindex="${tabindex}"${pop}${dis}>${it.label}</button>`;
    })
    .join("");
  return (
    `<nav id="app-menu" role="menubar" aria-label="App menu" aria-orientation="horizontal"` +
    ` data-slot="menubar" data-size="md" data-controller="lv-menubar" data-lievit-collection` +
    ` data-lievit-collection-roving-tabindex="true" data-lievit-collection-orientation="horizontal"` +
    ` data-lievit-collection-wrap="true">${triggers}</nav>`
  );
}

interface Mounted {
  componentRoot: HTMLElement;
  bar: HTMLElement;
  triggers: HTMLButtonElement[];
}

function mountBar(items: ItemSpec[]): Mounted {
  const componentRoot = document.createElement("div");
  componentRoot.setAttribute("data-lievit-component", "com.example.M");
  componentRoot.setAttribute("data-lievit-id", `cid-${Math.random().toString(36).slice(2)}`);
  componentRoot.setAttribute("data-lievit-snapshot", "s1");
  componentRoot.innerHTML = barHtml(items);
  document.body.appendChild(componentRoot);
  const bar = componentRoot.querySelector<HTMLElement>('[data-controller="lv-menubar"]')!;
  const triggers = Array.from(bar.querySelectorAll<HTMLButtonElement>("[data-lievit-item]"));
  return { componentRoot, bar, triggers };
}

/** The index of the item currently holding tabindex=0 (the roving seed). */
function rovingIndex(triggers: HTMLElement[]): number {
  return triggers.findIndex((t) => t.tabIndex === 0);
}

const FILE_EDIT_VIEW: ItemSpec[] = [
  { label: "File", submenu: true },
  { label: "Edit", submenu: true },
  { label: "View", submenu: true },
];

beforeEach(() => {
  document.body.innerHTML = "";
});

afterEach(() => {
  stopStimulus();
  document.body.innerHTML = "";
});

describe("lv-menubar controller — horizontal roving navigation (real Stimulus)", () => {
  it("arrow_right_moves_focus_and_tabindex_to_next_trigger", async () => {
    const { runtime } = makeRuntime();
    const { triggers } = mountBar(FILE_EDIT_VIEW);
    startStimulus({ runtime });
    await flushStimulus();

    triggers[0]!.focus();
    key(triggers[0]!, "ArrowRight");

    expect(document.activeElement).toBe(triggers[1]);
    expect(rovingIndex(triggers)).toBe(1);
    expect(triggers[0]!.tabIndex).toBe(-1);
  });

  it("arrow_left_moves_focus_to_previous_trigger", async () => {
    const { runtime } = makeRuntime();
    const { triggers } = mountBar(FILE_EDIT_VIEW);
    startStimulus({ runtime });
    await flushStimulus();

    key(triggers[0]!, "ArrowRight"); // → Edit
    key(triggers[1]!, "ArrowLeft"); // → File

    expect(document.activeElement).toBe(triggers[0]);
    expect(rovingIndex(triggers)).toBe(0);
  });

  it("arrow_right_wraps_from_last_to_first (wrap=true)", async () => {
    const { runtime } = makeRuntime();
    const { triggers } = mountBar(FILE_EDIT_VIEW);
    startStimulus({ runtime });
    await flushStimulus();

    key(triggers[0]!, "ArrowRight"); // → Edit
    key(triggers[1]!, "ArrowRight"); // → View
    key(triggers[2]!, "ArrowRight"); // wraps → File

    expect(document.activeElement).toBe(triggers[0]);
    expect(rovingIndex(triggers)).toBe(0);
  });

  it("arrow_left_wraps_from_first_to_last (wrap=true)", async () => {
    const { runtime } = makeRuntime();
    const { triggers } = mountBar(FILE_EDIT_VIEW);
    startStimulus({ runtime });
    await flushStimulus();

    key(triggers[0]!, "ArrowLeft"); // wraps → View

    expect(document.activeElement).toBe(triggers[2]);
    expect(rovingIndex(triggers)).toBe(2);
  });

  it("home_focuses_first_and_end_focuses_last", async () => {
    const { runtime } = makeRuntime();
    const { triggers } = mountBar(FILE_EDIT_VIEW);
    startStimulus({ runtime });
    await flushStimulus();

    key(triggers[0]!, "End");
    expect(document.activeElement).toBe(triggers[2]);
    expect(rovingIndex(triggers)).toBe(2);

    key(triggers[2]!, "Home");
    expect(document.activeElement).toBe(triggers[0]);
    expect(rovingIndex(triggers)).toBe(0);
  });

  it("skips_disabled_items_during_navigation", async () => {
    const { runtime } = makeRuntime();
    const { triggers } = mountBar([
      { label: "File", submenu: true },
      { label: "Edit", disabled: true },
      { label: "View", submenu: true },
    ]);
    startStimulus({ runtime });
    await flushStimulus();

    key(triggers[0]!, "ArrowRight"); // skips disabled Edit → View
    expect(document.activeElement).toBe(triggers[2]);
    expect(rovingIndex(triggers)).toBe(2);
  });

  it("typeahead_jumps_to_trigger_whose_label_starts_with_typed_char", async () => {
    const { runtime } = makeRuntime();
    const { triggers } = mountBar([
      { label: "File", submenu: true },
      { label: "Edit", submenu: true },
      { label: "View", submenu: true },
    ]);
    startStimulus({ runtime });
    await flushStimulus();

    key(triggers[0]!, "v"); // → View
    expect(document.activeElement).toBe(triggers[2]);
    expect(rovingIndex(triggers)).toBe(2);
  });

  it("preventDefault_on_a_handled_navigation_key", async () => {
    const { runtime } = makeRuntime();
    const { triggers } = mountBar(FILE_EDIT_VIEW);
    startStimulus({ runtime });
    await flushStimulus();

    const ev = key(triggers[0]!, "ArrowRight");
    expect(ev.defaultPrevented).toBe(true);
  });
});

describe("lv-menubar controller — ArrowDown opens submenu (APG Menubar)", () => {
  it("arrow_down_on_submenu_trigger_dispatches_lv_collection_submenu_open", async () => {
    const { runtime } = makeRuntime();
    const { bar, triggers } = mountBar(FILE_EDIT_VIEW);
    startStimulus({ runtime });
    await flushStimulus();

    let firedTarget: EventTarget | null = null;
    bar.addEventListener("lv:collection-submenu-open", (e) => {
      firedTarget = e.target;
    });

    triggers[0]!.focus();
    const ev = key(triggers[0]!, "ArrowDown");

    expect(firedTarget).toBe(triggers[0]);
    expect(ev.defaultPrevented).toBe(true);
  });

  it("arrow_down_on_non_submenu_trigger_is_a_noop (key not consumed, no event)", async () => {
    const { runtime } = makeRuntime();
    const { bar, triggers } = mountBar([
      { label: "Help" }, // plain trigger, no aria-haspopup="menu"
      { label: "About" },
    ]);
    startStimulus({ runtime });
    await flushStimulus();

    let fired = false;
    bar.addEventListener("lv:collection-submenu-open", () => {
      fired = true;
    });

    triggers[0]!.focus();
    const ev = key(triggers[0]!, "ArrowDown");

    expect(fired).toBe(false);
    expect(ev.defaultPrevented).toBe(false); // fell through, browser default intact
  });

  it("arrow_right_is_navigation_not_submenu_open_in_horizontal_mode", async () => {
    const { runtime } = makeRuntime();
    const { bar, triggers } = mountBar(FILE_EDIT_VIEW);
    startStimulus({ runtime });
    await flushStimulus();

    let fired = false;
    bar.addEventListener("lv:collection-submenu-open", () => {
      fired = true;
    });

    triggers[0]!.focus();
    key(triggers[0]!, "ArrowRight");

    expect(fired).toBe(false); // ArrowRight roves in a horizontal bar; it never opens a submenu
    expect(document.activeElement).toBe(triggers[1]);
  });
});

describe("lv-menubar controller — UNCONTROLLED: zero wire round-trips", () => {
  it("no_gesture_round_trips_the_wire (the bar is stateless / browser-owned)", async () => {
    const { runtime, calledActions } = makeRuntime();
    const { triggers } = mountBar(FILE_EDIT_VIEW);
    startStimulus({ runtime });
    await flushStimulus();

    triggers[0]!.focus();
    key(triggers[0]!, "ArrowRight");
    key(triggers[1]!, "ArrowDown"); // submenu-open is a DOM event, not a wire call
    key(triggers[1]!, "End");
    key(triggers[2]!, "Home");
    key(triggers[0]!, "v");

    await new Promise((r) => setTimeout(r, 10));
    expect(calledActions).toHaveLength(0);
  });
});

describe("lv-menubar controller — morph-safety (real lievit morph)", () => {
  it("after_a_real_morph_one_arrow_right_moves_exactly_one_item (no stacked listeners)", async () => {
    const { runtime } = makeRuntime();
    const { componentRoot } = mountBar(FILE_EDIT_VIEW);
    startStimulus({ runtime });
    await flushStimulus();

    // A real lievit wire morph re-renders the bar subtree (idiomorph). The markup is identical, so
    // the controller must NOT be double-connected and the keydown handler must stay single.
    morph(
      componentRoot,
      `<div data-lievit-component="com.example.M" data-lievit-snapshot="s2">${barHtml(FILE_EDIT_VIEW)}</div>`,
    );
    await flushStimulus();

    const bar = componentRoot.querySelector<HTMLElement>('[data-controller="lv-menubar"]')!;
    const triggers = Array.from(bar.querySelectorAll<HTMLButtonElement>("[data-lievit-item]"));
    triggers[0]!.focus();
    key(triggers[0]!, "ArrowRight");

    // Exactly one item moved: a stacked listener would have fired twice (File → Edit → View).
    expect(document.activeElement).toBe(triggers[1]);
    expect(rovingIndex(triggers)).toBe(1);
  });

  it("a_bar_removed_by_a_morph_stops_handling_keys (disconnect tears the listener down)", async () => {
    const { runtime } = makeRuntime();
    const { componentRoot, bar, triggers } = mountBar(FILE_EDIT_VIEW);
    startStimulus({ runtime });
    await flushStimulus();

    let fired = false;
    bar.addEventListener("lv:collection-submenu-open", () => {
      fired = true;
    });

    // Morph the bar out of the tree.
    morph(
      componentRoot,
      `<div data-lievit-component="com.example.M" data-lievit-snapshot="s2"><span>gone</span></div>`,
    );
    await flushStimulus();

    // The detached node's keydown must no longer reach a live controller.
    key(triggers[0]!, "ArrowDown");
    expect(fired).toBe(false);
  });
});
