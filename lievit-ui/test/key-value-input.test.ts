/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * key-value-input (Filament KeyValue, the EDITABLE form control -- distinct from the read-only
 * key-value display primitive): repeatable key/value rows that POST as an indexed form-array. Two
 * halves: a structural golden over the partial SOURCE (the `<name>[<i>][key|value]` POST contract,
 * the JS-off Add/remove submit fallback, the hidden <template> row, a11y, the CSP-clean Stimulus
 * wiring), and the `lv-key-value-input` CONTROLLER behaviour proven through the REAL Stimulus
 * Application + the REAL lievit wire morph (no mocked $lievit / runtime): add clones + focuses,
 * remove drops, both re-index so indices stay contiguous; the add/remove stay client-side (this
 * control never round-trips the wire); and the behaviour survives a morph with no stacked listeners.
 */
import { beforeEach, afterEach, describe, test, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { indexedName, enhanceKeyValueInput } from "../registry/jte/key-value-input.enhancer.js";
import { LievitRuntime } from "../runtime/runtime.js";
import { morph } from "../runtime/morph.js";
import { startStimulus, stopStimulus, flushStimulus } from "../runtime/stimulus/application.js";

const jteDir = join(import.meta.dirname, "..", "registry", "jte");
const read = (rel: string) => readFileSync(join(jteDir, rel), "utf8");
const markupOf = (rel: string) => read(rel).replace(/<%--[\s\S]*?--%>/g, "");

describe("key-value-input.jte -- editable indexed key/value rows", () => {
  const src = read("key-value-input.jte");
  const markup = markupOf("key-value-input.jte");

  test("is named key-value-INPUT, distinct from the read-only key-value display primitive", () => {
    expect(markup).toContain('data-slot="key-value-input"');
    expect(markup).toContain("data-lievit-key-value-input");
  });

  test("each row is two native inputs named with the canonical form-array convention", () => {
    expect(markup).toContain('name="${name}[${i}][key]"');
    expect(markup).toContain('name="${name}[${i}][value]"');
  });

  test("JS-OFF add is an Add submit and remove is a per-row submit carrying the index", () => {
    expect(markup).toContain('name="${name}__add"');
    expect(markup).toContain('name="${name}__remove"');
    expect(markup).toContain('value="${i}"');
  });

  test("ships a hidden <template> row for the JS-on clone", () => {
    expect(markup).toContain("data-key-value-input-template");
    expect(markup).toContain("__i__");
  });

  test("inputs are aria-labelled with their role + row number (no visual header reliance)", () => {
    expect(markup).toContain('aria-label="${keyLabel}, row ${i + 1}"');
    expect(markup).toContain('aria-label="${valueLabel}, row ${i + 1}"');
    expect(markup).toContain('aria-label="Remove row ${i + 1}"');
  });

  test("an aria-live region is present for add/remove announcements", () => {
    expect(markup).toContain('aria-live="polite"');
    expect(markup).toContain("data-key-value-input-live");
  });

  test("entries come in via a Map param, never hardcoded", () => {
    expect(src).toMatch(/@param java\.util\.Map<String, String> entries/);
  });

  test("wires the lv-key-value-input Stimulus controller via data-action (CSP-clean, no inline JS)", () => {
    expect(markup).toContain('data-controller="lv-key-value-input"');
    expect(markup).toContain('data-action="click->lv-key-value-input#add"');
    expect(markup).toContain('data-action="click->lv-key-value-input#remove"');
    // rows host / template / live region are reached via Stimulus targets, not querySelector.
    expect(markup).toContain('data-lv-key-value-input-target="rows"');
    expect(markup).toContain('data-lv-key-value-input-target="template"');
    expect(markup).toContain('data-lv-key-value-input-target="live"');
  });

  test("no inline script or on* handler in the rendered markup (CSP-clean)", () => {
    // strip the <template> contents too (they are inert, not executed) before the on* scan
    const live = markup.replace(/<template[\s\S]*?<\/template>/g, "");
    expect(live).not.toMatch(/<script/);
    expect(markup).not.toMatch(/\son[a-z]+=/);
  });
});

describe("indexedName -- the form-array name builder", () => {
  test("builds prefix[i][field]", () => {
    expect(indexedName("meta", 0, "key")).toBe("meta[0][key]");
    expect(indexedName("meta", 2, "value")).toBe("meta[2][value]");
  });
});

describe("key-value-input.enhancer -- coexistence guard during the Stimulus fan-out", () => {
  test("the legacy enhancer SKIPS a root owned by the lv-key-value-input controller (no double-wire)", () => {
    // A converted template carries data-controller; if an adopter still installs the legacy enhancer
    // alongside Stimulus, the enhancer must not also bind add/remove (else each fires twice).
    document.body.innerHTML =
      '<div data-lievit-key-value-input data-controller="lv-key-value-input" data-name="meta">' +
      '<div data-key-value-input-rows></div>' +
      '<template data-key-value-input-template>' +
      '<div data-key-value-input-row><input data-key-value-input-key></div></template>' +
      '<button data-key-value-input-add></button></div>';
    const root = document.body.firstElementChild as HTMLElement;

    enhanceKeyValueInput(root);

    // Marked handled (so a re-scan also skips it) but NO enhancer-added row from an Add click.
    expect(root.hasAttribute("data-key-value-input-enhanced")).toBe(true);
    root
      .querySelector<HTMLButtonElement>("[data-key-value-input-add]")!
      .dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    expect(root.querySelectorAll("[data-key-value-input-row]")).toHaveLength(0);
    document.body.innerHTML = "";
  });
});

// --- controller behaviour (real Stimulus Application + real lievit morph) -----------------------

/** A real LievitRuntime backed by a fetch stub that records the wire actions the runtime POSTs. */
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

/** One server-rendered row's HTML (data-slot namespace + data-action remove), matching the .jte. */
function rowHtml(i: number, k: string, v: string): string {
  return (
    `<div data-slot="key-value-input-row" data-key-value-input-row data-index="${i}" class="flex">` +
    `<input data-slot="key-value-input-key" data-key-value-input-key type="text"` +
    ` name="meta[${i}][key]" value="${k}" aria-label="Key, row ${i + 1}">` +
    `<input data-slot="key-value-input-value" data-key-value-input-value type="text"` +
    ` name="meta[${i}][value]" value="${v}" aria-label="Value, row ${i + 1}">` +
    `<button type="submit" data-slot="key-value-input-remove" data-key-value-input-remove` +
    ` data-action="click->lv-key-value-input#remove" name="meta__remove" value="${i}"` +
    ` aria-label="Remove row ${i + 1}"></button>` +
    `</div>`
  );
}

/** The component root markup exactly as key-value-input.jte emits it (controller + targets + actions). */
function rootHtml(entries: [string, string][]): string {
  return (
    `<div data-slot="key-value-input" data-controller="lv-key-value-input"` +
    ` data-lievit-key-value-input data-name="meta">` +
    `<div data-slot="key-value-input-rows" data-key-value-input-rows` +
    ` data-lv-key-value-input-target="rows">` +
    entries.map(([k, v], i) => rowHtml(i, k, v)).join("") +
    `</div>` +
    `<template data-key-value-input-template data-lv-key-value-input-target="template">` +
    `<div data-slot="key-value-input-row" data-key-value-input-row data-index="__i__" class="flex">` +
    `<input data-slot="key-value-input-key" data-key-value-input-key type="text"` +
    ` name="meta[__i__][key]" value="" aria-label="Key, row __label__">` +
    `<input data-slot="key-value-input-value" data-key-value-input-value type="text"` +
    ` name="meta[__i__][value]" value="" aria-label="Value, row __label__">` +
    `<button type="button" data-slot="key-value-input-remove" data-key-value-input-remove` +
    ` data-action="click->lv-key-value-input#remove" aria-label="Remove row __label__"></button>` +
    `</div></template>` +
    `<button type="submit" data-slot="key-value-input-add" data-key-value-input-add` +
    ` data-action="click->lv-key-value-input#add" name="meta__add" value="1">Add row</button>` +
    `<span data-slot="key-value-input-live" data-key-value-input-live` +
    ` data-lv-key-value-input-target="live" aria-live="polite" class="sr-only"></span>` +
    `</div>`
  );
}

/** Mount the component DOM and start the real Stimulus Application; returns the connected root. */
async function mount(
  entries: [string, string][],
  runtime: LievitRuntime,
): Promise<HTMLElement> {
  document.body.innerHTML = rootHtml(entries);
  const root = document.body.firstElementChild as HTMLElement;
  startStimulus({ runtime });
  await flushStimulus();
  return root;
}

const rowsOf = (root: HTMLElement) =>
  Array.from(root.querySelectorAll<HTMLElement>('[data-slot="key-value-input-row"]'));
const keyNamesOf = (root: HTMLElement) =>
  Array.from(root.querySelectorAll<HTMLInputElement>('[data-slot="key-value-input-key"]')).map(
    (i) => i.name,
  );
const keyValuesOf = (root: HTMLElement) =>
  Array.from(root.querySelectorAll<HTMLInputElement>('[data-slot="key-value-input-key"]')).map(
    (i) => i.value,
  );
const addButtonOf = (root: HTMLElement) =>
  root.querySelector<HTMLButtonElement>('[data-slot="key-value-input-add"]')!;
const liveOf = (root: HTMLElement) =>
  root.querySelector<HTMLElement>('[data-slot="key-value-input-live"]')!;
const click = (el: Element): void => {
  el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
};

beforeEach(() => {
  document.body.innerHTML = "";
});

afterEach(() => {
  stopStimulus();
  document.body.innerHTML = "";
});

describe("lv-key-value-input controller — add / remove / reindex (real Stimulus)", () => {
  it("the Add button clones a fresh row with contiguous indexed names", async () => {
    const { runtime } = makeRuntime();
    const root = await mount([["a", "1"]], runtime);

    click(addButtonOf(root));

    expect(rowsOf(root)).toHaveLength(2);
    expect(keyNamesOf(root)).toEqual(["meta[0][key]", "meta[1][key]"]);
  });

  it("the Add click is prevented so the JS-off submit fallback does not also fire", async () => {
    const { runtime } = makeRuntime();
    const root = await mount([], runtime);

    const ev = new MouseEvent("click", { bubbles: true, cancelable: true });
    addButtonOf(root).dispatchEvent(ev);

    expect(ev.defaultPrevented).toBe(true);
    expect(rowsOf(root)).toHaveLength(1);
  });

  it("removing a middle row re-indexes the survivors so indices stay 0..n-1", async () => {
    const { runtime } = makeRuntime();
    const root = await mount(
      [
        ["a", "1"],
        ["b", "2"],
        ["c", "3"],
      ],
      runtime,
    );

    const middleRemove = rowsOf(root)[1].querySelector<HTMLButtonElement>(
      '[data-slot="key-value-input-remove"]',
    )!;
    const ev = new MouseEvent("click", { bubbles: true, cancelable: true });
    middleRemove.dispatchEvent(ev);

    expect(ev.defaultPrevented).toBe(true);
    expect(rowsOf(root)).toHaveLength(2);
    expect(keyNamesOf(root)).toEqual(["meta[0][key]", "meta[1][key]"]);
    // the surviving values are a and c, in order
    expect(keyValuesOf(root)).toEqual(["a", "c"]);
  });

  it("a freshly added row re-indexes its aria-label + name with the new row number", async () => {
    const { runtime } = makeRuntime();
    const root = await mount([["a", "1"]], runtime);

    click(addButtonOf(root));

    const newKey = rowsOf(root)[1].querySelector<HTMLInputElement>(
      '[data-slot="key-value-input-key"]',
    )!;
    expect(newKey.getAttribute("aria-label")).toBe("Key, row 2");
    expect(newKey.name).toBe("meta[1][key]");
  });

  it("add focuses the new row's key input and announces; remove announces", async () => {
    const { runtime } = makeRuntime();
    const root = await mount([["a", "1"]], runtime);

    click(addButtonOf(root));
    const newKey = rowsOf(root)[1].querySelector<HTMLInputElement>(
      '[data-slot="key-value-input-key"]',
    )!;
    expect(document.activeElement).toBe(newKey);
    expect(liveOf(root).textContent).toBe("Row added");

    // The newly cloned row's data-action is bound by Stimulus's observer on the next tick.
    await flushStimulus();
    const remove = rowsOf(root)[1].querySelector<HTMLButtonElement>(
      '[data-slot="key-value-input-remove"]',
    )!;
    click(remove);
    expect(liveOf(root).textContent).toBe("Row removed");
  });

  it("add/remove stay client-side and make ZERO wire calls (uncontrolled by nature)", async () => {
    const { runtime, calledActions } = makeRuntime();
    const root = await mount(
      [
        ["a", "1"],
        ["b", "2"],
      ],
      runtime,
    );

    click(addButtonOf(root));
    const firstRemove = rowsOf(root)[0].querySelector<HTMLButtonElement>(
      '[data-slot="key-value-input-remove"]',
    )!;
    click(firstRemove);

    await new Promise((r) => setTimeout(r, 10));
    expect(calledActions).toHaveLength(0);
  });
});

describe("lv-key-value-input controller — morph-safety (real lievit morph)", () => {
  it("after a real morph one Add click adds EXACTLY one row (no stacked listeners)", async () => {
    const { runtime } = makeRuntime();
    const root = await mount([["a", "1"]], runtime);

    // A real lievit wire morph re-renders the component subtree (idiomorph). The markup is
    // identical, so the controller must NOT be double-connected and the action must stay single.
    morph(root, rootHtml([["a", "1"]]));
    await flushStimulus();

    click(addButtonOf(root));

    expect(rowsOf(root)).toHaveLength(2);
    expect(keyNamesOf(root)).toEqual(["meta[0][key]", "meta[1][key]"]);
  });

  it("a root removed by a morph stops responding (disconnect tears the bindings down)", async () => {
    const { runtime } = makeRuntime();
    const root = await mount([["a", "1"]], runtime);
    const detachedAdd = addButtonOf(root);

    // Morph the whole control out of the tree.
    const host = document.createElement("div");
    host.appendChild(root);
    document.body.appendChild(host);
    morph(host, `<div><span>gone</span></div>`);
    await flushStimulus();

    // The detached Add button no longer reaches a live controller -> clicking does nothing.
    click(detachedAdd);
    expect(root.querySelectorAll('[data-slot="key-value-input-row"]')).toHaveLength(1);
  });
});
