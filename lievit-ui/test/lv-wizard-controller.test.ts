/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * lv-wizard Stimulus controller -- the conversion of the wizard's slice of
 * collection-nav.enhancer.ts (skippable-mode APG Tabs roving-tabindex with manual activation). This
 * suite proves the keyboard behaviour through the REAL Stimulus Application + the REAL lievit wire
 * morph (no mocked $lievit, no mocked runtime): a fetch stub captures any `_calls` the runtime would
 * POST, so the CONTROLLED activation (`goTo` fires once) AND the uncontrolled-safe path (no
 * select-action => zero round-trips) are asserted on the real wire, not assumed.
 *
 * It mirrors the roving slice assertion-for-assertion for the wizard config (ArrowRight/Left +
 * ArrowDown/Up navigation per orientation, wrap, Home/End, disabled-skip, unreachable steps absent
 * from the order, typeahead, manual activation = Arrow moves focus only, Enter/Space commit `goTo`)
 * and adds the morph-safety proof the enhancer test could not state: after a real morph one
 * ArrowRight moves focus EXACTLY one step (no stacked listeners, no double-jump) and a morphed-out
 * step-list fires nothing.
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

/** Press a key ON an element (bubbles to the step-list root, where the controller's data-action listens). */
function key(el: Element, k: string): KeyboardEvent {
  const ev = new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true });
  el.dispatchEvent(ev);
  return ev;
}

interface StepSpec {
  label: string;
  /** aria-disabled="true" defence-in-depth (an item the controller must skip even if marked). */
  disabled?: boolean;
  /** Withhold data-lievit-item (an unreachable step: not in the roving order at all). */
  unreachable?: boolean;
}

interface BuildOpts {
  orientation?: "horizontal" | "vertical";
  /** Drop the select-action attribute => the UNCONTROLLED path (callWire is a no-op on commit). */
  noSelectAction?: boolean;
}

/** The step-list <ol> exactly as wizard.jte emits it in skippable mode (the lv-wizard contract). */
function stepListHtml(steps: StepSpec[], opts: BuildOpts = {}): string {
  const orientation = opts.orientation ?? "horizontal";
  // The current step (index 0 here) is the server-rendered roving seed (tabindex="0").
  const items = steps
    .map((s, i) => {
      const n = i + 1;
      const tabindex = i === 0 ? "0" : "-1";
      const reachable = s.unreachable !== true;
      const item = reachable ? " data-lievit-item" : "";
      const dis = s.disabled === true ? ' aria-disabled="true"' : "";
      const lclick = reachable ? ' l:click="goTo"' : "";
      // textContent = number + sr status (matches the wizard button: <span>n</span><span class=sr-only>..</span>).
      const inner = `<span aria-hidden="true">${n}</span><span class="sr-only">${i === 0 ? "Current" : "Pending"}</span>`;
      const node = reachable
        ? `<button type="button" data-slot="wizard-step-button" aria-label="${s.label}" tabindex="${tabindex}" data-step="${i}"${item}${dis}${lclick}>${inner}</button>`
        : `<span data-slot="wizard-step-node" aria-hidden="true">${inner}</span>`;
      return `<li data-slot="wizard-step" data-index="${i}">${node}</li>`;
    })
    .join("");
  const selectAction = opts.noSelectAction === true ? "" : ' data-lievit-collection-select-action="goTo"';
  return (
    `<ol data-slot="wizard-step-list" role="list" data-controller="lv-wizard"` +
    ` data-action="keydown->lv-wizard#onKeydown"` +
    ` data-lievit-collection-orientation="${orientation}"` +
    ` data-lievit-collection-wrap="true"${selectAction}` +
    ` data-lievit-collection-roving-tabindex="true" data-manual-activation="true">${items}</ol>`
  );
}

interface Mounted {
  componentRoot: HTMLElement;
  list: HTMLElement;
  buttons: HTMLButtonElement[];
}

function mountWizard(steps: StepSpec[], opts: BuildOpts = {}): Mounted {
  const componentRoot = document.createElement("div");
  componentRoot.setAttribute("data-lievit-component", "com.example.W");
  componentRoot.setAttribute("data-lievit-id", `cid-${Math.random().toString(36).slice(2)}`);
  componentRoot.setAttribute("data-lievit-snapshot", "s1");
  componentRoot.innerHTML = `<div data-slot="wizard">${stepListHtml(steps, opts)}</div>`;
  document.body.appendChild(componentRoot);
  const list = componentRoot.querySelector<HTMLElement>('[data-controller="lv-wizard"]')!;
  const buttons = Array.from(list.querySelectorAll<HTMLButtonElement>("[data-lievit-item]"));
  return { componentRoot, list, buttons };
}

/** The index, within `buttons`, of the one holding the roving seed (tabindex=0). */
function rovingIndex(buttons: HTMLElement[]): number {
  return buttons.findIndex((b) => b.tabIndex === 0);
}

const THREE: StepSpec[] = [{ label: "Account" }, { label: "Profile" }, { label: "Confirm" }];

beforeEach(() => {
  document.body.innerHTML = "";
});

afterEach(() => {
  stopStimulus();
  document.body.innerHTML = "";
});

describe("lv-wizard controller — roving navigation (real Stimulus)", () => {
  it("arrow_right_moves_focus_and_tabindex_to_next_step", async () => {
    const { runtime } = makeRuntime();
    const { buttons } = mountWizard(THREE);
    startStimulus({ runtime });
    await flushStimulus();

    buttons[0]!.focus();
    key(buttons[0]!, "ArrowRight");

    expect(document.activeElement).toBe(buttons[1]);
    expect(rovingIndex(buttons)).toBe(1);
    expect(buttons[0]!.tabIndex).toBe(-1);
  });

  it("arrow_left_moves_focus_to_previous_step", async () => {
    const { runtime } = makeRuntime();
    const { buttons } = mountWizard(THREE);
    startStimulus({ runtime });
    await flushStimulus();

    key(buttons[0]!, "ArrowRight"); // -> Profile
    key(buttons[1]!, "ArrowLeft"); // -> Account

    expect(document.activeElement).toBe(buttons[0]);
    expect(rovingIndex(buttons)).toBe(0);
  });

  it("arrow_right_wraps_last_to_first", async () => {
    const { runtime } = makeRuntime();
    const { buttons } = mountWizard(THREE);
    startStimulus({ runtime });
    await flushStimulus();

    key(buttons[0]!, "ArrowRight"); // -> Profile
    key(buttons[1]!, "ArrowRight"); // -> Confirm
    key(buttons[2]!, "ArrowRight"); // wrap -> Account

    expect(document.activeElement).toBe(buttons[0]);
    expect(rovingIndex(buttons)).toBe(0);
  });

  it("arrow_left_wraps_first_to_last", async () => {
    const { runtime } = makeRuntime();
    const { buttons } = mountWizard(THREE);
    startStimulus({ runtime });
    await flushStimulus();

    key(buttons[0]!, "ArrowLeft"); // wrap -> Confirm

    expect(document.activeElement).toBe(buttons[2]);
    expect(rovingIndex(buttons)).toBe(2);
  });

  it("home_focuses_first_and_end_focuses_last", async () => {
    const { runtime } = makeRuntime();
    const { buttons } = mountWizard(THREE);
    startStimulus({ runtime });
    await flushStimulus();

    key(buttons[0]!, "End");
    expect(document.activeElement).toBe(buttons[2]);
    expect(rovingIndex(buttons)).toBe(2);

    key(buttons[2]!, "Home");
    expect(document.activeElement).toBe(buttons[0]);
    expect(rovingIndex(buttons)).toBe(0);
  });

  it("arrow_down_navigates_when_orientation_is_vertical", async () => {
    const { runtime } = makeRuntime();
    const { buttons } = mountWizard(THREE, { orientation: "vertical" });
    startStimulus({ runtime });
    await flushStimulus();

    key(buttons[0]!, "ArrowDown"); // vertical: Down = next
    expect(document.activeElement).toBe(buttons[1]);

    // In vertical orientation ArrowRight is not a navigation key: typeahead consumes it as a
    // printable char only when length===1; ArrowRight is a named key, so it is NOT navigation here.
    key(buttons[1]!, "ArrowRight");
    expect(document.activeElement).toBe(buttons[1]); // unchanged
  });

  it("aria_disabled_item_is_skipped_during_navigation (defence-in-depth)", async () => {
    const { runtime } = makeRuntime();
    const { buttons } = mountWizard([
      { label: "Account" },
      { label: "Profile", disabled: true },
      { label: "Confirm" },
    ]);
    startStimulus({ runtime });
    await flushStimulus();

    key(buttons[0]!, "ArrowRight"); // skip the aria-disabled Profile -> Confirm
    expect(document.activeElement).toBe(buttons[2]);
    expect(rovingIndex(buttons)).toBe(2);
  });

  it("unreachable_steps_without_data_lievit_item_are_not_in_the_roving_order", async () => {
    const { runtime } = makeRuntime();
    // Three rendered steps; the middle one is unreachable (no data-lievit-item, a <span> node).
    const { list } = mountWizard([
      { label: "Account" },
      { label: "Profile", unreachable: true },
      { label: "Confirm" },
    ]);
    startStimulus({ runtime });
    await flushStimulus();

    const reachable = Array.from(list.querySelectorAll<HTMLButtonElement>("[data-lievit-item]"));
    expect(reachable).toHaveLength(2); // only Account + Confirm are in the order

    reachable[0]!.focus();
    key(reachable[0]!, "ArrowRight"); // -> Confirm (the unreachable middle is invisible to the order)
    expect(document.activeElement).toBe(reachable[1]);
  });

  it("typeahead_focuses_the_step_whose_label_starts_with_the_typed_character", async () => {
    const { runtime } = makeRuntime();
    const { buttons } = mountWizard(THREE);
    startStimulus({ runtime });
    await flushStimulus();

    // The step buttons' textContent begins with the 1-based number; typing "3" focuses step 3.
    buttons[0]!.focus();
    key(buttons[0]!, "3");
    expect(document.activeElement).toBe(buttons[2]);
    expect(rovingIndex(buttons)).toBe(2);
  });

  it("tab_is_not_consumed (Tab exits the roving order, APG)", async () => {
    const { runtime } = makeRuntime();
    const { buttons } = mountWizard(THREE);
    startStimulus({ runtime });
    await flushStimulus();

    buttons[0]!.focus();
    const ev = key(buttons[0]!, "Tab");
    expect(ev.defaultPrevented).toBe(false); // not handled => focus may leave the stepper
    expect(document.activeElement).toBe(buttons[0]); // controller moved nothing
  });
});

describe("lv-wizard controller — manual activation + controlled/uncontrolled commit (real wire)", () => {
  it("arrow_key_moves_focus_only_and_fires_NO_wire_call (manual activation)", async () => {
    const { runtime, calledActions } = makeRuntime();
    const { buttons } = mountWizard(THREE);
    startStimulus({ runtime });
    await flushStimulus();

    buttons[0]!.focus();
    key(buttons[0]!, "ArrowRight");
    key(buttons[1]!, "ArrowRight");

    await new Promise((r) => setTimeout(r, 10));
    expect(calledActions).toHaveLength(0); // Arrow navigation never commits
  });

  it("enter_commits_the_focused_step_over_the_wire_exactly_once (controlled: goTo)", async () => {
    const { runtime, calledActions } = makeRuntime();
    const { buttons } = mountWizard(THREE);
    startStimulus({ runtime });
    await flushStimulus();

    key(buttons[0]!, "ArrowRight"); // focus Profile (index 1)
    key(buttons[1]!, "Enter");

    await new Promise((r) => setTimeout(r, 10));
    expect(calledActions.filter((a) => a === "goTo")).toHaveLength(1);
  });

  it("space_commits_the_focused_step_over_the_wire (controlled: goTo)", async () => {
    const { runtime, calledActions } = makeRuntime();
    const { buttons } = mountWizard(THREE);
    startStimulus({ runtime });
    await flushStimulus();

    const ev = key(buttons[0]!, " ");
    expect(ev.defaultPrevented).toBe(true); // Space must not scroll the page

    await new Promise((r) => setTimeout(r, 10));
    expect(calledActions.filter((a) => a === "goTo")).toHaveLength(1);
  });

  it("uncontrolled_step_list_without_select_action_fires_NO_wire_call_on_commit", async () => {
    const { runtime, calledActions } = makeRuntime();
    // No data-lievit-collection-select-action => callWire is a no-op (the controlled/uncontrolled
    // doctrine via the bridge): the keystroke is still consumed (preventDefault) but never round-trips.
    const { buttons } = mountWizard(THREE, { noSelectAction: true });
    startStimulus({ runtime });
    await flushStimulus();

    const ev = key(buttons[0]!, "Enter");
    expect(ev.defaultPrevented).toBe(true);

    await new Promise((r) => setTimeout(r, 10));
    expect(calledActions).toHaveLength(0);
  });
});

describe("lv-wizard controller — morph-safety (real lievit morph)", () => {
  it("after a real morph one ArrowRight moves focus EXACTLY one step (no stacked listeners)", async () => {
    const { runtime } = makeRuntime();
    const { componentRoot } = mountWizard(THREE);
    startStimulus({ runtime });
    await flushStimulus();

    // A real wire morph re-renders the subtree (idiomorph). The markup is identical, so the
    // controller must NOT double-connect; a stacked second listener would jump TWO steps per press.
    morph(componentRoot, componentRoot.outerHTML);
    await flushStimulus();

    const list = componentRoot.querySelector<HTMLElement>('[data-controller="lv-wizard"]')!;
    const buttons = Array.from(list.querySelectorAll<HTMLButtonElement>("[data-lievit-item]"));
    buttons[0]!.focus();
    key(buttons[0]!, "ArrowRight");

    expect(document.activeElement).toBe(buttons[1]); // exactly one step, not two
    expect(rovingIndex(buttons)).toBe(1);
  });

  it("a step-list removed by a morph stops firing (disconnect tears the listener down)", async () => {
    const { runtime, calledActions } = makeRuntime();
    const { componentRoot, buttons } = mountWizard(THREE);
    startStimulus({ runtime });
    await flushStimulus();

    const oldButton = buttons[0]!;
    // Morph the step-list out of the tree entirely.
    morph(
      componentRoot,
      `<div data-lievit-component="com.example.W" data-lievit-snapshot="s2"><span>gone</span></div>`,
    );
    await flushStimulus();

    // The detached button's keydown reaches no live controller -> no commit, no throw.
    key(oldButton, "Enter");
    await new Promise((r) => setTimeout(r, 10));
    expect(calledActions).toHaveLength(0);
  });
});
