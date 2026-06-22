/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * tags-input (Filament TagsInput): chips + add-input + optional suggestions; tags POST as a
 * repeated `name`. Two halves: a structural golden over the partial SOURCE (the hidden-input-per-tag
 * repeated-POST contract, the JS-off Add/remove submit fallback, a11y), and the enhancer DOM
 * behaviour (in-place add via Enter / comma / Add / suggestion, remove via x, Backspace pop, dedup).
 */
import { describe, test, expect, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  enhanceTagsInput,
  enhanceAllTagsInputs,
  normalizeTag,
} from "../registry/jte/tags-input.enhancer.js";

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
    expect(markup).toContain('data-tags-input-add');
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

/** Build a DOM matching the server-rendered tags-input partial. */
function render(values: string[] = [], suggestions: string[] = []): HTMLElement {
  const root = document.createElement("div");
  root.setAttribute("data-lievit-tags-input", "");
  root.setAttribute("data-name", "etichette");

  const control = document.createElement("div");
  const chips = document.createElement("div");
  chips.setAttribute("data-tags-input-chips", "");
  for (const tag of values) {
    const chip = document.createElement("span");
    chip.setAttribute("data-tags-input-chip", tag);
    const hidden = document.createElement("input");
    hidden.type = "hidden";
    hidden.setAttribute("data-tags-input-value", "");
    hidden.name = "etichette";
    hidden.value = tag;
    const remove = document.createElement("button");
    remove.type = "submit";
    remove.setAttribute("data-tags-input-remove", tag);
    chip.append(hidden, remove);
    chips.appendChild(chip);
  }
  control.appendChild(chips);

  const field = document.createElement("input");
  field.type = "text";
  field.name = "etichette";
  field.setAttribute("data-tags-input-field", "");
  control.appendChild(field);

  const add = document.createElement("button");
  add.type = "submit";
  add.setAttribute("data-tags-input-add", "");
  control.appendChild(add);
  root.appendChild(control);

  if (suggestions.length) {
    const sugRow = document.createElement("div");
    for (const s of suggestions) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.setAttribute("data-tags-input-suggestion", s);
      sugRow.appendChild(btn);
    }
    root.appendChild(sugRow);
  }

  const live = document.createElement("span");
  live.setAttribute("data-tags-input-live", "");
  root.appendChild(live);

  document.body.appendChild(root);
  return root;
}

const field = (root: HTMLElement) =>
  root.querySelector<HTMLInputElement>("[data-tags-input-field]")!;
const tagValues = (root: HTMLElement) =>
  Array.from(root.querySelectorAll<HTMLInputElement>("[data-tags-input-value]")).map((i) => i.value);

function pressKey(el: HTMLInputElement, key: string): void {
  el.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("tags-input enhancer -- DOM behaviour", () => {
  test("Enter adds a chip with a hidden input under the repeated name + clears the field", () => {
    const root = render();
    enhanceTagsInput(root);
    field(root).value = "urgente";
    pressKey(field(root), "Enter");
    expect(tagValues(root)).toEqual(["urgente"]);
    expect(root.querySelector<HTMLInputElement>("[data-tags-input-value]")!.name).toBe("etichette");
    expect(field(root).value).toBe("");
  });

  test("comma also commits a tag", () => {
    const root = render();
    enhanceTagsInput(root);
    field(root).value = "richiamare";
    pressKey(field(root), ",");
    expect(tagValues(root)).toEqual(["richiamare"]);
  });

  test("a duplicate tag is rejected and announced", () => {
    const root = render(["urgente"]);
    enhanceTagsInput(root);
    field(root).value = "urgente";
    pressKey(field(root), "Enter");
    expect(tagValues(root)).toEqual(["urgente"]);
    expect(root.querySelector("[data-tags-input-live]")!.textContent).toContain("already");
  });

  test("an empty / whitespace tag is not added", () => {
    const root = render();
    enhanceTagsInput(root);
    field(root).value = "   ";
    pressKey(field(root), "Enter");
    expect(tagValues(root)).toEqual([]);
  });

  test("clicking the chip x removes the tag (and cancels its native submit)", () => {
    const root = render(["a", "b"]);
    enhanceTagsInput(root);
    const removeB = root.querySelector<HTMLButtonElement>('[data-tags-input-remove="b"]')!;
    const ev = new MouseEvent("click", { bubbles: true, cancelable: true });
    removeB.dispatchEvent(ev);
    expect(tagValues(root)).toEqual(["a"]);
    expect(ev.defaultPrevented).toBe(true);
  });

  test("the JS-off Add button is hidden and, if clicked, adds in place instead of submitting", () => {
    const root = render();
    enhanceTagsInput(root);
    const add = root.querySelector<HTMLButtonElement>("[data-tags-input-add]")!;
    expect(add.hidden).toBe(true);
    field(root).value = "trattativa";
    const ev = new MouseEvent("click", { bubbles: true, cancelable: true });
    add.dispatchEvent(ev);
    expect(tagValues(root)).toEqual(["trattativa"]);
    expect(ev.defaultPrevented).toBe(true);
  });

  test("Backspace on an empty field pops the last chip", () => {
    const root = render(["x", "y"]);
    enhanceTagsInput(root);
    field(root).value = "";
    pressKey(field(root), "Backspace");
    expect(tagValues(root)).toEqual(["x"]);
  });

  test("a suggestion click adds that tag", () => {
    const root = render([], ["hot", "warm"]);
    enhanceTagsInput(root);
    root.querySelector<HTMLButtonElement>('[data-tags-input-suggestion="warm"]')!.click();
    expect(tagValues(root)).toEqual(["warm"]);
  });

  test("is idempotent + enhanceAll wires every root", () => {
    const root = render();
    enhanceTagsInput(root);
    enhanceTagsInput(root);
    expect(root.hasAttribute("data-tags-input-enhanced")).toBe(true);
    const second = render();
    enhanceAllTagsInputs();
    expect(second.hasAttribute("data-tags-input-enhanced")).toBe(true);
  });
});
