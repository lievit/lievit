/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * Static command-palette (registry/jte/command-palette): the WHOLE catalog ships as real HTML; a
 * CSP-clean typed-TS enhancer filters it in-browser + wires keyboard nav (NO server round-trip, that
 * is the wire command's job). The .jte render is pinned by the real-compiler jte-compile smoke; this
 * pins the pure filter core + the enhancer's DOM behaviour against a DOM shaped like the partial.
 */
import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { commandFilter, enhanceCommand, enhanceAllCommands } from "../registry/jte/command.enhancer.js";

/** Build a DOM matching the server-rendered command partial: input + listbox of option items. */
function renderPalette(
  items: Array<{ label: string; group?: string }>,
): HTMLElement {
  const root = document.createElement("div");
  root.setAttribute("data-lievit-command", "");
  root.setAttribute("data-empty-text", "No results found.");

  const search = document.createElement("input");
  search.setAttribute("data-command-search", "");
  search.setAttribute("role", "combobox");
  root.appendChild(search);

  const list = document.createElement("ul");
  list.setAttribute("data-command-list", "");
  list.setAttribute("role", "listbox");

  let prevGroup = "";
  items.forEach((it, i) => {
    if (it.group && it.group !== prevGroup) {
      const heading = document.createElement("li");
      heading.setAttribute("data-command-group", it.group);
      heading.textContent = it.group;
      list.appendChild(heading);
      prevGroup = it.group;
    }
    const li = document.createElement("li");
    li.id = `cmd-opt-${i}`;
    li.setAttribute("data-command-item", "");
    li.setAttribute("data-command-label", it.label);
    li.setAttribute("role", "option");
    const action = document.createElement("button");
    action.setAttribute("data-command-action", "");
    action.textContent = it.label;
    li.appendChild(action);
    list.appendChild(li);
  });

  const empty = document.createElement("li");
  empty.setAttribute("data-command-empty", "");
  empty.hidden = true;
  empty.textContent = "No results found.";
  list.appendChild(empty);

  root.appendChild(list);
  document.body.appendChild(root);
  return root;
}

const search = (root: HTMLElement) => root.querySelector<HTMLInputElement>("[data-command-search]")!;
const items = (root: HTMLElement) =>
  Array.from(root.querySelectorAll<HTMLElement>("[data-command-item]"));
const visible = (root: HTMLElement) =>
  items(root).filter((el) => !el.hidden).map((el) => el.getAttribute("data-command-label"));
const empty = (root: HTMLElement) => root.querySelector<HTMLElement>("[data-command-empty]")!;

/** Simulate a user typing a query into the search box. */
function type(root: HTMLElement, q: string): void {
  search(root).value = q;
  search(root).dispatchEvent(new Event("input", { bubbles: true }));
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("commandFilter (pure, DOM-free)", () => {
  const labels = ["Dashboard", "New contact", "Città di Parma", "Settings"];

  test("a blank query shows every item", () => {
    expect(commandFilter(labels, "")).toEqual([true, true, true, true]);
    expect(commandFilter(labels, "   ")).toEqual([true, true, true, true]);
  });

  test("substring match anywhere in the label, case-insensitive", () => {
    expect(commandFilter(labels, "set")).toEqual([false, false, false, true]);
    expect(commandFilter(labels, "CONT")).toEqual([false, true, false, false]);
  });

  test("accent-insensitive (Citta matches Città)", () => {
    expect(commandFilter(labels, "citta")).toEqual([false, false, true, false]);
  });

  test("no match returns all false", () => {
    expect(commandFilter(labels, "zzz")).toEqual([false, false, false, false]);
  });
});

describe("command enhancer behaviour", () => {
  let root: HTMLElement;
  beforeEach(() => {
    root = renderPalette([
      { label: "Dashboard", group: "Navigation" },
      { label: "Settings", group: "Navigation" },
      { label: "New contact", group: "Actions" },
    ]);
    enhanceCommand(root);
  });

  test("seeds with every item visible and the empty state hidden", () => {
    expect(visible(root)).toEqual(["Dashboard", "Settings", "New contact"]);
    expect(empty(root).hidden).toBe(true);
  });

  test("typing filters the rendered items in-place (no re-render)", () => {
    type(root, "set");
    expect(visible(root)).toEqual(["Settings"]);
  });

  test("a group heading hides when all its items are filtered out", () => {
    type(root, "contact");
    const headings = Array.from(root.querySelectorAll<HTMLElement>("[data-command-group]"));
    const nav = headings.find((h) => h.getAttribute("data-command-group") === "Navigation")!;
    const actions = headings.find((h) => h.getAttribute("data-command-group") === "Actions")!;
    expect(nav.hidden).toBe(true); // no Navigation item matches
    expect(actions.hidden).toBe(false); // "New contact" matches
  });

  test("the empty state shows when nothing matches", () => {
    type(root, "zzz");
    expect(visible(root)).toEqual([]);
    expect(empty(root).hidden).toBe(false);
  });

  test("ArrowDown then Enter activates the active visible item", () => {
    let clicked = "";
    items(root).forEach((li) => {
      const action = li.querySelector<HTMLElement>("[data-command-action]")!;
      action.addEventListener("click", () => {
        clicked = li.getAttribute("data-command-label") ?? "";
      });
    });
    search(root).dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    expect(search(root).getAttribute("aria-activedescendant")).toBe(items(root)[0].id);
    search(root).dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(clicked).toBe("Dashboard");
  });

  test("ArrowUp from the start wraps to the last visible item", () => {
    search(root).dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }));
    expect(search(root).getAttribute("aria-activedescendant")).toBe(items(root)[2].id);
  });

  test("ArrowDown navigates only the VISIBLE items after a filter", () => {
    type(root, "a"); // Dashboard, New contact (both contain 'a'); Settings drops out... 'Settings' has no 'a'
    // Dashboard + New contact remain visible.
    expect(visible(root)).toEqual(["Dashboard", "New contact"]);
    search(root).dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    search(root).dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    // second ArrowDown lands on the second visible item (New contact), not the DOM-second (Settings).
    const active = items(root).find((el) => el.getAttribute("data-command-active") === "true")!;
    expect(active.getAttribute("data-command-label")).toBe("New contact");
  });

  test("Escape clears a non-empty query and restores every item", () => {
    type(root, "set");
    expect(visible(root)).toEqual(["Settings"]);
    search(root).dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(search(root).value).toBe("");
    expect(visible(root)).toEqual(["Dashboard", "Settings", "New contact"]);
  });

  test("enhanceCommand is idempotent (re-enhancing does not double-bind the filter)", () => {
    enhanceCommand(root); // second call: marked, no-op
    type(root, "set");
    // one input handler => clean single filter pass, still exactly Settings visible.
    expect(visible(root)).toEqual(["Settings"]);
  });

  test("enhanceAllCommands wires every palette on the page", () => {
    const second = renderPalette([{ label: "Logout" }, { label: "Profile" }]);
    enhanceAllCommands();
    type(second, "log");
    expect(visible(second)).toEqual(["Logout"]);
  });
});
