/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * key-value-input (Filament KeyValue, the EDITABLE form control -- distinct from the read-only
 * key-value display primitive): repeatable key/value rows that POST as an indexed form-array. Two
 * halves: a structural golden over the partial SOURCE (the `<name>[<i>][key|value]` POST contract,
 * the JS-off Add/remove submit fallback, the hidden <template> row, a11y), and the enhancer DOM
 * behaviour (add clones + focuses, remove drops, both re-index so indices stay contiguous).
 */
import { describe, test, expect, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  enhanceKeyValueInput,
  enhanceAllKeyValueInputs,
  indexedName,
} from "../registry/jte/key-value-input.enhancer.js";

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
    expect(markup).toContain("<template data-key-value-input-template>");
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

/** Build a DOM matching the server-rendered key-value-input partial. */
function render(entries: [string, string][] = []): HTMLElement {
  const root = document.createElement("div");
  root.setAttribute("data-lievit-key-value-input", "");
  root.setAttribute("data-name", "meta");

  const rowsHost = document.createElement("div");
  rowsHost.setAttribute("data-key-value-input-rows", "");
  entries.forEach(([k, v], i) => rowsHost.appendChild(buildRow(k, v, i)));
  root.appendChild(rowsHost);

  const template = document.createElement("template");
  template.setAttribute("data-key-value-input-template", "");
  template.innerHTML = rowHtml("__i__", "__label__", "", "");
  root.appendChild(template);

  const add = document.createElement("button");
  add.type = "submit";
  add.setAttribute("data-key-value-input-add", "");
  root.appendChild(add);

  const live = document.createElement("span");
  live.setAttribute("data-key-value-input-live", "");
  root.appendChild(live);

  document.body.appendChild(root);
  return root;
}

function rowHtml(index: string, label: string, k: string, v: string): string {
  return (
    `<div data-key-value-input-row data-index="${index}">` +
    `<input data-key-value-input-key name="meta[${index}][key]" value="${k}" aria-label="Key, row ${label}">` +
    `<input data-key-value-input-value name="meta[${index}][value]" value="${v}" aria-label="Value, row ${label}">` +
    `<button data-key-value-input-remove aria-label="Remove row ${label}"></button>` +
    `</div>`
  );
}

function buildRow(k: string, v: string, i: number): HTMLElement {
  const wrap = document.createElement("div");
  wrap.innerHTML = rowHtml(String(i), String(i + 1), k, v);
  return wrap.firstElementChild as HTMLElement;
}

const rows = (root: HTMLElement) =>
  Array.from(root.querySelectorAll<HTMLElement>("[data-key-value-input-row]"));
const keyNames = (root: HTMLElement) =>
  Array.from(root.querySelectorAll<HTMLInputElement>("[data-key-value-input-key]")).map((i) => i.name);

afterEach(() => {
  document.body.innerHTML = "";
});

describe("key-value-input enhancer -- DOM behaviour", () => {
  test("the Add button clones a fresh row with contiguous indexed names", () => {
    const root = render([["a", "1"]]);
    enhanceKeyValueInput(root);
    const add = root.querySelector<HTMLButtonElement>("[data-key-value-input-add]")!;
    const ev = new MouseEvent("click", { bubbles: true, cancelable: true });
    add.dispatchEvent(ev);
    expect(rows(root)).toHaveLength(2);
    expect(keyNames(root)).toEqual(["meta[0][key]", "meta[1][key]"]);
    expect(ev.defaultPrevented).toBe(true);
  });

  test("removing a middle row re-indexes the survivors so indices stay 0..n-1", () => {
    const root = render([["a", "1"], ["b", "2"], ["c", "3"]]);
    enhanceKeyValueInput(root);
    // remove the middle row (b)
    const middleRemove = rows(root)[1].querySelector<HTMLButtonElement>("[data-key-value-input-remove]")!;
    const ev = new MouseEvent("click", { bubbles: true, cancelable: true });
    middleRemove.dispatchEvent(ev);
    expect(rows(root)).toHaveLength(2);
    expect(keyNames(root)).toEqual(["meta[0][key]", "meta[1][key]"]);
    // the surviving values are a and c, in order
    const vals = Array.from(
      root.querySelectorAll<HTMLInputElement>("[data-key-value-input-key]"),
    ).map((i) => i.value);
    expect(vals).toEqual(["a", "c"]);
    expect(ev.defaultPrevented).toBe(true);
  });

  test("a freshly added row re-indexes its aria-labels with the new row number", () => {
    const root = render([["a", "1"]]);
    enhanceKeyValueInput(root);
    root.querySelector<HTMLButtonElement>("[data-key-value-input-add]")!
      .dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    const newKey = rows(root)[1].querySelector<HTMLInputElement>("[data-key-value-input-key]")!;
    expect(newKey.getAttribute("aria-label")).toBe("Key, row 2");
    expect(newKey.name).toBe("meta[1][key]");
  });

  test("is idempotent + enhanceAll wires every root", () => {
    const root = render([["a", "1"]]);
    enhanceKeyValueInput(root);
    enhanceKeyValueInput(root);
    expect(root.hasAttribute("data-key-value-input-enhanced")).toBe(true);
    const second = render();
    enhanceAllKeyValueInputs();
    expect(second.hasAttribute("data-key-value-input-enhanced")).toBe(true);
  });
});
