/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * tags-input (Filament TagsInput): chips + add-input + optional suggestions; tags POST as a
 * repeated `name`. Two halves: a structural golden over the partial SOURCE (the hidden-input-per-tag
 * repeated-POST contract, the JS-off Add/remove submit fallback, a11y, v-next params), and the
 * enhancer DOM behaviour (in-place add via Enter / delimiter / Add / suggestion, remove via x,
 * Backspace pop, dedup, paste splitting, chip keyboard nav, clear-all, live region).
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

/** Build a DOM matching the server-rendered tags-input partial. */
function render(
  values: string[] = [],
  suggestions: string[] = [],
  opts: {
    delimiter?: string;
    size?: string;
    clearable?: boolean;
    disabled?: boolean;
  } = {},
): HTMLElement {
  const delimiter = opts.delimiter ?? ",";
  const size = opts.size ?? "md";
  const clearable = opts.clearable ?? false;

  const root = document.createElement("div");
  root.setAttribute("data-lievit-tags-input", "");
  root.setAttribute("data-name", "etichette");
  root.setAttribute("data-delimiter", delimiter);
  root.setAttribute("data-size", size);
  if (opts.disabled) root.setAttribute("data-disabled", "true");

  const well = document.createElement("div");

  const chips = document.createElement("div");
  chips.setAttribute("data-tags-input-chips", "");
  for (const tag of values) {
    const chip = document.createElement("span");
    chip.setAttribute("data-tags-input-chip", tag);
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
    chip.append(hidden, labelEl, remove);
    chips.appendChild(chip);
  }
  well.appendChild(chips);

  const field = document.createElement("input");
  field.type = "text";
  field.name = "etichette";
  field.setAttribute("data-tags-input-field", "");
  well.appendChild(field);

  if (clearable && values.length > 0) {
    const clearBtn = document.createElement("button");
    clearBtn.type = "button";
    clearBtn.setAttribute("data-tags-input-clear-all", "");
    clearBtn.setAttribute("aria-label", "Clear all tags");
    well.appendChild(clearBtn);
  }

  const add = document.createElement("button");
  add.type = "submit";
  add.setAttribute("data-tags-input-add", "");
  well.appendChild(add);
  root.appendChild(well);

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
  live.setAttribute("role", "status");
  live.setAttribute("aria-live", "polite");
  live.setAttribute("data-tags-input-live", "");
  root.appendChild(live);

  document.body.appendChild(root);
  return root;
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
  document.body.innerHTML = "";
});

describe("tags-input enhancer -- DOM behaviour", () => {
  test("Enter adds a chip with a hidden input under the repeated name + clears the field", () => {
    const root = render();
    enhanceTagsInput(root);
    fieldEl(root).value = "urgente";
    pressKey(fieldEl(root), "Enter");
    expect(tagValues(root)).toEqual(["urgente"]);
    expect(root.querySelector<HTMLInputElement>("[data-tags-input-value]")!.name).toBe("etichette");
    expect(fieldEl(root).value).toBe("");
  });

  test("comma also commits a tag", () => {
    const root = render();
    enhanceTagsInput(root);
    fieldEl(root).value = "richiamare";
    pressKey(fieldEl(root), ",");
    expect(tagValues(root)).toEqual(["richiamare"]);
  });

  test("a duplicate tag is rejected and announced", () => {
    const root = render(["urgente"]);
    enhanceTagsInput(root);
    fieldEl(root).value = "urgente";
    pressKey(fieldEl(root), "Enter");
    expect(tagValues(root)).toEqual(["urgente"]);
    expect(liveText(root)).toContain("already");
  });

  test("an empty / whitespace tag is not added", () => {
    const root = render();
    enhanceTagsInput(root);
    fieldEl(root).value = "   ";
    pressKey(fieldEl(root), "Enter");
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
    fieldEl(root).value = "trattativa";
    const ev = new MouseEvent("click", { bubbles: true, cancelable: true });
    add.dispatchEvent(ev);
    expect(tagValues(root)).toEqual(["trattativa"]);
    expect(ev.defaultPrevented).toBe(true);
  });

  test("Backspace on an empty field pops the last chip", () => {
    const root = render(["x", "y"]);
    enhanceTagsInput(root);
    fieldEl(root).value = "";
    pressKey(fieldEl(root), "Backspace");
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

  // v-next enhancer DOM behaviour tests
  test("ArrowLeft from entry input at position 0 moves focus to last chip", () => {
    const root = render(["a", "b", "c"]);
    enhanceTagsInput(root);
    const f = fieldEl(root);
    f.focus();
    f.setSelectionRange(0, 0);
    const lastChip = root.querySelectorAll<HTMLElement>("[data-tags-input-chip]")[2]!;
    pressKey(f, "ArrowLeft");
    expect(document.activeElement).toBe(lastChip);
  });

  test("ArrowRight from last chip moves focus to entry input", () => {
    const root = render(["a", "b"]);
    enhanceTagsInput(root);
    const allChips = root.querySelectorAll<HTMLElement>("[data-tags-input-chip]");
    const lastChip = allChips[allChips.length - 1]!;
    lastChip.focus();
    pressKey(lastChip, "ArrowRight");
    expect(document.activeElement).toBe(fieldEl(root));
  });

  test("Home from chip moves focus to first chip", () => {
    const root = render(["a", "b", "c"]);
    enhanceTagsInput(root);
    const allChips = root.querySelectorAll<HTMLElement>("[data-tags-input-chip]");
    const lastChip = allChips[2]!;
    lastChip.focus();
    pressKey(lastChip, "Home");
    expect(document.activeElement).toBe(allChips[0]);
  });

  test("End from chip moves focus to entry input", () => {
    const root = render(["a", "b"]);
    enhanceTagsInput(root);
    const allChips = root.querySelectorAll<HTMLElement>("[data-tags-input-chip]");
    allChips[0].focus();
    pressKey(allChips[0], "End");
    expect(document.activeElement).toBe(fieldEl(root));
  });

  test("paste with delimiter splits into multiple tags", () => {
    const root = render();
    enhanceTagsInput(root);
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

  test("clear-all button removes all chips", () => {
    const root = render(["x", "y", "z"], [], { clearable: true });
    enhanceTagsInput(root);
    const clearBtn = root.querySelector<HTMLButtonElement>("[data-tags-input-clear-all]")!;
    clearBtn.click();
    expect(tagValues(root)).toEqual([]);
  });

  test("live region announces Tag added and Tag removed", () => {
    const root = render(["existing"]);
    enhanceTagsInput(root);

    fieldEl(root).value = "newtag";
    pressKey(fieldEl(root), "Enter");
    expect(liveText(root)).toBe("Tag added: newtag");

    const removeBtn = root.querySelector<HTMLButtonElement>('[data-tags-input-remove="existing"]')!;
    removeBtn.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    expect(liveText(root)).toBe("Tag removed: existing");
  });

  test("chip built by enhancer has role=option and aria-selected=true", () => {
    const root = render();
    enhanceTagsInput(root);
    fieldEl(root).value = "testtag";
    pressKey(fieldEl(root), "Enter");
    const chip = root.querySelector<HTMLElement>("[data-tags-input-chip]")!;
    expect(chip.getAttribute("role")).toBe("option");
    expect(chip.getAttribute("aria-selected")).toBe("true");
  });

  test("Escape clears the entry input value", () => {
    const root = render();
    enhanceTagsInput(root);
    fieldEl(root).value = "in-progress";
    pressKey(fieldEl(root), "Escape");
    expect(fieldEl(root).value).toBe("");
  });

  test("delimiter key (from data-delimiter) also commits a tag", () => {
    const root = render([], [], { delimiter: ";" });
    enhanceTagsInput(root);
    fieldEl(root).value = "semicolontag";
    pressKey(fieldEl(root), ";");
    expect(tagValues(root)).toEqual(["semicolontag"]);
  });
});
