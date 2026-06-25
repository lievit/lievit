/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * lv-checkbox Stimulus controller -- the conversion of `runtime/features/checkbox.enhancer.ts`
 * (the indeterminate DOM-property mirror). Proven through the REAL Stimulus Application started by
 * startStimulus() + the REAL lievit wire morph (no mocked runtime): the controller mounts on a
 * tri-state `<input>` exactly as checkbox.jte emits it (data-controller="lv-checkbox", stamped only
 * when indeterminate=true), and the morph re-application that the enhancer needed an `afterCall`
 * sweep for is now FREE -- Stimulus reconnects the controller when the morph replaces the input.
 *
 * Mirrors the enhancer's lifecycle assertions (set on init; not set when absent; re-applied after a
 * morph; not set when the morph drops the flag) and adds the morph-safety proof: a morph back to a
 * two-state checkbox CLEARS the property (a strict improvement -- the enhancer only ever set true).
 *
 * Substrate: happy-dom + the real @hotwired/stimulus Application; flushStimulus() awaits the
 * MutationObserver (Stimulus connects controllers + processes attribute mutations asynchronously).
 */
import { afterEach, beforeEach, describe, it, expect } from "vitest";

import { morph } from "../runtime/morph.js";
import { startStimulus, stopStimulus, flushStimulus } from "../runtime/stimulus/application.js";

/** Build a component root + a checkbox span exactly as checkbox.jte emits it (tri-state => controller). */
function mountCheckbox(opts: { indeterminate: boolean; checked?: boolean } = { indeterminate: true }): {
  root: HTMLElement;
  input: HTMLInputElement;
} {
  const root = document.createElement("div");
  root.setAttribute("data-lievit-component", "com.example.C");
  root.setAttribute("data-lievit-id", "cid");
  root.setAttribute("data-lievit-snapshot", "s1");
  root.innerHTML = checkboxHtml(opts.indeterminate, opts.checked ?? false);
  document.body.appendChild(root);
  const input = root.querySelector("input") as HTMLInputElement;
  return { root, input };
}

/** The inner span+input markup checkbox.jte renders; data-controller is present only when tri-state. */
function checkboxHtml(indeterminate: boolean, checked: boolean): string {
  return `<span data-slot="checkbox" data-state="${indeterminate ? "indeterminate" : checked ? "checked" : "unchecked"}">
    <input data-slot="checkbox-input" type="checkbox" name="f" value="on"
           ${checked ? "checked" : ""}
           ${indeterminate ? 'data-indeterminate="true" data-controller="lv-checkbox"' : ""}
           aria-label="Test checkbox" class="peer sr-only">
  </span>`;
}

beforeEach(() => {
  document.body.innerHTML = "";
});

afterEach(() => {
  stopStimulus();
  document.body.innerHTML = "";
});

describe("lv-checkbox controller — indeterminate DOM property (real Stimulus)", () => {
  it("sets_indeterminate_on_connect_when_the_input_is_tri_state", async () => {
    const { input } = mountCheckbox({ indeterminate: true });
    startStimulus();
    await flushStimulus();
    expect(input.indeterminate).toBe(true);
  });

  it("leaves_indeterminate_false_for_a_two_state_checkbox_no_controller", async () => {
    const { input } = mountCheckbox({ indeterminate: false });
    startStimulus();
    await flushStimulus();
    expect(input.indeterminate).toBe(false);
    expect(input.hasAttribute("data-controller")).toBe(false);
  });

  it("indeterminate_holds_across_a_morph_that_re_renders_the_same_tri_state_input", async () => {
    const { root, input } = mountCheckbox({ indeterminate: true });
    startStimulus();
    await flushStimulus();
    expect(input.indeterminate).toBe(true);

    // A real wire morph re-renders the subtree with identical markup. Whether idiomorph preserves
    // or replaces the input, the property must remain true (controller stayed / reconnected).
    morph(root, `<div data-lievit-component="com.example.C" data-lievit-snapshot="s2">${checkboxHtml(true, false)}</div>`);
    await flushStimulus();

    const live = root.querySelector("input") as HTMLInputElement;
    expect(live.indeterminate).toBe(true);
  });

  it("morph_back_to_a_two_state_checkbox_clears_indeterminate (the enhancer never could)", async () => {
    const { root, input } = mountCheckbox({ indeterminate: true });
    startStimulus();
    await flushStimulus();
    expect(input.indeterminate).toBe(true);

    // Server now says two-state: the morph drops data-indeterminate + data-controller. Stimulus
    // disconnects the controller, whose disconnect() clears the write-only property.
    morph(root, `<div data-lievit-component="com.example.C" data-lievit-snapshot="s2">${checkboxHtml(false, true)}</div>`);
    await flushStimulus();

    const live = root.querySelector("input") as HTMLInputElement;
    expect(live.indeterminate).toBe(false);
  });

  it("a_checkbox_removed_by_a_morph_does_not_throw (disconnect tears the controller down)", async () => {
    const { root } = mountCheckbox({ indeterminate: true });
    startStimulus();
    await flushStimulus();

    morph(root, `<div data-lievit-component="com.example.C" data-lievit-snapshot="s2"><span>gone</span></div>`);
    await flushStimulus();

    expect(root.querySelector("input")).toBeNull();
  });
});
