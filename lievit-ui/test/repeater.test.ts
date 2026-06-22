/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * repeater (Filament Repeater): repeatable nested-schema item cards (recursive content slot) that
 * POST as an indexed form-array. Two halves: a structural golden over the partial SOURCE (the
 * recursive itemContent slot, the `<name>[<i>][...]` POST contract, the JS-off Add/remove submit
 * fallback, the hidden <template> card, the reorder-as-follow-up grip, a11y), and the enhancer DOM
 * behaviour (add clones, remove drops, both re-index the nested field names contiguous).
 */
import { describe, test, expect, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  enhanceRepeater,
  enhanceAllRepeaters,
  reindexFieldName,
} from "../registry/jte/repeater.enhancer.js";

const jteDir = join(import.meta.dirname, "..", "registry", "jte");
const read = (rel: string) => readFileSync(join(jteDir, rel), "utf8");
const markupOf = (rel: string) => read(rel).replace(/<%--[\s\S]*?--%>/g, "");

describe("repeater.jte -- repeatable nested-schema item cards", () => {
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
    expect(markup).toContain("<template data-repeater-template>");
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

  test("no inline script or on* handler in the rendered markup (CSP-clean)", () => {
    const live = markup.replace(/<template[\s\S]*?<\/template>/g, "");
    expect(live).not.toMatch(/<script/);
    expect(markup).not.toMatch(/\son[a-z]+=/);
  });
});

describe("reindexFieldName -- the array-name rewrite", () => {
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

/** Build a DOM matching the server-rendered repeater partial (each card holds one nested input). */
function render(values: string[] = []): HTMLElement {
  const root = document.createElement("fieldset");
  root.setAttribute("data-lievit-repeater", "");
  root.setAttribute("data-name", "telefoni");

  const itemsHost = document.createElement("div");
  itemsHost.setAttribute("data-repeater-items", "");
  values.forEach((v, i) => itemsHost.appendChild(buildCard(v, i)));
  root.appendChild(itemsHost);

  const template = document.createElement("template");
  template.setAttribute("data-repeater-template", "");
  template.innerHTML = cardHtml("__i__", "__label__", "");
  root.appendChild(template);

  const add = document.createElement("button");
  add.type = "submit";
  add.setAttribute("data-repeater-add", "");
  root.appendChild(add);

  const live = document.createElement("span");
  live.setAttribute("data-repeater-live", "");
  root.appendChild(live);

  document.body.appendChild(root);
  return root;
}

function cardHtml(index: string, label: string, value: string): string {
  return (
    `<div data-repeater-item data-index="${index}" role="group" aria-label="Item ${label}">` +
    `<button data-repeater-remove aria-label="Remove Item ${label}"></button>` +
    `<div data-slot="repeater-item-body">` +
    `<input name="telefoni[${index}][numero]" value="${value}" aria-label="Numero">` +
    `</div></div>`
  );
}

function buildCard(value: string, i: number): HTMLElement {
  const wrap = document.createElement("div");
  wrap.innerHTML = cardHtml(String(i), String(i + 1), value);
  return wrap.firstElementChild as HTMLElement;
}

const cards = (root: HTMLElement) =>
  Array.from(root.querySelectorAll<HTMLElement>("[data-repeater-item]"));
const fieldNames = (root: HTMLElement) =>
  Array.from(root.querySelectorAll<HTMLInputElement>("[data-repeater-items] input")).map((i) => i.name);

afterEach(() => {
  document.body.innerHTML = "";
});

describe("repeater enhancer -- DOM behaviour", () => {
  test("the Add button clones a fresh card with the next contiguous index in its nested field", () => {
    const root = render(["111"]);
    enhanceRepeater(root);
    const add = root.querySelector<HTMLButtonElement>("[data-repeater-add]")!;
    const ev = new MouseEvent("click", { bubbles: true, cancelable: true });
    add.dispatchEvent(ev);
    expect(cards(root)).toHaveLength(2);
    expect(fieldNames(root)).toEqual(["telefoni[0][numero]", "telefoni[1][numero]"]);
    expect(ev.defaultPrevented).toBe(true);
  });

  test("removing a middle card re-indexes the survivors so indices stay 0..n-1 and order is kept", () => {
    const root = render(["a", "b", "c"]);
    enhanceRepeater(root);
    const middleRemove = cards(root)[1].querySelector<HTMLButtonElement>("[data-repeater-remove]")!;
    const ev = new MouseEvent("click", { bubbles: true, cancelable: true });
    middleRemove.dispatchEvent(ev);
    expect(cards(root)).toHaveLength(2);
    expect(fieldNames(root)).toEqual(["telefoni[0][numero]", "telefoni[1][numero]"]);
    const vals = Array.from(
      root.querySelectorAll<HTMLInputElement>("[data-repeater-items] input"),
    ).map((i) => i.value);
    expect(vals).toEqual(["a", "c"]);
  });

  test("the card + remove aria-labels re-number on reindex", () => {
    const root = render(["a", "b"]);
    enhanceRepeater(root);
    cards(root)[0].querySelector<HTMLButtonElement>("[data-repeater-remove]")!
      .dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    const survivor = cards(root)[0];
    expect(survivor.getAttribute("aria-label")).toBe("Item 1");
    expect(survivor.querySelector("[data-repeater-remove]")!.getAttribute("aria-label")).toBe(
      "Remove Item 1",
    );
  });

  test("is idempotent + enhanceAll wires every root", () => {
    const root = render(["a"]);
    enhanceRepeater(root);
    enhanceRepeater(root);
    expect(root.hasAttribute("data-repeater-enhanced")).toBe(true);
    const second = render();
    enhanceAllRepeaters();
    expect(second.hasAttribute("data-repeater-enhanced")).toBe(true);
  });
});
