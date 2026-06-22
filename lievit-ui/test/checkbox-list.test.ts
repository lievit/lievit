/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * checkbox-list (Filament CheckboxList): a multi-select form control built on the native checkbox
 * primitive. Two halves:
 *   - the .jte SOURCE (structural golden: it compiles in the Java world; this pins the native
 *     fieldset group, the repeated-name POST contract, the JS-off-hidden tools and the a11y wiring)
 *   - the enhancer DOM behaviour (filter + bulk select-all) against a DOM shaped like the partial.
 */
import { describe, test, expect, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  enhanceCheckboxList,
  enhanceAllCheckboxLists,
  matchesQuery,
} from "../registry/jte/checkbox-list.enhancer.js";

const jteDir = join(import.meta.dirname, "..", "registry", "jte");
const read = (rel: string) => readFileSync(join(jteDir, rel), "utf8");
const markupOf = (rel: string) => read(rel).replace(/<%--[\s\S]*?--%>/g, "");

describe("checkbox-list.jte -- native multi-select form control", () => {
  const src = read("checkbox-list.jte");
  const markup = markupOf("checkbox-list.jte");

  test("is a native fieldset group carrying the enhancer hook", () => {
    expect(markup).toContain('<fieldset');
    expect(markup).toContain('data-slot="checkbox-list"');
    expect(markup).toContain("data-lievit-checkbox-list");
  });

  test("each option is the existing checkbox primitive sharing the one `name`", () => {
    expect(markup).toContain("@template.lievit.checkbox(name = name");
    expect(markup).toContain("checked = checkedSet.contains(opt.getKey())");
  });

  test("the search + bulk-toggle tools are rendered hidden so JS-off shows no dead controls", () => {
    expect(markup).toContain("data-checkbox-list-tools");
    expect(markup).toMatch(/data-checkbox-list-tools\s+hidden/);
  });

  test("the search is a labelled role=searchbox and the bulk toggle a real button with aria-pressed", () => {
    expect(markup).toContain('role="searchbox"');
    expect(markup).toContain("data-checkbox-list-search");
    expect(markup).toContain("data-checkbox-list-toggle-all");
    expect(markup).toContain('aria-pressed="false"');
    expect(markup).toContain('type="button"');
  });

  test("invalid + describedBy wire the group's aria state (error contract)", () => {
    expect(markup).toContain('aria-invalid="${invalid ? "true" : null}"');
    expect(markup).toContain('aria-describedby="${describedBy}"');
  });

  test("options come in via a Map param or a content slot, never hardcoded", () => {
    expect(src).toMatch(/@param java\.util\.Map<String, String> options/);
    expect(src).toMatch(/@param gg\.jte\.Content content/);
    expect(markup).toContain("@if(content != null)");
  });

  test("the option grid is token-driven with a 1/2/3 column choice", () => {
    expect(src).toContain("sm:grid-cols-2");
    expect(src).toContain("sm:grid-cols-3");
    expect(markup).toContain("data-checkbox-list-option");
  });

  test("no inline script or on* handler in the markup (CSP-clean)", () => {
    expect(markup).not.toMatch(/<script/);
    expect(markup).not.toMatch(/\son[a-z]+=/);
  });
});

describe("matchesQuery -- the pure filter predicate", () => {
  test("an empty query matches everything", () => {
    expect(matchesQuery("Villa", "")).toBe(true);
    expect(matchesQuery("Villa", "   ")).toBe(true);
  });
  test("matches a substring anywhere, case-insensitively", () => {
    expect(matchesQuery("Appartamento", "parta")).toBe(true);
    expect(matchesQuery("Appartamento", "PARTA")).toBe(true);
  });
  test("matches accent-insensitively", () => {
    expect(matchesQuery("Città", "citta")).toBe(true);
  });
  test("returns false when the label does not contain the query", () => {
    expect(matchesQuery("Villa", "garage")).toBe(false);
  });
});

/** Build a DOM matching the server-rendered checkbox-list partial. */
function render(opts: { name: string; values: string[]; tools: boolean }): HTMLElement {
  const root = document.createElement("fieldset");
  root.setAttribute("data-lievit-checkbox-list", "");
  root.setAttribute("data-slot", "checkbox-list");

  if (opts.tools) {
    const tools = document.createElement("div");
    tools.setAttribute("data-checkbox-list-tools", "");
    tools.hidden = true;
    const search = document.createElement("input");
    search.type = "text";
    search.setAttribute("data-checkbox-list-search", "");
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.setAttribute("data-checkbox-list-toggle-all", "");
    toggle.setAttribute("aria-pressed", "false");
    tools.append(search, toggle);
    root.appendChild(tools);
  }

  const grid = document.createElement("div");
  grid.setAttribute("data-checkbox-list-options", "");
  const labels: Record<string, string> = {
    villa: "Villa",
    appartamento: "Appartamento",
    box: "Box auto",
  };
  for (const [value, label] of Object.entries(labels)) {
    const option = document.createElement("div");
    option.setAttribute("data-checkbox-list-option", "");
    option.setAttribute("data-label", label);
    const box = document.createElement("input");
    box.type = "checkbox";
    box.setAttribute("data-slot", "checkbox-control");
    box.name = opts.name;
    box.value = value;
    box.checked = opts.values.includes(value);
    option.appendChild(box);
    grid.appendChild(option);
  }
  root.appendChild(grid);
  document.body.appendChild(root);
  return root;
}

function boxes(root: HTMLElement): HTMLInputElement[] {
  return Array.from(root.querySelectorAll<HTMLInputElement>("[data-slot='checkbox-control']"));
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("checkbox-list enhancer -- DOM behaviour", () => {
  test("reveals the hidden tools row when enhanced", () => {
    const root = render({ name: "t", values: [], tools: true });
    const tools = root.querySelector<HTMLElement>("[data-checkbox-list-tools]")!;
    expect(tools.hidden).toBe(true);
    enhanceCheckboxList(root);
    expect(tools.hidden).toBe(false);
  });

  test("typing in the search hides the non-matching options (display:none), keeps the boxes in the DOM", () => {
    const root = render({ name: "t", values: [], tools: true });
    enhanceCheckboxList(root);
    const search = root.querySelector<HTMLInputElement>("[data-checkbox-list-search]")!;
    search.value = "villa";
    search.dispatchEvent(new Event("input", { bubbles: true }));
    const options = Array.from(root.querySelectorAll<HTMLElement>("[data-checkbox-list-option]"));
    const shown = options.filter((o) => o.style.display !== "none");
    expect(shown).toHaveLength(1);
    expect(shown[0].getAttribute("data-label")).toBe("Villa");
    // the filtered box is still present (form-bound), just hidden
    expect(boxes(root)).toHaveLength(3);
  });

  test("the bulk toggle checks every visible box and fires native change", () => {
    const root = render({ name: "t", values: [], tools: true });
    enhanceCheckboxList(root);
    let changes = 0;
    root.addEventListener("change", () => changes++);
    const toggle = root.querySelector<HTMLButtonElement>("[data-checkbox-list-toggle-all]")!;
    toggle.click();
    expect(boxes(root).every((b) => b.checked)).toBe(true);
    expect(toggle.getAttribute("aria-pressed")).toBe("true");
    expect(changes).toBeGreaterThan(0);
  });

  test("the bulk toggle clears all when everything is already checked", () => {
    const root = render({ name: "t", values: ["villa", "appartamento", "box"], tools: true });
    enhanceCheckboxList(root);
    const toggle = root.querySelector<HTMLButtonElement>("[data-checkbox-list-toggle-all]")!;
    expect(toggle.getAttribute("aria-pressed")).toBe("true");
    toggle.click();
    expect(boxes(root).every((b) => !b.checked)).toBe(true);
    expect(toggle.getAttribute("aria-pressed")).toBe("false");
  });

  test("the bulk toggle acts only on visible boxes (respects an active filter)", () => {
    const root = render({ name: "t", values: [], tools: true });
    enhanceCheckboxList(root);
    const search = root.querySelector<HTMLInputElement>("[data-checkbox-list-search]")!;
    search.value = "villa";
    search.dispatchEvent(new Event("input", { bubbles: true }));
    root.querySelector<HTMLButtonElement>("[data-checkbox-list-toggle-all]")!.click();
    const checked = boxes(root).filter((b) => b.checked).map((b) => b.value);
    expect(checked).toEqual(["villa"]);
  });

  test("aria-pressed tracks hand ticks", () => {
    const root = render({ name: "t", values: ["villa", "appartamento"], tools: true });
    enhanceCheckboxList(root);
    const toggle = root.querySelector<HTMLButtonElement>("[data-checkbox-list-toggle-all]")!;
    const last = boxes(root)[2];
    last.checked = true;
    last.dispatchEvent(new Event("change", { bubbles: true }));
    expect(toggle.getAttribute("aria-pressed")).toBe("true");
  });

  test("is idempotent + enhanceAll wires every root", () => {
    const root = render({ name: "t", values: [], tools: true });
    enhanceCheckboxList(root);
    enhanceCheckboxList(root); // no throw, no double-wire
    expect(root.hasAttribute("data-checkbox-list-enhanced")).toBe(true);
    const second = render({ name: "u", values: [], tools: true });
    enhanceAllCheckboxLists();
    expect(second.hasAttribute("data-checkbox-list-enhanced")).toBe(true);
  });
});
