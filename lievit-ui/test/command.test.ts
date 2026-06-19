/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * <lv-command> (issue #444): searchable command palette. Pins filter-as-you-type, grouping,
 * keyboard up/down/enter selection, empty state, and the combobox/listbox ARIA wiring.
 */
import { describe, test, expect, afterEach } from "vitest";
import "../registry/components/command/command.js";

interface CommandItem {
  value: string;
  label: string;
  group?: string;
  icon?: string;
  shortcut?: string;
  keywords?: string;
  disabled?: boolean;
}

type CommandEl = HTMLElement & {
  items: CommandItem[];
  query: string;
  emptyText: string;
  updateComplete: Promise<unknown>;
};

const sample: CommandItem[] = [
  { value: "new", label: "New file", group: "File", icon: "file", shortcut: "⌘N" },
  { value: "open", label: "Open folder", group: "File", icon: "folder" },
  { value: "settings", label: "Settings", group: "App", keywords: "preferences config" },
  { value: "logout", label: "Log out", group: "App", disabled: true },
];

async function mount(set?: (el: CommandEl) => void): Promise<CommandEl> {
  const el = document.createElement("lv-command") as CommandEl;
  el.items = sample;
  set?.(el);
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

function searchBox(el: CommandEl): HTMLInputElement {
  return el.querySelector(".lv-command__search") as HTMLInputElement;
}
function options(el: CommandEl): HTMLElement[] {
  return Array.from(el.querySelectorAll<HTMLElement>('[role="option"]'));
}
async function search(el: CommandEl, q: string) {
  const box = searchBox(el);
  box.value = q;
  box.dispatchEvent(new Event("input", { bubbles: true }));
  await el.updateComplete;
}
async function key(el: CommandEl, k: string) {
  searchBox(el).dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }));
  await el.updateComplete;
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("lv-command structure + ARIA", () => {
  test("renders into the light DOM (no shadow root)", async () => {
    const el = await mount();
    expect(el.shadowRoot).toBeNull();
  });

  test("search box is a combobox controlling a labelled listbox", async () => {
    const el = await mount();
    const box = searchBox(el);
    expect(box.getAttribute("role")).toBe("combobox");
    const listId = box.getAttribute("aria-controls");
    expect(listId).toBeTruthy();
    const list = el.querySelector(`#${listId}`);
    expect(list?.getAttribute("role")).toBe("listbox");
  });

  test("renders one role=option per item", async () => {
    const el = await mount();
    expect(options(el).length).toBe(4);
  });

  test("renders group headings for grouped items", async () => {
    const el = await mount();
    const headings = Array.from(el.querySelectorAll(".lv-command__group-label")).map((h) => h.textContent);
    expect(headings).toEqual(["File", "App"]);
  });

  test("the search icon is an inline svg (Lucide), not Font Awesome", async () => {
    const el = await mount();
    const icon = el.querySelector(".lv-command__search-icon svg");
    expect(icon).not.toBeNull();
    expect(el.querySelector("i.fa, i.fas")).toBeNull();
  });
});

describe("lv-command filter-as-you-type", () => {
  test("filtering narrows the options by label", async () => {
    const el = await mount();
    await search(el, "open");
    const labels = options(el).map((o) => o.textContent?.trim());
    expect(labels).toEqual(["Open folder"]);
  });

  test("filtering matches keywords (synonyms), not just the label", async () => {
    const el = await mount();
    await search(el, "preferences");
    expect(options(el).length).toBe(1);
    expect(options(el)[0].textContent).toContain("Settings");
  });

  test("no match shows the empty state", async () => {
    const el = await mount();
    await search(el, "zzzzz");
    expect(options(el).length).toBe(0);
    expect(el.querySelector(".lv-command__empty")?.textContent).toBe("No results found.");
  });
});

describe("lv-command keyboard selection", () => {
  test("first item is active by default (aria-selected + activedescendant)", async () => {
    const el = await mount();
    expect(options(el)[0].getAttribute("aria-selected")).toBe("true");
    expect(searchBox(el).getAttribute("aria-activedescendant")).toBe(options(el)[0].id);
  });

  test("ArrowDown moves the active option, skipping disabled items", async () => {
    const el = await mount();
    await key(el, "ArrowDown"); // -> Open folder
    expect(options(el)[1].getAttribute("aria-selected")).toBe("true");
    await key(el, "ArrowDown"); // -> Settings
    await key(el, "ArrowDown"); // would be Log out (disabled) -> wraps to New file
    expect(options(el)[0].getAttribute("aria-selected")).toBe("true");
  });

  test("Enter selects the active item and emits lv-select with its value", async () => {
    const el = await mount();
    let selected = "";
    el.addEventListener("lv-select", (ev) => { selected = (ev as CustomEvent).detail; });
    await key(el, "ArrowDown"); // Open folder
    await key(el, "Enter");
    expect(selected).toBe("open");
  });

  test("clicking an item emits lv-select", async () => {
    const el = await mount();
    let selected = "";
    el.addEventListener("lv-select", (ev) => { selected = (ev as CustomEvent).detail; });
    options(el)[2].click(); // Settings
    expect(selected).toBe("settings");
  });

  test("clicking a disabled item does not select", async () => {
    const el = await mount();
    let selected = "";
    el.addEventListener("lv-select", (ev) => { selected = (ev as CustomEvent).detail; });
    options(el)[3].click(); // Log out (disabled)
    expect(selected).toBe("");
  });

  test("Escape emits lv-escape (so a host dialog can close)", async () => {
    const el = await mount();
    let escaped = false;
    el.addEventListener("lv-escape", () => { escaped = true; });
    await key(el, "Escape");
    expect(escaped).toBe(true);
  });
});
