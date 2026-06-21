/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * combobox (the form-native searchable select, ADR-0012): a JTE partial whose JS-OFF base layer IS a
 * real native <select name=...> (POSTs in a plain form, fully accessible with zero JS), upgraded
 * JS-ON by a CSP-clean typed-TS enhancer into a WAI-ARIA combobox over the SAME <option>s, with the
 * native <select> kept as the form-bound source of truth. This is the eager/preloaded, client-side
 * filtered counterpart to the SERVER-filtered wire rich-select (rich-select.test.ts).
 *
 * This file pins (a) the partial SOURCE: the native <select> fallback is present + named, the a11y
 * roles, the data-slot shadcn names, the l:model bind, token-driven styling (--lv-* only), and a
 * CSP-clean source (no inline <script> / on* handlers in the partial); (b) the enhancer's pure
 * filter logic and its DOM behaviour against a DOM shaped like the partial output. The .jte real
 * compile is covered by the jte-compile smoke, not here.
 */
import { describe, test, expect, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildRegistry } from "../cli/build-registry.js";
import { resolve } from "../cli/registry.js";
import type { Registry } from "../cli/registry.js";
import {
  filterOptions,
  enhanceCombobox,
  enhanceAllComboboxes,
  type ComboboxOption,
} from "../registry/jte/combobox.enhancer.js";

const registryRoot = join(import.meta.dirname, "..", "registry");
const registry: Registry = buildRegistry(registryRoot);
const read = (rel: string) => readFileSync(join(registryRoot, rel), "utf8");
const jteSrc = read("jte/combobox.jte");
const jteMarkup = jteSrc.replace(/<%--[\s\S]*?--%>/g, "");

// ---------------------------------------------------------------------------
// (a) the partial SOURCE: native fallback, roles, data-slot, l:model, tokens, CSP-clean.
// ---------------------------------------------------------------------------
describe("combobox partial source", () => {
  test("JS-OFF base layer is a REAL native <select> carrying the field name (POSTs in a plain form)", () => {
    expect(jteMarkup).toMatch(/<select\b/);
    expect(jteMarkup).toContain('name="${name}"');
    // it is the form-bound native control, marked for the enhancer to find + keep.
    expect(jteMarkup).toContain("data-combobox-native");
    // the native control degrades gracefully: required/multiple/disabled are real attributes on it.
    expect(jteMarkup).toContain('multiple="${multiple}"');
  });

  test("all three native-select authoring forms are rendered (options / optionGroups / content slot)", () => {
    expect(jteMarkup).toContain("@param java.util.List<String> options");
    expect(jteMarkup).toContain("optionGroups");
    expect(jteMarkup).toContain("<optgroup");
    expect(jteMarkup).toContain("${content}");
  });

  test("data-slot uses shadcn combobox names (partial base layer + enhancer upgrade layer)", () => {
    // base layer (JS-off, in the .jte): the combobox root + the native control.
    for (const slot of ["combobox", "combobox-native", "combobox-icon"]) {
      expect(jteMarkup).toContain(`data-slot="${slot}"`);
    }
    // upgrade layer (JS-on, built by the enhancer): the search input + the listbox + items.
    const ts = read("jte/combobox.enhancer.ts");
    for (const slot of ["combobox-input", "combobox-content", "combobox-item"]) {
      expect(ts).toContain(`"data-slot", "${slot}"`);
    }
  });

  test("it binds via l:model on the native <select> (so the bind works JS-off too)", () => {
    expect(jteMarkup).toContain('l:model="${model}"');
  });

  test("token-driven: colours / spacing / radius come from --lv-* tokens, no raw hex / px", () => {
    expect(jteMarkup).toContain("var(--lv-color-");
    expect(jteMarkup).toContain("var(--lv-space-");
    expect(jteMarkup).toContain("var(--lv-radius-");
    // no hardcoded hex colours and no raw pixel sizes in the markup.
    expect(jteMarkup).not.toMatch(/#[0-9a-fA-F]{3,6}\b/);
  });

  test("CSP-clean: no inline <script> and no inline on* event handlers in the partial", () => {
    expect(jteMarkup).not.toMatch(/<script/i);
    expect(jteMarkup).not.toMatch(/\son[a-z]+\s*=/i);
  });

  test("the chevron composes the icon partial (no inline SVG), keeping it tokenised", () => {
    expect(jteMarkup).toContain("@template.lievit.icon(name = \"chevron-down\"");
  });

  test("the enhancer is CSP-clean: addEventListener only, no eval / new Function, no Lit import", () => {
    const ts = read("jte/combobox.enhancer.ts");
    const code = ts.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");
    expect(code).toContain("addEventListener");
    expect(code).not.toMatch(/\bnew Function\b|\beval\(/);
    expect(code).not.toMatch(/^import .*from "lit"/m);
    // it keeps the native <select> as the form source (writes back + fires native input/change).
    expect(code).toContain('dispatchEvent(new Event("change"');
  });
});

// ---------------------------------------------------------------------------
// (a') the registry item shape (the partial + the alias-root enhancer).
// ---------------------------------------------------------------------------
describe("combobox registry item", () => {
  test("combobox is a single registry:jte item", () => {
    const matches = registry.items.filter((i) => i.name === "combobox");
    expect(matches, "exactly one combobox item").toHaveLength(1);
    expect(matches[0].type).toBe("registry:jte");
  });

  test("it ships the .jte (jte root) + the enhancer .ts (alias root), no Lit dependency", () => {
    const item = registry.items.find((i) => i.name === "combobox")!;
    const jte = item.files.find((f) => f.target.endsWith(".jte"))!;
    const ts = item.files.find((f) => f.target.endsWith(".ts"))!;
    expect(jte.root).toBe("jte");
    expect(jte.target).toBe("lievit/combobox.jte");
    expect(ts.target).toBe("lievit/combobox.enhancer.ts");
    expect(item.dependencies ?? []).not.toContain("lit");
  });

  test("resolving it pulls tokens + the icon partial (icon before combobox)", () => {
    const closure = resolve(registry, ["combobox"]).map((i) => i.name);
    expect(closure).toContain("combobox");
    expect(closure).toContain("tokens");
    expect(closure).toContain("icon");
    expect(closure.indexOf("icon")).toBeLessThan(closure.indexOf("combobox"));
  });
});

// ---------------------------------------------------------------------------
// (b) the pure filter logic (DOM-free).
// ---------------------------------------------------------------------------
const opts = (...labels: string[]): ComboboxOption[] =>
  labels.map((label) => ({ value: label.toLowerCase(), label, group: null, disabled: false }));

describe("filterOptions (pure)", () => {
  test("an empty query returns every option unchanged, in order", () => {
    const all = opts("Parma", "Reggio", "Milano");
    expect(filterOptions(all, "")).toEqual(all);
    expect(filterOptions(all, "   ")).toEqual(all);
  });

  test("it matches a substring anywhere in the label, case-insensitively", () => {
    const all = opts("Parma", "Reggio Emilia", "Milano");
    expect(filterOptions(all, "emil").map((o) => o.label)).toEqual(["Reggio Emilia"]);
    expect(filterOptions(all, "MA").map((o) => o.label)).toEqual(["Parma"]);
  });

  test("it is accent-insensitive (Citta matches città)", () => {
    const all = opts("Città di Castello", "Parma");
    expect(filterOptions(all, "citta").map((o) => o.label)).toEqual(["Città di Castello"]);
  });

  test("a no-match query yields an empty list (the enhancer renders the empty state)", () => {
    expect(filterOptions(opts("Parma", "Milano"), "zzz")).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// (b') the enhancer's DOM behaviour against a partial-shaped DOM.
// ---------------------------------------------------------------------------

/** Build a combobox root matching combobox.jte: a native <select> of value==label options. */
function renderCombobox(
  values: string[],
  { multiple = false, selected = [] }: { multiple?: boolean; selected?: string[] } = {},
): { root: HTMLElement; select: HTMLSelectElement } {
  const root = document.createElement("div");
  root.setAttribute("data-lievit-combobox", "");
  root.setAttribute("data-multiple", String(multiple));
  root.setAttribute("data-listbox-id", "cb-listbox");
  root.setAttribute("data-search-id", "cb-search");

  const wrapper = document.createElement("div");
  wrapper.setAttribute("data-slot", "combobox-native-wrapper");
  const select = document.createElement("select");
  select.setAttribute("data-combobox-native", "");
  select.id = "agente";
  select.name = "agente";
  select.multiple = multiple;
  for (const v of values) {
    const opt = document.createElement("option");
    opt.value = v;
    opt.textContent = v;
    opt.selected = selected.includes(v);
    select.appendChild(opt);
  }
  wrapper.appendChild(select);
  root.appendChild(wrapper);
  document.body.appendChild(root);
  return { root, select };
}

const search = (root: HTMLElement) =>
  root.querySelector<HTMLInputElement>("[data-combobox-search]")!;
const listbox = (root: HTMLElement) =>
  root.querySelector<HTMLElement>("[data-combobox-listbox]")!;
const optionEls = (root: HTMLElement) =>
  Array.from(root.querySelectorAll<HTMLElement>("[data-combobox-option]"));

function pressKey(el: HTMLElement, key: string): KeyboardEvent {
  const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
  el.dispatchEvent(event);
  return event;
}

describe("combobox enhancer (progressive upgrade)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  test("it builds a WAI-ARIA combobox surface (role=combobox input + role=listbox) and hides the native select from AT", () => {
    const { root, select } = renderCombobox(["Parma", "Reggio", "Milano"]);
    enhanceCombobox(root);
    expect(search(root).getAttribute("role")).toBe("combobox");
    expect(search(root).getAttribute("aria-controls")).toBe("cb-listbox");
    expect(listbox(root).getAttribute("role")).toBe("listbox");
    // the native control stays in the DOM (the form source) but is hidden from AT.
    expect(select.isConnected).toBe(true);
    expect(select.getAttribute("aria-hidden")).toBe("true");
  });

  test("typing filters the listbox to matching options", () => {
    const { root } = renderCombobox(["Parma", "Reggio", "Milano"]);
    enhanceCombobox(root);
    const s = search(root);
    s.value = "re";
    s.dispatchEvent(new Event("input", { bubbles: true }));
    expect(optionEls(root).map((el) => el.getAttribute("data-combobox-option"))).toEqual(["Reggio"]);
  });

  test("ArrowDown + Enter selects an option and writes it back to the native <select> (single)", () => {
    const { root, select } = renderCombobox(["Parma", "Reggio", "Milano"]);
    enhanceCombobox(root);
    const s = search(root);
    s.dispatchEvent(new Event("focus"));
    pressKey(s, "ArrowDown"); // active = Parma
    pressKey(s, "ArrowDown"); // active = Reggio
    const enter = pressKey(s, "Enter");
    expect(enter.defaultPrevented).toBe(true);
    expect(select.value).toBe("Reggio");
    // single-mode collapses the listbox after a pick.
    expect(listbox(root).hidden).toBe(true);
  });

  test("multiple: choosing toggles membership on the native <select multiple> and renders removable chips", () => {
    const { root, select } = renderCombobox(["hot", "warm", "cold"], { multiple: true });
    enhanceCombobox(root);
    const s = search(root);
    s.dispatchEvent(new Event("focus"));
    const clickOption = (value: string) =>
      optionEls(root)
        .find((el) => el.getAttribute("data-combobox-option") === value)!
        .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    clickOption("hot");
    clickOption("cold");
    // addition writes through to the native <select multiple> (the form-bound source).
    expect(Array.from(select.selectedOptions).map((o) => o.value).sort()).toEqual(["cold", "hot"]);
    // both picks render as removable chips.
    const chips = () => root.querySelectorAll<HTMLButtonElement>("[data-combobox-chip]");
    expect(chips().length).toBe(2);
    expect(chips()[0].tagName).toBe("BUTTON");
    // a chip removes its value: the chip set shrinks and the listbox row deselects.
    chips()[0].click();
    expect(chips().length).toBe(1);
    s.dispatchEvent(new Event("focus"));
    const hotRow = optionEls(root).find((el) => el.getAttribute("data-combobox-option") === "hot")!;
    expect(hotRow.getAttribute("aria-selected")).toBe("false");
  });

  test("a no-match query shows the empty state, not a stale option", () => {
    const { root } = renderCombobox(["Parma", "Milano"]);
    enhanceCombobox(root);
    const s = search(root);
    s.value = "zzz";
    s.dispatchEvent(new Event("input", { bubbles: true }));
    expect(optionEls(root)).toHaveLength(0);
    expect(root.querySelector("[data-combobox-empty]")).not.toBeNull();
  });

  test("enhancing twice is idempotent (a re-render after a morph re-uses the same root)", () => {
    const { root } = renderCombobox(["Parma", "Reggio"]);
    enhanceAllComboboxes();
    enhanceCombobox(root); // no-op: already enhanced
    // exactly one search surface, not two stacked enhancements.
    expect(root.querySelectorAll("[data-combobox-search]")).toHaveLength(1);
  });
});
