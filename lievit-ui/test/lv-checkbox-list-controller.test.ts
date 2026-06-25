/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * lv-checkbox-list Stimulus controller -- the conversion of `registry/jte/checkbox-list.enhancer.ts`
 * (reveal hidden tools + client-side filter + select-all/clear bulk toggle). Proven through the REAL
 * Stimulus Application started by startStimulus() driving the REAL data-action descriptors the
 * partial renders (no mocked runtime, no hand-call of the controller methods): the DOM is built
 * exactly as checkbox-list.jte emits it (data-controller, data-action, the tools target) and every
 * interaction is a real DOM event.
 *
 * Mirrors checkbox-list.test.ts's enhancer DOM-behaviour assertion-for-assertion (reveal, filter,
 * bulk check/clear, filter-aware toggle, aria-pressed from hand ticks, label swap, disabled-excluded)
 * and adds the morph-safety proof the enhancer test could not state: after a real morph one toggle
 * click still flips the whole list exactly once (no stacked click handlers cancelling out).
 *
 * Substrate: happy-dom + the real @hotwired/stimulus Application; flushStimulus() awaits the
 * MutationObserver (Stimulus binds data-action + fires targetConnected on the initial scan + morph).
 */
import { afterEach, beforeEach, describe, it, expect } from "vitest";

import { morph } from "../runtime/morph.js";
import { startStimulus, stopStimulus, flushStimulus } from "../runtime/stimulus/application.js";
import { matchesQuery } from "../runtime/stimulus/controllers/lv-checkbox-list-controller.js";

/** Build the checkbox-list DOM exactly as checkbox-list.jte emits it (Stimulus attributes included). */
function listHtml(opts: {
  values?: string[];
  selectAllLabel?: string;
  clearLabel?: string;
  entries?: [string, string][];
}): string {
  const values = opts.values ?? [];
  const selectAll = opts.selectAllLabel ?? "Select all";
  const clear = opts.clearLabel ?? selectAll;
  const entries = opts.entries ?? [
    ["villa", "Villa"],
    ["appartamento", "Appartamento"],
    ["box", "Box auto"],
  ];
  const options = entries
    .map(
      ([value, label]) => `
      <div data-slot="checkbox-list-option" data-checkbox-list-option data-value="${value}" data-label="${label}">
        <input data-slot="checkbox-input" type="checkbox" name="t" value="${value}" ${
          values.includes(value) ? "checked" : ""
        }>
        <label for="t-${value}">${label}</label>
      </div>`,
    )
    .join("");
  return `
    <fieldset data-slot="checkbox-list" data-lievit-checkbox-list
              data-controller="lv-checkbox-list" data-action="change->lv-checkbox-list#onChange">
      <div data-slot="checkbox-list-tools" data-checkbox-list-tools data-lv-checkbox-list-target="tools" hidden>
        <div>
          <input type="text" role="searchbox" data-slot="checkbox-list-search" data-checkbox-list-search
                 data-action="input->lv-checkbox-list#filter" placeholder="Search...">
        </div>
        <button type="button" data-slot="checkbox-list-toggle-all" data-checkbox-list-toggle-all
                data-action="click->lv-checkbox-list#toggleAll"
                data-select-all-label="${selectAll}" data-clear-label="${clear}" aria-pressed="false">${selectAll}</button>
      </div>
      <div data-slot="checkbox-list-options" data-checkbox-list-options>${options}</div>
    </fieldset>`;
}

async function mount(opts: Parameters<typeof listHtml>[0] = {}): Promise<HTMLElement> {
  document.body.innerHTML = listHtml(opts);
  startStimulus();
  await flushStimulus();
  return document.body.querySelector("fieldset") as HTMLElement;
}

const boxes = (root: HTMLElement): HTMLInputElement[] =>
  Array.from(root.querySelectorAll<HTMLInputElement>("[data-slot='checkbox-input']"));
const tools = (root: HTMLElement): HTMLElement =>
  root.querySelector<HTMLElement>("[data-checkbox-list-tools]")!;
const search = (root: HTMLElement): HTMLInputElement =>
  root.querySelector<HTMLInputElement>("[data-checkbox-list-search]")!;
const toggle = (root: HTMLElement): HTMLButtonElement =>
  root.querySelector<HTMLButtonElement>("[data-checkbox-list-toggle-all]")!;
const options = (root: HTMLElement): HTMLElement[] =>
  Array.from(root.querySelectorAll<HTMLElement>("[data-checkbox-list-option]"));

beforeEach(() => {
  document.body.innerHTML = "";
});

afterEach(() => {
  stopStimulus();
  document.body.innerHTML = "";
});

describe("matchesQuery — the pure filter predicate (exported from the controller)", () => {
  it("an empty query matches everything", () => {
    expect(matchesQuery("Villa", "")).toBe(true);
    expect(matchesQuery("Villa", "   ")).toBe(true);
  });
  it("matches a substring anywhere, case-insensitively", () => {
    expect(matchesQuery("Appartamento", "parta")).toBe(true);
    expect(matchesQuery("Appartamento", "PARTA")).toBe(true);
  });
  it("matches accent-insensitively", () => {
    expect(matchesQuery("Città", "citta")).toBe(true);
  });
  it("returns false when the label does not contain the query", () => {
    expect(matchesQuery("Villa", "garage")).toBe(false);
  });
  it("trims whitespace from the query before matching", () => {
    expect(matchesQuery("Villa", "  villa  ")).toBe(true);
  });
});

describe("lv-checkbox-list controller — DOM behaviour (real Stimulus + real data-action)", () => {
  it("reveals_the_hidden_tools_row_on_connect", async () => {
    const root = await mount({});
    expect(tools(root).hidden).toBe(false);
  });

  it("typing_in_the_search_hides_non_matching_options_keeps_boxes_in_the_dom", async () => {
    const root = await mount({});
    search(root).value = "villa";
    search(root).dispatchEvent(new Event("input", { bubbles: true }));
    const shown = options(root).filter((o) => o.style.display !== "none");
    expect(shown).toHaveLength(1);
    expect(shown[0].getAttribute("data-label")).toBe("Villa");
    expect(boxes(root)).toHaveLength(3); // filtered boxes stay form-bound, just hidden
  });

  it("the_bulk_toggle_checks_every_visible_box_and_fires_native_change", async () => {
    const root = await mount({});
    let changes = 0;
    root.addEventListener("change", () => changes++);
    toggle(root).click();
    expect(boxes(root).every((b) => b.checked)).toBe(true);
    expect(toggle(root).getAttribute("aria-pressed")).toBe("true");
    expect(changes).toBeGreaterThan(0);
  });

  it("the_bulk_toggle_clears_all_when_everything_is_already_checked", async () => {
    const root = await mount({ values: ["villa", "appartamento", "box"] });
    expect(toggle(root).getAttribute("aria-pressed")).toBe("true");
    toggle(root).click();
    expect(boxes(root).every((b) => !b.checked)).toBe(true);
    expect(toggle(root).getAttribute("aria-pressed")).toBe("false");
  });

  it("the_bulk_toggle_acts_only_on_visible_boxes_respects_an_active_filter", async () => {
    const root = await mount({});
    search(root).value = "villa";
    search(root).dispatchEvent(new Event("input", { bubbles: true }));
    toggle(root).click();
    const checked = boxes(root)
      .filter((b) => b.checked)
      .map((b) => b.value);
    expect(checked).toEqual(["villa"]);
  });

  it("aria_pressed_tracks_hand_ticks", async () => {
    const root = await mount({ values: ["villa", "appartamento"] });
    expect(toggle(root).getAttribute("aria-pressed")).toBe("false");
    const last = boxes(root)[2];
    last.checked = true;
    last.dispatchEvent(new Event("change", { bubbles: true }));
    expect(toggle(root).getAttribute("aria-pressed")).toBe("true");
  });

  it("toggle_label_swaps_to_clearLabel_when_all_checked_and_back", async () => {
    const root = await mount({ selectAllLabel: "Select all", clearLabel: "Clear all" });
    expect(toggle(root).textContent).toBe("Select all");
    toggle(root).click();
    expect(toggle(root).textContent).toBe("Clear all");
    toggle(root).click();
    expect(toggle(root).textContent).toBe("Select all");
  });

  it("disabled_boxes_are_excluded_from_the_visible_set_and_not_toggled", async () => {
    const root = await mount({
      entries: [
        ["a", "Alpha"],
        ["b", "Bravo"],
      ],
    });
    boxes(root)[1].disabled = true;
    toggle(root).click();
    expect(boxes(root)[0].checked).toBe(true);
    expect(boxes(root)[1].checked).toBe(false);
  });
});

/** Mount the fieldset inside a component-root wrapper so a morph can truly drop/replace it. */
async function mountWrapped(): Promise<HTMLElement> {
  document.body.innerHTML = `<div data-lievit-component="com.example.C" data-lievit-snapshot="s1">${listHtml({})}</div>`;
  startStimulus();
  await flushStimulus();
  return document.body.firstElementChild as HTMLElement;
}

describe("lv-checkbox-list controller — morph-safety (real lievit morph)", () => {
  it("after_a_real_morph_one_toggle_click_still_flips_the_whole_list_exactly_once", async () => {
    const wrapper = await mountWrapped();

    // A real wire morph re-renders the component subtree. With the enhancer's hand-bound listeners
    // this is exactly where a second click handler would stack (two toggles cancel to a net no-op).
    // Stimulus owns the data-action lifecycle, so the click handler stays single across the morph.
    morph(wrapper, `<div data-lievit-component="com.example.C" data-lievit-snapshot="s2">${listHtml({})}</div>`);
    await flushStimulus();

    const live = wrapper.querySelector("fieldset") as HTMLElement;
    toggle(live).click();
    expect(boxes(live).every((b) => b.checked)).toBe(true);
    expect(toggle(live).getAttribute("aria-pressed")).toBe("true"); // one flip, not cancelled by a stacked listener
  });

  it("a_fieldset_removed_by_a_morph_stops_responding (disconnect tears the actions down)", async () => {
    const wrapper = await mountWrapped();
    const detachedToggle = toggle(wrapper.querySelector("fieldset") as HTMLElement);

    morph(wrapper, `<div data-lievit-component="com.example.C" data-lievit-snapshot="s2"><span>gone</span></div>`);
    await flushStimulus();

    // The fieldset (and its controller) is gone; the detached toggle reaches no live controller.
    expect(wrapper.querySelector("fieldset")).toBeNull();
    detachedToggle.click();
    expect(detachedToggle.getAttribute("aria-pressed")).toBe("false");
  });
});
