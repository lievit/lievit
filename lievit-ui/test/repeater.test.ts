/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * repeater (Filament Repeater): repeatable nested-schema item cards (recursive content slot) that
 * POST as an indexed form-array. Two halves: a structural golden over the partial SOURCE (the
 * recursive itemContent slot, the `<name>[<i>][...]` POST contract, the JS-off Add/remove submit
 * fallback, the hidden <template> card, the reorder-as-follow-up grip, a11y, the CSP-clean
 * data-controller/data-action wiring), and the REAL `lv-repeater` Stimulus controller driving a
 * REAL DOM through the REAL lievit wire morph (no mocked $lievit, no mocked runtime): add clones,
 * remove drops, both re-index the nested field names contiguous, the editing stays client-side
 * (ZERO wire round-trip = the uncontrolled doctrine), and the morph leaves no stacked listeners.
 */
import { describe, test, expect, afterEach, beforeEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { LievitRuntime } from "../runtime/runtime.js";
import { morph } from "../runtime/morph.js";
import { startStimulus, stopStimulus, flushStimulus } from "../runtime/stimulus/application.js";
import { reindexFieldName } from "../runtime/stimulus/controllers/lv-repeater-controller.js";

const jteDir = join(import.meta.dirname, "..", "registry", "jte");
const read = (rel: string) => readFileSync(join(jteDir, rel), "utf8");
const markupOf = (rel: string) => read(rel).replace(/<%--[\s\S]*?--%>/g, "");

describe("repeater.jte -- repeatable nested-schema item cards (source contract)", () => {
  const src = read("repeater.jte");
  const markup = markupOf("repeater.jte");

  test("the item body is a RECURSIVE content slot (itemContent), not hardcoded fields", () => {
    expect(src).toMatch(/@param gg\.jte\.Content itemContent/);
    expect(markup).toContain("${itemContent}");
    expect(markup).toContain('data-slot="repeater-item-body"');
  });

  test("renders `count` existing cards each a labelled region (Item N)", () => {
    expect(markup).toContain("@for(int i = 0; i < count; i++)");
    expect(markup).toContain('aria-label="${itemLabel} ${i + 1}"');
    expect(markup).toContain('role="group"');
  });

  test("JS-OFF add is an Add submit and remove is a per-item submit carrying the index", () => {
    expect(markup).toContain('name="${name}__add"');
    expect(markup).toContain('name="${name}__remove"');
    expect(markup).toContain('value="${i}"');
  });

  test("ships a hidden <template> card using the __i__ token for the JS-on clone", () => {
    expect(markup).toContain("data-repeater-template");
    expect(markup).toContain("<template");
    expect(markup).toContain("__i__");
  });

  test("reorder is a deliberate follow-up: the grip handle renders, behind the reorderable flag", () => {
    expect(src).toMatch(/@param boolean reorderable = false/);
    expect(markup).toContain("data-repeater-reorder");
    expect(markup).toContain('name = "grip-vertical"');
  });

  test("an aria-live region is present for add/remove announcements", () => {
    expect(markup).toContain('aria-live="polite"');
    expect(markup).toContain("data-repeater-live");
  });

  test("the template wires the lv-repeater controller via data-controller + data-action (CSP-clean)", () => {
    // The add/remove behaviour moved from repeater.enhancer.ts to the lv-repeater Stimulus
    // controller. The wiring is CSP-clean data-controller / data-action (NOT on* handlers):
    // the root carries the controller, the add button + each remove button carry their actions.
    expect(markup).toContain('data-controller="lv-repeater"');
    expect(markup).toContain('data-action="click->lv-repeater#add"');
    expect(markup).toContain('data-action="click->lv-repeater#remove"');
    // The items host + the <template> + the live region are Stimulus targets the controller reaches.
    expect(markup).toContain('data-lv-repeater-target="items"');
    expect(markup).toContain('data-lv-repeater-target="template"');
    expect(markup).toContain('data-lv-repeater-target="live"');
  });

  test("no inline script or on* handler in the rendered markup (CSP-clean)", () => {
    const live = markup.replace(/<template[\s\S]*?<\/template>/g, "");
    expect(live).not.toMatch(/<script/);
    expect(markup).not.toMatch(/\son[a-z]+=/);
  });
});

describe("reindexFieldName -- the array-name rewrite (pure, from the controller)", () => {
  test("rewrites the first index segment, keeping prefix + rest", () => {
    expect(reindexFieldName("telefoni[3][numero]", "telefoni", 1)).toBe("telefoni[1][numero]");
    expect(reindexFieldName("telefoni[__i__][numero]", "telefoni", 0)).toBe("telefoni[0][numero]");
  });
  test("leaves a non-matching name unchanged", () => {
    expect(reindexFieldName("other[0][x]", "telefoni", 2)).toBe("other[0][x]");
  });
  test("a prefix with regex-special chars is escaped", () => {
    expect(reindexFieldName("a.b[5][k]", "a.b", 0)).toBe("a.b[0][k]");
  });
});

/**
 * A real {@link LievitRuntime} backed by a fetch stub that records the `_calls` it would POST, so a
 * test can prove the repeater editing stays CLIENT-SIDE (zero wire round-trip = the uncontrolled
 * doctrine). Mirrors the popover exemplar.
 */
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

/** The card markup the partial emits for one nested input, parameterised by index/label/value. */
function cardHtml(index: string, label: string, value: string): string {
  return (
    `<div data-slot="repeater-item" data-repeater-item data-index="${index}" role="group" aria-label="Item ${label}">` +
    `<div data-slot="repeater-item-header">` +
    `<span></span>` +
    `<button type="${index === "__i__" ? "button" : "submit"}" data-slot="repeater-remove" data-repeater-remove ` +
    `data-action="click->lv-repeater#remove" aria-label="Remove Item ${label}">` +
    `<svg aria-hidden="true"></svg></button>` +
    `</div>` +
    `<div data-slot="repeater-item-body">` +
    `<input name="telefoni[${index}][numero]" value="${value}" aria-label="Numero">` +
    `</div></div>`
  );
}

/**
 * Build a DOM matching the server-rendered repeater partial (each card holds one nested input),
 * wired exactly as repeater.jte emits it: data-controller on the fieldset, data-action on the add
 * + remove buttons, the items host / template / live targets. The real `lv-repeater` controller
 * connects on it once Stimulus starts.
 */
function render(values: string[] = []): HTMLElement {
  const root = document.createElement("fieldset");
  root.setAttribute("data-slot", "repeater");
  root.setAttribute("data-controller", "lv-repeater");
  root.setAttribute("data-lievit-repeater", "");
  root.setAttribute("data-name", "telefoni");

  const itemsHost = document.createElement("div");
  itemsHost.setAttribute("data-slot", "repeater-items");
  itemsHost.setAttribute("data-repeater-items", "");
  itemsHost.setAttribute("data-lv-repeater-target", "items");
  itemsHost.innerHTML = values.map((v, i) => cardHtml(String(i), String(i + 1), v)).join("");
  root.appendChild(itemsHost);

  const template = document.createElement("template");
  template.setAttribute("data-repeater-template", "");
  template.setAttribute("data-lv-repeater-target", "template");
  template.innerHTML = cardHtml("__i__", "__label__", "");
  root.appendChild(template);

  const add = document.createElement("button");
  add.type = "submit";
  add.setAttribute("data-slot", "repeater-add");
  add.setAttribute("data-repeater-add", "");
  add.setAttribute("data-action", "click->lv-repeater#add");
  add.setAttribute("name", "telefoni__add");
  root.appendChild(add);

  const live = document.createElement("span");
  live.setAttribute("data-slot", "repeater-live");
  live.setAttribute("data-repeater-live", "");
  live.setAttribute("data-lv-repeater-target", "live");
  live.setAttribute("aria-live", "polite");
  root.appendChild(live);

  document.body.appendChild(root);
  return root;
}

/** Start the real Stimulus app (optionally with a runtime) and await its MutationObserver. */
async function connect(runtime?: LievitRuntime): Promise<void> {
  startStimulus(runtime != null ? { runtime } : {});
  await flushStimulus();
}

const cards = (root: HTMLElement) =>
  Array.from(root.querySelectorAll<HTMLElement>("[data-repeater-item]"));
const fieldNames = (root: HTMLElement) =>
  Array.from(root.querySelectorAll<HTMLInputElement>("[data-repeater-items] input")).map(
    (i) => i.name,
  );
const fire = (el: Element): boolean =>
  el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
const addButton = (root: HTMLElement) =>
  root.querySelector<HTMLButtonElement>("[data-repeater-add]")!;

beforeEach(() => {
  document.body.innerHTML = "";
});

afterEach(() => {
  stopStimulus();
  document.body.innerHTML = "";
});

describe("lv-repeater controller -- add / remove (real Stimulus + real DOM)", () => {
  test("the Add button clones a fresh card with the next contiguous index in its nested field", async () => {
    const root = render(["111"]);
    await connect();
    const ev = new MouseEvent("click", { bubbles: true, cancelable: true });
    addButton(root).dispatchEvent(ev);
    expect(cards(root)).toHaveLength(2);
    expect(fieldNames(root)).toEqual(["telefoni[0][numero]", "telefoni[1][numero]"]);
    // The no-JS Add submit is kept inert when JS is on.
    expect(ev.defaultPrevented).toBe(true);
  });

  test("removing a middle card re-indexes the survivors so indices stay 0..n-1 and order is kept", async () => {
    const root = render(["a", "b", "c"]);
    await connect();
    const middleRemove = cards(root)[1].querySelector<HTMLButtonElement>("[data-repeater-remove]")!;
    fire(middleRemove);
    expect(cards(root)).toHaveLength(2);
    expect(fieldNames(root)).toEqual(["telefoni[0][numero]", "telefoni[1][numero]"]);
    const vals = Array.from(
      root.querySelectorAll<HTMLInputElement>("[data-repeater-items] input"),
    ).map((i) => i.value);
    expect(vals).toEqual(["a", "c"]);
  });

  test("clicking the icon inside a remove button still drops the right card (closest match)", async () => {
    const root = render(["a", "b"]);
    await connect();
    const icon = cards(root)[0].querySelector<SVGElement>("svg")!;
    fire(icon);
    expect(cards(root)).toHaveLength(1);
    expect(fieldNames(root)).toEqual(["telefoni[0][numero]"]);
  });

  test("the card + remove aria-labels re-number on reindex", async () => {
    const root = render(["a", "b"]);
    await connect();
    fire(cards(root)[0].querySelector<HTMLButtonElement>("[data-repeater-remove]")!);
    const survivor = cards(root)[0];
    expect(survivor.getAttribute("aria-label")).toBe("Item 1");
    expect(survivor.querySelector("[data-repeater-remove]")!.getAttribute("aria-label")).toBe(
      "Remove Item 1",
    );
  });

  test("add focuses the new card's first field and announces into the live region", async () => {
    const root = render([]);
    await connect();
    fire(addButton(root));
    const input = root.querySelector<HTMLInputElement>("[data-repeater-items] input")!;
    expect(document.activeElement).toBe(input);
    expect(root.querySelector("[data-repeater-live]")!.textContent).toBe("Item added");
    // The cloned card's remove data-action is bound by Stimulus's observer on the next tick.
    await flushStimulus();
    fire(input.closest("[data-repeater-item]")!.querySelector("[data-repeater-remove]")!);
    expect(root.querySelector("[data-repeater-live]")!.textContent).toBe("Item removed");
  });

  test("connect() wires every repeater root on the page at once", async () => {
    const first = render(["x"]);
    const second = render(["y"]);
    await connect();
    fire(addButton(first));
    fire(addButton(second));
    expect(cards(first)).toHaveLength(2);
    expect(cards(second)).toHaveLength(2);
  });
});

describe("lv-repeater controller -- uncontrolled doctrine (ZERO wire round-trip)", () => {
  test("add + remove edit the DOM client-side and never call the wire (the 410 doctrine)", async () => {
    const { runtime, calledActions } = makeRuntime();
    const root = render(["a", "b"]);
    await connect(runtime);

    fire(addButton(root)); // add a card
    fire(cards(root)[0].querySelector<HTMLButtonElement>("[data-repeater-remove]")!); // remove one

    await new Promise((r) => setTimeout(r, 10));
    expect(cards(root)).toHaveLength(2);
    expect(calledActions).toHaveLength(0);
  });
});

describe("lv-repeater controller -- morph-safety (the listener-stacking bug class)", () => {
  test("one Add click adds exactly one card after a real morph re-renders the root", async () => {
    const root = render(["a"]);
    await connect();
    // A real lievit wire morph replays the same markup (idiomorph). Stimulus must NOT double-connect
    // the controller, so a single click still adds a single card (no stacked add listener).
    morph(root, root.outerHTML);
    await flushStimulus();
    fire(addButton(root));
    expect(cards(root)).toHaveLength(2);
    expect(fieldNames(root)).toEqual(["telefoni[0][numero]", "telefoni[1][numero]"]);
  });

  test("a root removed by a morph stops responding (disconnect tears the wiring down)", async () => {
    const root = render(["a"]);
    document.body.insertAdjacentHTML("afterbegin", '<div id="host"></div>');
    const host = document.getElementById("host")!;
    host.appendChild(root);
    await connect();
    const detachedAdd = addButton(root);

    // Morph the host so the repeater root is gone; the controller disconnects.
    morph(host, '<div id="host"><span>gone</span></div>');
    await flushStimulus();

    // The detached Add button no longer reaches a live controller -> no clone happens.
    fire(detachedAdd);
    expect(root.querySelectorAll("[data-repeater-item]")).toHaveLength(1);
  });
});
