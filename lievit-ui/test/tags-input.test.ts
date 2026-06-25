/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * tags-input (Filament TagsInput): chips + add-input + optional suggestions; tags POST as a
 * repeated `name`. Two halves: a structural golden over the partial SOURCE (the hidden-input-per-tag
 * repeated-POST contract, the JS-off Add/remove submit fallback, a11y, v-next params, the new
 * data-controller / data-action CSP-clean wiring), and the DOM behaviour proven through the REAL
 * Stimulus Application + the REAL lievit wire morph (no mocked $lievit, no mocked runtime): in-place
 * add via Enter / delimiter / Add / suggestion, remove via x, Backspace pop, dedup, paste splitting,
 * chip keyboard nav, clear-all, live region, and the morph-safety the enhancer test could not state.
 */
import { describe, test, expect, afterEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { normalizeTag } from "../runtime/stimulus/controllers/lv-tags-input-controller.js";
import { LievitRuntime } from "../runtime/runtime.js";
import { morph } from "../runtime/morph.js";
import { startStimulus, stopStimulus, flushStimulus } from "../runtime/stimulus/application.js";

const jteDir = join(import.meta.dirname, "..", "registry", "jte");
const read = (rel: string) => readFileSync(join(jteDir, rel), "utf8");
const markupOf = (rel: string) => read(rel).replace(/<%--[\s\S]*?--%>/g, "");

describe("tags-input.jte -- repeated-name tags field", () => {
  const src = read("tags-input.jte");
  const markup = markupOf("tags-input.jte");

  test("each committed tag carries a hidden <input name> so the set POSTs as a repeated name", () => {
    expect(markup).toContain('type="hidden"');
    expect(markup).toContain("data-tags-input-value");
    expect(markup).toMatch(/data-tags-input-value name="\$\{name\}" value="\$\{tag\}"/);
  });

  test("JS-OFF add is an explicit submit button (name=`<name>__add`)", () => {
    expect(markup).toContain('name="${name}__add"');
    expect(markup).toContain("data-tags-input-add");
    expect(markup).toContain('type="submit"');
  });

  test("JS-OFF remove is a per-chip submit (name=`<name>__remove`) with an aria-label naming the tag", () => {
    expect(markup).toContain('name="${name}__remove"');
    expect(markup).toContain('aria-label="Remove ${tag}"');
  });

  test("the add-field is a labelled text input + the wrapper carries the enhancer hook", () => {
    expect(markup).toContain("data-tags-input-field");
    expect(markup).toContain("data-lievit-tags-input");
    expect(markup).toContain('type="text"');
  });

  test("suggestions are optional, come in via a List param, and are real <button>s", () => {
    expect(src).toMatch(/@param java\.util\.List<String> suggestions/);
    expect(markup).toContain("@if(hasSuggestions)");
    expect(markup).toContain("data-tags-input-suggestion");
  });

  test("an aria-live region is present for add/remove announcements", () => {
    expect(markup).toContain('aria-live="polite"');
    expect(markup).toContain("data-tags-input-live");
  });

  test("values come in via a List param, never hardcoded", () => {
    expect(src).toMatch(/@param java\.util\.List<String> values/);
  });

  test("no inline script or on* handler in the markup (CSP-clean)", () => {
    expect(markup).not.toMatch(/<script/);
    expect(markup).not.toMatch(/\son[a-z]+=/);
  });

  // Stimulus conversion: the root mounts the controller, behaviour rides data-action (CSP-clean).
  test("the root carries data-controller=lv-tags-input", () => {
    expect(markup).toContain('data-controller="lv-tags-input"');
  });

  test("the entry field, chips, and well controls declare data-action (no inline handlers)", () => {
    expect(markup).toContain("keydown->lv-tags-input#onFieldKeydown");
    expect(markup).toContain("paste->lv-tags-input#onFieldPaste");
    expect(markup).toContain("keydown->lv-tags-input#onChipKeydown");
    expect(markup).toContain("click->lv-tags-input#onRemoveClick");
    expect(markup).toContain("click->lv-tags-input#onAddClick");
    expect(markup).toContain("click->lv-tags-input#onClearAll");
    expect(markup).toContain("click->lv-tags-input#onSuggestionClick");
  });

  // v-next structural assertions
  test("size param exists in the source", () => {
    expect(src).toContain('@param String size = "md"');
  });

  test("delimiter param exists in the source", () => {
    expect(src).toContain('@param String delimiter = ","');
  });

  test("clearable param exists in the source", () => {
    expect(src).toContain('@param boolean clearable = false');
  });

  test("chip has role=option and aria-selected=true in the template", () => {
    expect(markup).toContain('role="option"');
    expect(markup).toContain('aria-selected="true"');
  });

  test("root has role=group in the template", () => {
    expect(markup).toContain('role="group"');
  });

  test("live region has role=status in the template", () => {
    expect(markup).toContain('role="status"');
  });

  test("the well has data-slot=tags-input-well in the template", () => {
    expect(markup).toContain('data-slot="tags-input-well"');
  });
});

describe("normalizeTag", () => {
  test("trims surrounding whitespace", () => {
    expect(normalizeTag("  urgente  ")).toBe("urgente");
  });
  test("an empty / whitespace tag normalizes to empty", () => {
    expect(normalizeTag("   ")).toBe("");
    expect(normalizeTag("")).toBe("");
  });
});

// --- DOM behaviour: REAL Stimulus + REAL runtime + REAL morph ---------------------------------

/** A fetch stub recording the wire `_calls` a form-native tags-input must NEVER make. */
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

/** Build a chip exactly as the .jte / the controller emit it (hidden input + data-action hooks). */
function appendChip(chips: HTMLElement, tag: string): void {
  const chip = document.createElement("span");
  chip.setAttribute("data-slot", "tags-input-chip");
  chip.setAttribute("data-tags-input-chip", tag);
  chip.setAttribute("data-action", "keydown->lv-tags-input#onChipKeydown");
  chip.setAttribute("role", "option");
  chip.setAttribute("aria-selected", "true");
  chip.setAttribute("tabindex", "-1");
  chip.setAttribute("aria-label", `${tag}, press Delete or Backspace to remove`);
  const hidden = document.createElement("input");
  hidden.type = "hidden";
  hidden.setAttribute("data-tags-input-value", "");
  hidden.name = "etichette";
  hidden.value = tag;
  const labelEl = document.createElement("span");
  labelEl.textContent = tag;
  const remove = document.createElement("button");
  remove.type = "submit";
  remove.setAttribute("data-tags-input-remove", tag);
  remove.setAttribute("data-action", "click->lv-tags-input#onRemoveClick");
  chip.append(hidden, labelEl, remove);
  chips.appendChild(chip);
}

/** Build a DOM matching the server-rendered tags-input partial (data-controller + data-action). */
function render(
  values: string[] = [],
  suggestions: string[] = [],
  opts: { delimiter?: string; size?: string; clearable?: boolean; disabled?: boolean } = {},
): HTMLElement {
  const delimiter = opts.delimiter ?? ",";
  const size = opts.size ?? "md";
  const clearable = opts.clearable ?? false;

  const root = document.createElement("div");
  root.setAttribute("data-controller", "lv-tags-input");
  root.setAttribute("data-lievit-tags-input", "");
  root.setAttribute("data-name", "etichette");
  root.setAttribute("data-delimiter", delimiter);
  root.setAttribute("data-size", size);
  if (opts.disabled) root.setAttribute("data-disabled", "true");

  const well = document.createElement("div");
  well.setAttribute("data-slot", "tags-input-well");

  const chips = document.createElement("div");
  chips.setAttribute("data-tags-input-chips", "");
  for (const tag of values) appendChip(chips, tag);
  well.appendChild(chips);

  const field = document.createElement("input");
  field.type = "text";
  field.name = "etichette";
  field.setAttribute("data-tags-input-field", "");
  field.setAttribute(
    "data-action",
    "keydown->lv-tags-input#onFieldKeydown paste->lv-tags-input#onFieldPaste",
  );
  well.appendChild(field);

  if (clearable && values.length > 0) {
    const clearBtn = document.createElement("button");
    clearBtn.type = "button";
    clearBtn.setAttribute("data-tags-input-clear-all", "");
    clearBtn.setAttribute("data-action", "click->lv-tags-input#onClearAll");
    clearBtn.setAttribute("aria-label", "Clear all tags");
    well.appendChild(clearBtn);
  }

  const add = document.createElement("button");
  add.type = "submit";
  add.setAttribute("data-tags-input-add", "");
  add.setAttribute("data-action", "click->lv-tags-input#onAddClick");
  well.appendChild(add);
  root.appendChild(well);

  if (suggestions.length) {
    const sugRow = document.createElement("div");
    for (const s of suggestions) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.setAttribute("data-tags-input-suggestion", s);
      btn.setAttribute("data-action", "click->lv-tags-input#onSuggestionClick");
      sugRow.appendChild(btn);
    }
    root.appendChild(sugRow);
  }

  const live = document.createElement("span");
  live.setAttribute("role", "status");
  live.setAttribute("aria-live", "polite");
  live.setAttribute("data-tags-input-live", "");
  root.appendChild(live);

  document.body.appendChild(root);
  return root;
}

/** Render + start the real Stimulus application + await its MutationObserver (controllers bound). */
async function mount(
  values: string[] = [],
  suggestions: string[] = [],
  opts: { delimiter?: string; size?: string; clearable?: boolean; disabled?: boolean } = {},
): Promise<{ root: HTMLElement; calledActions: string[] }> {
  const { runtime, calledActions } = makeRuntime();
  const root = render(values, suggestions, opts);
  startStimulus({ runtime });
  await flushStimulus();
  return { root, calledActions };
}

const fieldEl = (root: HTMLElement) =>
  root.querySelector<HTMLInputElement>("[data-tags-input-field]")!;
const tagValues = (root: HTMLElement) =>
  Array.from(root.querySelectorAll<HTMLInputElement>("[data-tags-input-value]")).map((i) => i.value);
const liveText = (root: HTMLElement) =>
  root.querySelector("[data-tags-input-live]")?.textContent ?? "";

function pressKey(el: HTMLElement, key: string): void {
  el.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
}

afterEach(() => {
  stopStimulus();
  document.body.innerHTML = "";
});

describe("tags-input controller -- DOM behaviour (real Stimulus + real runtime)", () => {
  test("Enter adds a chip with a hidden input under the repeated name + clears the field", async () => {
    const { root } = await mount();
    fieldEl(root).value = "urgente";
    pressKey(fieldEl(root), "Enter");
    expect(tagValues(root)).toEqual(["urgente"]);
    expect(root.querySelector<HTMLInputElement>("[data-tags-input-value]")!.name).toBe("etichette");
    expect(fieldEl(root).value).toBe("");
  });

  test("comma also commits a tag", async () => {
    const { root } = await mount();
    fieldEl(root).value = "richiamare";
    pressKey(fieldEl(root), ",");
    expect(tagValues(root)).toEqual(["richiamare"]);
  });

  test("a duplicate tag is rejected and announced", async () => {
    const { root } = await mount(["urgente"]);
    fieldEl(root).value = "urgente";
    pressKey(fieldEl(root), "Enter");
    expect(tagValues(root)).toEqual(["urgente"]);
    expect(liveText(root)).toContain("already");
  });

  test("an empty / whitespace tag is not added", async () => {
    const { root } = await mount();
    fieldEl(root).value = "   ";
    pressKey(fieldEl(root), "Enter");
    expect(tagValues(root)).toEqual([]);
  });

  test("clicking the chip x removes the tag (and cancels its native submit)", async () => {
    const { root } = await mount(["a", "b"]);
    const removeB = root.querySelector<HTMLButtonElement>('[data-tags-input-remove="b"]')!;
    const ev = new MouseEvent("click", { bubbles: true, cancelable: true });
    removeB.dispatchEvent(ev);
    expect(tagValues(root)).toEqual(["a"]);
    expect(ev.defaultPrevented).toBe(true);
  });

  test("the JS-off Add button is hidden and, if clicked, adds in place instead of submitting", async () => {
    const { root } = await mount();
    const add = root.querySelector<HTMLButtonElement>("[data-tags-input-add]")!;
    expect(add.hidden).toBe(true);
    fieldEl(root).value = "trattativa";
    const ev = new MouseEvent("click", { bubbles: true, cancelable: true });
    add.dispatchEvent(ev);
    expect(tagValues(root)).toEqual(["trattativa"]);
    expect(ev.defaultPrevented).toBe(true);
  });

  test("Backspace on an empty field pops the last chip", async () => {
    const { root } = await mount(["x", "y"]);
    fieldEl(root).value = "";
    pressKey(fieldEl(root), "Backspace");
    expect(tagValues(root)).toEqual(["x"]);
  });

  test("a suggestion click adds that tag", async () => {
    const { root } = await mount([], ["hot", "warm"]);
    root.querySelector<HTMLButtonElement>('[data-tags-input-suggestion="warm"]')!.click();
    expect(tagValues(root)).toEqual(["warm"]);
  });

  test("ArrowLeft from entry input at position 0 moves focus to last chip", async () => {
    const { root } = await mount(["a", "b", "c"]);
    const f = fieldEl(root);
    f.focus();
    f.setSelectionRange(0, 0);
    const lastChip = root.querySelectorAll<HTMLElement>("[data-tags-input-chip]")[2]!;
    pressKey(f, "ArrowLeft");
    expect(document.activeElement).toBe(lastChip);
  });

  test("ArrowRight from last chip moves focus to entry input", async () => {
    const { root } = await mount(["a", "b"]);
    const allChips = root.querySelectorAll<HTMLElement>("[data-tags-input-chip]");
    const lastChip = allChips[allChips.length - 1]!;
    lastChip.focus();
    pressKey(lastChip, "ArrowRight");
    expect(document.activeElement).toBe(fieldEl(root));
  });

  test("Home from chip moves focus to first chip", async () => {
    const { root } = await mount(["a", "b", "c"]);
    const allChips = root.querySelectorAll<HTMLElement>("[data-tags-input-chip]");
    allChips[2].focus();
    pressKey(allChips[2], "Home");
    expect(document.activeElement).toBe(allChips[0]);
  });

  test("End from chip moves focus to entry input", async () => {
    const { root } = await mount(["a", "b"]);
    const allChips = root.querySelectorAll<HTMLElement>("[data-tags-input-chip]");
    allChips[0].focus();
    pressKey(allChips[0], "End");
    expect(document.activeElement).toBe(fieldEl(root));
  });

  test("Delete on a focused chip removes it and moves focus to the next chip", async () => {
    const { root } = await mount(["a", "b", "c"]);
    const allChips = root.querySelectorAll<HTMLElement>("[data-tags-input-chip]");
    allChips[0].focus();
    pressKey(allChips[0], "Delete");
    expect(tagValues(root)).toEqual(["b", "c"]);
    // focus moved to what is now the first chip (the old "b")
    expect(document.activeElement).toBe(root.querySelector('[data-tags-input-chip="b"]'));
  });

  test("paste with delimiter splits into multiple tags", async () => {
    const { root } = await mount();
    const f = fieldEl(root);
    const pasteEvent = new ClipboardEvent("paste", {
      bubbles: true,
      cancelable: true,
      clipboardData: new DataTransfer(),
    });
    pasteEvent.clipboardData!.setData("text", "london,paris,rome");
    f.dispatchEvent(pasteEvent);
    expect(tagValues(root)).toEqual(["london", "paris", "rome"]);
  });

  test("clear-all button removes all chips", async () => {
    const { root } = await mount(["x", "y", "z"], [], { clearable: true });
    const clearBtn = root.querySelector<HTMLButtonElement>("[data-tags-input-clear-all]")!;
    clearBtn.click();
    expect(tagValues(root)).toEqual([]);
  });

  test("live region announces Tag added and Tag removed", async () => {
    const { root } = await mount(["existing"]);

    fieldEl(root).value = "newtag";
    pressKey(fieldEl(root), "Enter");
    expect(liveText(root)).toBe("Tag added: newtag");

    const removeBtn = root.querySelector<HTMLButtonElement>('[data-tags-input-remove="existing"]')!;
    removeBtn.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    expect(liveText(root)).toBe("Tag removed: existing");
  });

  test("chip built by the controller has role=option and aria-selected=true", async () => {
    const { root } = await mount();
    fieldEl(root).value = "testtag";
    pressKey(fieldEl(root), "Enter");
    const chip = root.querySelector<HTMLElement>("[data-tags-input-chip]")!;
    expect(chip.getAttribute("role")).toBe("option");
    expect(chip.getAttribute("aria-selected")).toBe("true");
  });

  test("Escape clears the entry input value", async () => {
    const { root } = await mount();
    fieldEl(root).value = "in-progress";
    pressKey(fieldEl(root), "Escape");
    expect(fieldEl(root).value).toBe("");
  });

  test("delimiter key (from data-delimiter) also commits a tag", async () => {
    const { root } = await mount([], [], { delimiter: ";" });
    fieldEl(root).value = "semicolontag";
    pressKey(fieldEl(root), ";");
    expect(tagValues(root)).toEqual(["semicolontag"]);
  });

  // Controlled/uncontrolled doctrine: a form-native field is purely client-side -> ZERO wire calls.
  test("no add/remove edit ever round-trips the wire (form-native = uncontrolled by construction)", async () => {
    const { root, calledActions } = await mount(["seed"], ["sugg"]);
    fieldEl(root).value = "added";
    pressKey(fieldEl(root), "Enter");
    root.querySelector<HTMLButtonElement>('[data-tags-input-suggestion="sugg"]')!.click();
    root
      .querySelector<HTMLButtonElement>('[data-tags-input-remove="seed"]')!
      .dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    await new Promise((r) => setTimeout(r, 10));
    expect(calledActions).toHaveLength(0);
  });
});

describe("tags-input controller -- morph-safety (real lievit morph)", () => {
  test("a chip the controller appended is keyboard-navigable after Stimulus binds it", async () => {
    const { root } = await mount();
    fieldEl(root).value = "fresh";
    pressKey(fieldEl(root), "Enter");
    await flushStimulus(); // let the action observer bind the new chip's data-action
    const chip = root.querySelector<HTMLElement>("[data-tags-input-chip]")!;
    chip.focus();
    pressKey(chip, "Delete");
    expect(tagValues(root)).toEqual([]);
  });

  test("after a real morph one Enter adds EXACTLY one chip (no stacked listeners)", async () => {
    const { root } = await mount(["a"]);
    // A real lievit wire morph replays the subtree (idiomorph); the root + its data-action survive.
    morph(root, root.outerHTML);
    await flushStimulus();

    fieldEl(root).value = "b";
    pressKey(fieldEl(root), "Enter");
    expect(tagValues(root)).toEqual(["a", "b"]); // one Enter => one chip, not two
  });

  test("a tags-input removed by a morph stops handling input (disconnect tore the listeners down)", async () => {
    const { runtime } = makeRuntime();
    const host = document.createElement("div");
    host.setAttribute("data-lievit-component", "com.example.Tags");
    host.setAttribute("data-lievit-snapshot", "s1");
    const root = render();
    host.appendChild(root);
    document.body.appendChild(host);
    startStimulus({ runtime });
    await flushStimulus();

    const detachedField = fieldEl(root);
    morph(
      host,
      `<div data-lievit-component="com.example.Tags" data-lievit-snapshot="s2"><span>gone</span></div>`,
    );
    await flushStimulus();

    // The detached field no longer reaches a live controller: Enter is inert (no throw, no chip).
    detachedField.value = "ghost";
    pressKey(detachedField, "Enter");
    expect(root.querySelectorAll("[data-tags-input-value]")).toHaveLength(0);
  });
});
