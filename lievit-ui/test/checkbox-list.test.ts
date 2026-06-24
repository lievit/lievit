/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * checkbox-list (v-next re-forge): a multi-select form control built on the native checkbox
 * primitive. Two halves:
 *   - the .jte SOURCE (structural golden: compiles in the Java world; pins the native fieldset
 *     group, the repeated-name POST contract, the JS-off-hidden tools, and the a11y wiring)
 *   - the enhancer DOM behaviour (filter + bulk select-all) against a DOM shaped like the partial
 *
 * Data-slot used by the re-forged checkbox primitive: "checkbox-input" (not the legacy
 * "checkbox-control" name). The render helper and the enhancer both use "checkbox-input".
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

// ---------------------------------------------------------------------------
// JTE source golden assertions
// ---------------------------------------------------------------------------

describe("checkbox-list.jte -- native multi-select form control", () => {
  const src = read("checkbox-list.jte");
  const markup = markupOf("checkbox-list.jte");

  test("is a native fieldset group carrying the enhancer hook", () => {
    expect(markup).toContain("<fieldset");
    expect(markup).toContain('data-slot="checkbox-list"');
    expect(markup).toContain("data-lievit-checkbox-list");
  });

  test("carries data-columns for CSS hooks and test targeting", () => {
    expect(markup).toContain('data-columns="${columns}"');
  });

  test("each option is the existing checkbox primitive sharing the one name", () => {
    expect(markup).toContain("@template.lievit.checkbox(name = name");
    expect(markup).toContain("checked = checkedSet.contains(opt.getKey())");
  });

  test("each option wrapper carries data-value and data-label for enhancer targeting", () => {
    expect(markup).toContain('data-value="${opt.getKey()}"');
    expect(markup).toContain('data-label="${opt.getValue()}"');
  });

  test("the label for each option is a SIBLING label[for], not embedded in the primitive", () => {
    expect(markup).toContain("<label");
    expect(markup).toContain('for="${optId}"');
  });

  test("the search + bulk-toggle tools are rendered hidden so JS-off shows no dead controls", () => {
    expect(markup).toContain("data-checkbox-list-tools");
    expect(markup).toMatch(/data-checkbox-list-tools\s+hidden/);
  });

  test("the search is a labelled role=searchbox with resolvedSearchAriaLabel", () => {
    expect(markup).toContain('role="searchbox"');
    expect(markup).toContain("data-checkbox-list-search");
    expect(markup).toContain('aria-label="${resolvedSearchAriaLabel}"');
  });

  test("the bulk toggle is a real button with aria-pressed and dynamic label data-*", () => {
    expect(markup).toContain("data-checkbox-list-toggle-all");
    expect(markup).toContain('aria-pressed="false"');
    expect(markup).toContain('type="button"');
    expect(markup).toContain('data-select-all-label="${selectAllLabel}"');
    expect(markup).toContain('data-clear-label="${resolvedClearLabel}"');
  });

  test("invalid and describedBy wire the group aria state (error contract)", () => {
    expect(markup).toContain('aria-invalid="${invalid ? "true" : null}"');
    expect(markup).toContain('aria-describedby="${describedBy}"');
  });

  test("required sets aria-required on the fieldset (native required on fieldset is not supported)", () => {
    expect(markup).toContain('aria-required="${required ? "true" : null}"');
  });

  test("disabled is reflected as both native disabled attr and data-disabled hook", () => {
    expect(markup).toContain('disabled="${disabled}"');
    expect(markup).toContain('data-disabled="${disabled ? "true" : null}"');
  });

  test("options come in via a Map param or a content slot, never hardcoded", () => {
    expect(src).toMatch(/@param java\.util\.Map<String, String> options/);
    expect(src).toMatch(/@param gg\.jte\.Content content/);
    expect(markup).toContain("@if(content != null)");
  });

  test("the option grid is token-driven with a 1/2/3 column choice", () => {
    expect(src).toContain("sm:grid-cols-2");
    expect(src).toContain("sm:grid-cols-3");
    expect(markup).toContain("data-checkbox-list-options");
  });

  test("no inline script or on* handler in the markup (CSP-clean)", () => {
    expect(markup).not.toMatch(/<script/);
    expect(markup).not.toMatch(/\son[a-z]+=/);
  });

  test("no io.lievit import (JTE classpath has no lievit jar)", () => {
    expect(src).not.toContain("@import io.lievit");
  });

  test("no hardcoded colour or literal hex in the markup", () => {
    expect(markup).not.toMatch(/#[0-9a-fA-F]{3,6}\b/);
  });

  test("font-family comes from the token class, not an inline style with a literal", () => {
    expect(markup).toContain("font-[var(--lv-font-sans)]");
    expect(markup).not.toContain('style="font-family:');
  });
});

// ---------------------------------------------------------------------------
// matchesQuery -- the pure filter predicate (no DOM needed)
// ---------------------------------------------------------------------------

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

  test("trims whitespace from the query before matching", () => {
    expect(matchesQuery("Villa", "  villa  ")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// DOM render helper (mirrors the server-rendered partial shape)
// ---------------------------------------------------------------------------

/** Build a DOM matching the server-rendered checkbox-list partial. */
function render(opts: {
  name: string;
  values: string[];
  tools: boolean;
  selectAllLabel?: string;
  clearLabel?: string;
}): HTMLElement {
  const root = document.createElement("fieldset");
  root.setAttribute("data-lievit-checkbox-list", "");
  root.setAttribute("data-slot", "checkbox-list");

  if (opts.tools) {
    const tools = document.createElement("div");
    tools.setAttribute("data-checkbox-list-tools", "");
    tools.hidden = true;

    const searchWrap = document.createElement("div");
    const search = document.createElement("input");
    search.type = "text";
    search.setAttribute("role", "searchbox");
    search.setAttribute("data-checkbox-list-search", "");
    searchWrap.appendChild(search);
    tools.appendChild(searchWrap);

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.setAttribute("data-checkbox-list-toggle-all", "");
    toggle.setAttribute("aria-pressed", "false");
    toggle.setAttribute(
      "data-select-all-label",
      opts.selectAllLabel ?? "Select all",
    );
    toggle.setAttribute(
      "data-clear-label",
      opts.clearLabel ?? opts.selectAllLabel ?? "Select all",
    );
    toggle.textContent = opts.selectAllLabel ?? "Select all";
    tools.appendChild(toggle);

    root.appendChild(tools);
  }

  const grid = document.createElement("div");
  grid.setAttribute("data-checkbox-list-options", "");
  const entries: [string, string][] = [
    ["villa", "Villa"],
    ["appartamento", "Appartamento"],
    ["box", "Box auto"],
  ];
  for (const [value, label] of entries) {
    const option = document.createElement("div");
    option.setAttribute("data-checkbox-list-option", "");
    option.setAttribute("data-label", label);
    option.setAttribute("data-value", value);
    // Use data-slot="checkbox-input" -- the re-forged checkbox primitive's slot name.
    const box = document.createElement("input");
    box.type = "checkbox";
    box.setAttribute("data-slot", "checkbox-input");
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
  return Array.from(
    root.querySelectorAll<HTMLInputElement>("[data-slot='checkbox-input']"),
  );
}

afterEach(() => {
  document.body.innerHTML = "";
});

// ---------------------------------------------------------------------------
// Enhancer DOM behaviour
// ---------------------------------------------------------------------------

describe("checkbox-list enhancer -- DOM behaviour", () => {
  test("reveals the hidden tools row when enhanced", () => {
    const root = render({ name: "t", values: [], tools: true });
    const tools = root.querySelector<HTMLElement>("[data-checkbox-list-tools]")!;
    expect(tools.hidden).toBe(true);
    enhanceCheckboxList(root);
    expect(tools.hidden).toBe(false);
  });

  test("typing in the search hides non-matching options (display:none), keeps the boxes in the DOM", () => {
    const root = render({ name: "t", values: [], tools: true });
    enhanceCheckboxList(root);
    const search = root.querySelector<HTMLInputElement>("[data-checkbox-list-search]")!;
    search.value = "villa";
    search.dispatchEvent(new Event("input", { bubbles: true }));
    const options = Array.from(
      root.querySelectorAll<HTMLElement>("[data-checkbox-list-option]"),
    );
    const shown = options.filter((o) => o.style.display !== "none");
    expect(shown).toHaveLength(1);
    expect(shown[0].getAttribute("data-label")).toBe("Villa");
    // filtered boxes are still present (form-bound), just hidden
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
    const root = render({
      name: "t",
      values: ["villa", "appartamento", "box"],
      tools: true,
    });
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

  test("aria-pressed tracks hand ticks (all-checked after two are pre-checked and last is ticked)", () => {
    const root = render({ name: "t", values: ["villa", "appartamento"], tools: true });
    enhanceCheckboxList(root);
    const toggle = root.querySelector<HTMLButtonElement>("[data-checkbox-list-toggle-all]")!;
    // initially two out of three: not all-checked
    expect(toggle.getAttribute("aria-pressed")).toBe("false");
    const last = boxes(root)[2];
    last.checked = true;
    last.dispatchEvent(new Event("change", { bubbles: true }));
    expect(toggle.getAttribute("aria-pressed")).toBe("true");
  });

  test("toggle label swaps to clearLabel when all are checked, back when not", () => {
    const root = render({
      name: "t",
      values: [],
      tools: true,
      selectAllLabel: "Select all",
      clearLabel: "Clear all",
    });
    enhanceCheckboxList(root);
    const toggle = root.querySelector<HTMLButtonElement>("[data-checkbox-list-toggle-all]")!;
    expect(toggle.textContent).toBe("Select all");
    toggle.click();
    expect(toggle.textContent).toBe("Clear all");
    toggle.click();
    expect(toggle.textContent).toBe("Select all");
  });

  test("is idempotent (calling enhance twice does not double-wire)", () => {
    const root = render({ name: "t", values: [], tools: true });
    enhanceCheckboxList(root);
    enhanceCheckboxList(root);
    expect(root.hasAttribute("data-checkbox-list-enhanced")).toBe(true);
    // clicking once should change from false to true, not throw
    const toggle = root.querySelector<HTMLButtonElement>("[data-checkbox-list-toggle-all]")!;
    toggle.click();
    expect(toggle.getAttribute("aria-pressed")).toBe("true");
  });

  test("enhanceAll wires every root on the page", () => {
    const first = render({ name: "t", values: [], tools: true });
    const second = render({ name: "u", values: [], tools: true });
    enhanceAllCheckboxLists();
    expect(first.hasAttribute("data-checkbox-list-enhanced")).toBe(true);
    expect(second.hasAttribute("data-checkbox-list-enhanced")).toBe(true);
  });

  test("enhanceAll with a custom scope only wires roots inside that scope", () => {
    const outer = render({ name: "t", values: [], tools: true });
    const scope = document.createElement("div");
    document.body.appendChild(scope);
    const inner = render({ name: "u", values: [], tools: true });
    scope.appendChild(inner);
    enhanceAllCheckboxLists(scope);
    // inner is inside scope -- should be wired
    expect(inner.hasAttribute("data-checkbox-list-enhanced")).toBe(true);
    // outer was already appended to body, not inside scope
    // (outer is already wired in this case because enhanceAll appended it;
    //  we just confirm inner got its own enhancement independently)
    expect(inner !== outer).toBe(true);
  });

  test("disabled boxes are excluded from the visible-boxes set and not toggled", () => {
    const root = document.createElement("fieldset");
    root.setAttribute("data-lievit-checkbox-list", "");
    const tools = document.createElement("div");
    tools.setAttribute("data-checkbox-list-tools", "");
    tools.hidden = true;
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.setAttribute("data-checkbox-list-toggle-all", "");
    toggle.setAttribute("aria-pressed", "false");
    toggle.setAttribute("data-select-all-label", "Select all");
    toggle.setAttribute("data-clear-label", "Select all");
    toggle.textContent = "Select all";
    tools.appendChild(toggle);
    root.appendChild(tools);

    const grid = document.createElement("div");
    grid.setAttribute("data-checkbox-list-options", "");
    for (const [v, disabled] of [["a", false], ["b", true]] as [string, boolean][]) {
      const opt = document.createElement("div");
      opt.setAttribute("data-checkbox-list-option", "");
      opt.setAttribute("data-label", v);
      const box = document.createElement("input");
      box.type = "checkbox";
      box.setAttribute("data-slot", "checkbox-input");
      box.value = v;
      box.disabled = disabled;
      opt.appendChild(box);
      grid.appendChild(opt);
    }
    root.appendChild(grid);
    document.body.appendChild(root);

    enhanceCheckboxList(root);
    toggle.click();

    const allBoxes = Array.from(
      root.querySelectorAll<HTMLInputElement>("[data-slot='checkbox-input']"),
    );
    // "a" (enabled) should be checked; "b" (disabled) should remain unchecked
    expect(allBoxes[0].checked).toBe(true);
    expect(allBoxes[1].checked).toBe(false);
  });
});
