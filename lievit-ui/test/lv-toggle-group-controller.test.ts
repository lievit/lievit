/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * lv-toggle-group Stimulus controller -- the Radix ToggleGroup / RovingFocusGroup keyboard model.
 * The toggle-group wire template had NO prior enhancer (it shipped server-only, leaning on native
 * Tab); this controller supplies the roving-tabindex + Arrow/Home/End focus movement that the
 * `role="radiogroup"`/`role="radio"` markup mandates per WAI-ARIA. Selection stays server-owned
 * (`l:click="$set('toggleValue', ...)"`), so this controller NEVER round-trips the wire -- the
 * "uncontrolled / client-only" guarantee asserted below is this component's form of the
 * controlled/uncontrolled doctrine (zero `/lievit/<id>/call` ever originates here).
 *
 * Proven through the REAL @hotwired/stimulus Application (auto-loads by filename) + the REAL lievit
 * wire morph (idiomorph) + a fetch stub that captures any `_calls` the runtime would POST. No mocked
 * $lievit, no mocked runtime. Substrate: happy-dom; flushStimulus() awaits the MutationObserver.
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
    return new Response("<div></div>", { status: 200, headers: { "Lievit-Snapshot": "s2" } });
  });
  const runtime = new LievitRuntime({ fetchImpl: fetchImpl as unknown as typeof fetch });
  return { runtime, calledActions };
}

interface ItemSpec {
  readonly value: string;
  readonly selected?: boolean;
  readonly disabled?: boolean;
}

/** The HTML the toggle-group.jte emits for one item button (selection + roving attrs included). */
function itemHtml(spec: ItemSpec, single: boolean): string {
  const aria = single
    ? `role="radio" aria-checked="${spec.selected ? "true" : "false"}"`
    : `role="button" aria-pressed="${spec.selected ? "true" : "false"}"`;
  const disabled = spec.disabled === true ? " disabled" : "";
  return (
    `<button type="button" data-toggle-group-item="${spec.value}" ` +
    `data-lv-toggle-group-target="item" ${aria}${disabled} ` +
    `l:click="$set('toggleValue', '${spec.value}')">` +
    `<span data-toggle-group-label>${spec.value}</span></button>`
  );
}

/** The component root HTML the toggle-group.jte emits (single or multiple mode). */
function groupHtml(items: ItemSpec[], mode: "single" | "multiple", snapshot = "s1"): string {
  const single = mode === "single";
  return (
    `<div data-lievit-component="com.example.TG" data-lievit-id="tg-1" ` +
    `data-lievit-snapshot="${snapshot}" data-toggle-group data-controller="lv-toggle-group" ` +
    `data-action="keydown->lv-toggle-group#onKeydown" role="${single ? "radiogroup" : "group"}">` +
    items.map((i) => itemHtml(i, single)).join("") +
    `</div>`
  );
}

/** Mount a toggle-group exactly as the .jte emits it and return the live root + its item buttons. */
function mount(
  items: ItemSpec[],
  mode: "single" | "multiple" = "single",
): { root: HTMLElement; buttons: HTMLButtonElement[] } {
  const tpl = document.createElement("template");
  tpl.innerHTML = groupHtml(items, mode);
  const root = tpl.content.firstElementChild as HTMLElement;
  document.body.appendChild(root);
  const buttons = Array.from(root.querySelectorAll<HTMLButtonElement>("[data-toggle-group-item]"));
  return { root, buttons };
}

function pressKey(el: Element, key: string): KeyboardEvent {
  const ev = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
  el.dispatchEvent(ev);
  return ev;
}

const tabindexOf = (b: HTMLButtonElement): string | null => b.getAttribute("tabindex");

beforeEach(() => {
  document.body.innerHTML = "";
});

afterEach(() => {
  stopStimulus();
  document.body.innerHTML = "";
});

describe("lv-toggle-group controller — roving tabindex init (real Stimulus)", () => {
  it("makes exactly one tab stop: the selected item, others -1", async () => {
    const { runtime } = makeRuntime();
    const { buttons } = mount([
      { value: "a" },
      { value: "b", selected: true },
      { value: "c" },
    ]);
    startStimulus({ runtime });
    await flushStimulus();

    expect(buttons.map(tabindexOf)).toEqual(["-1", "0", "-1"]);
  });

  it("falls back to the first enabled item when nothing is selected", async () => {
    const { runtime } = makeRuntime();
    const { buttons } = mount([{ value: "a", disabled: true }, { value: "b" }, { value: "c" }]);
    startStimulus({ runtime });
    await flushStimulus();

    // a is disabled (no tabindex written), b is the first ENABLED -> the stop.
    expect(tabindexOf(buttons[0]!)).toBeNull();
    expect(tabindexOf(buttons[1]!)).toBe("0");
    expect(tabindexOf(buttons[2]!)).toBe("-1");
  });

  it("multiple mode reads aria-pressed and stops on the first selected", async () => {
    const { runtime } = makeRuntime();
    const { buttons } = mount(
      [{ value: "a" }, { value: "b", selected: true }, { value: "c", selected: true }],
      "multiple",
    );
    startStimulus({ runtime });
    await flushStimulus();

    expect(buttons.map(tabindexOf)).toEqual(["-1", "0", "-1"]);
  });
});

describe("lv-toggle-group controller — Arrow/Home/End focus movement", () => {
  it("ArrowRight moves focus to the next item and shifts the single tab stop", async () => {
    const { runtime } = makeRuntime();
    const { buttons } = mount([{ value: "a", selected: true }, { value: "b" }, { value: "c" }]);
    startStimulus({ runtime });
    await flushStimulus();

    buttons[0]!.focus();
    const ev = pressKey(buttons[0]!, "ArrowRight");

    expect(ev.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(buttons[1]);
    expect(buttons.map(tabindexOf)).toEqual(["-1", "0", "-1"]);
  });

  it("ArrowLeft moves to the previous item", async () => {
    const { runtime } = makeRuntime();
    const { buttons } = mount([{ value: "a" }, { value: "b", selected: true }, { value: "c" }]);
    startStimulus({ runtime });
    await flushStimulus();

    buttons[1]!.focus();
    pressKey(buttons[1]!, "ArrowLeft");

    expect(document.activeElement).toBe(buttons[0]);
  });

  it("wraps: ArrowRight on the last item goes to the first, ArrowLeft on the first to the last", async () => {
    const { runtime } = makeRuntime();
    const { buttons } = mount([{ value: "a" }, { value: "b" }, { value: "c" }]);
    startStimulus({ runtime });
    await flushStimulus();

    buttons[2]!.focus();
    pressKey(buttons[2]!, "ArrowRight");
    expect(document.activeElement).toBe(buttons[0]);

    pressKey(buttons[0]!, "ArrowLeft");
    expect(document.activeElement).toBe(buttons[2]);
  });

  it("Home focuses the first enabled item, End the last", async () => {
    const { runtime } = makeRuntime();
    const { buttons } = mount([{ value: "a" }, { value: "b" }, { value: "c" }]);
    startStimulus({ runtime });
    await flushStimulus();

    buttons[1]!.focus();
    pressKey(buttons[1]!, "End");
    expect(document.activeElement).toBe(buttons[2]);

    pressKey(buttons[2]!, "Home");
    expect(document.activeElement).toBe(buttons[0]);
  });

  it("skips a disabled item when navigating", async () => {
    const { runtime } = makeRuntime();
    const { buttons } = mount([{ value: "a" }, { value: "b", disabled: true }, { value: "c" }]);
    startStimulus({ runtime });
    await flushStimulus();

    buttons[0]!.focus();
    pressKey(buttons[0]!, "ArrowRight");

    expect(document.activeElement).toBe(buttons[2]);
  });

  it("ignores non-navigation keys (they reach the platform, focus unchanged)", async () => {
    const { runtime } = makeRuntime();
    const { buttons } = mount([{ value: "a", selected: true }, { value: "b" }]);
    startStimulus({ runtime });
    await flushStimulus();

    buttons[0]!.focus();
    const ev = pressKey(buttons[0]!, "a");

    expect(ev.defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(buttons[0]);
  });
});

describe("lv-toggle-group controller — client-only (never round-trips the wire)", () => {
  it("a full arrow + Home/End sweep fires ZERO wire calls (selection stays the server's l:click)", async () => {
    const { runtime, calledActions } = makeRuntime();
    const { buttons } = mount([{ value: "a", selected: true }, { value: "b" }, { value: "c" }]);
    startStimulus({ runtime });
    await flushStimulus();

    buttons[0]!.focus();
    pressKey(buttons[0]!, "ArrowRight");
    pressKey(buttons[1]!, "ArrowRight");
    pressKey(buttons[2]!, "Home");
    pressKey(buttons[0]!, "End");

    await new Promise((r) => setTimeout(r, 10));
    expect(calledActions).toHaveLength(0);
  });
});

describe("lv-toggle-group controller — morph-safety (real lievit morph)", () => {
  it("re-establishes the roving stop after a wire morph that re-renders the group", async () => {
    const { runtime, calledActions } = makeRuntime();
    const { root } = mount([{ value: "a", selected: true }, { value: "b" }, { value: "c" }]);
    startStimulus({ runtime });
    await flushStimulus();

    // The wire re-renders with a NEW selection (b now selected). idiomorph strips the JS-set
    // tabindex (the server markup has none) and flips aria-checked; the controller's MutationObserver
    // must re-derive the single tab stop onto the newly-selected b.
    morph(root, groupHtml([{ value: "a" }, { value: "b", selected: true }, { value: "c" }], "single", "s2"));
    await flushStimulus();
    await new Promise((r) => setTimeout(r, 0));

    const buttons = Array.from(root.querySelectorAll<HTMLButtonElement>("[data-toggle-group-item]"));
    expect(buttons.map(tabindexOf)).toEqual(["-1", "0", "-1"]);

    // And exactly ONE move per key (no stacked listeners from the morph).
    buttons[1]!.focus();
    pressKey(buttons[1]!, "ArrowRight");
    expect(document.activeElement).toBe(buttons[2]);
    expect(calledActions).toHaveLength(0);
  });

  it("a group removed by a morph stops responding (disconnect tears the observer + action down)", async () => {
    const { runtime, calledActions } = makeRuntime();
    const { root, buttons } = mount([{ value: "a", selected: true }, { value: "b" }]);
    startStimulus({ runtime });
    await flushStimulus();

    const wrapper = document.createElement("div");
    document.body.appendChild(wrapper);
    wrapper.appendChild(root); // give the root a parent so a morph can drop it
    morph(wrapper, `<div><span>gone</span></div>`);
    await flushStimulus();

    // The detached buttons no longer reach a live controller: keydown is inert, no wire call, no throw.
    buttons[0]!.focus();
    expect(() => pressKey(buttons[0]!, "ArrowRight")).not.toThrow();
    await new Promise((r) => setTimeout(r, 10));
    expect(calledActions).toHaveLength(0);
  });
});
