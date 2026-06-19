/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * <lv-context-menu> (issue #445): right-click context menu. Pins pointer-open, menu/menuitem
 * ARIA, keyboard navigation + typeahead, checkbox/radio items, submenus, and Escape close.
 */
import { describe, test, expect, afterEach } from "vitest";
import "../registry/components/context-menu/context-menu.js";

interface Item {
  key?: string;
  label?: string;
  icon?: string;
  shortcut?: string;
  disabled?: boolean;
  type?: "item" | "checkbox" | "radio" | "separator" | "submenu";
  checked?: boolean;
  radioGroup?: string;
  children?: Item[];
}

type El = HTMLElement & { items: Item[]; updateComplete: Promise<unknown> };

const sample: Item[] = [
  { key: "back", label: "Back", icon: "arrow-left", shortcut: "⌘[" },
  { key: "fwd", label: "Forward", disabled: true },
  { type: "separator" },
  { key: "show-bar", label: "Show Bookmarks", type: "checkbox", checked: true },
  { type: "separator" },
  {
    label: "More Tools",
    type: "submenu",
    children: [
      { key: "save", label: "Save Page" },
      { key: "dev", label: "Developer Tools" },
    ],
  },
];

async function mount(items: Item[] = sample): Promise<El> {
  const el = document.createElement("lv-context-menu") as El;
  el.items = items;
  el.innerHTML = "<div>right click me</div>";
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

function trigger(el: El): HTMLElement {
  return el.querySelector(".lv-context-menu__trigger") as HTMLElement;
}
async function openAt(el: El, x = 50, y = 50): Promise<void> {
  trigger(el).dispatchEvent(
    new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: x, clientY: y })
  );
  await el.updateComplete;
}
function menu(el: El): HTMLElement | null {
  return el.querySelector('[role="menu"]');
}
function items(el: El, container: HTMLElement | null = el): HTMLElement[] {
  return Array.from(
    (container ?? el).querySelectorAll<HTMLElement>(
      '[role="menuitem"],[role="menuitemcheckbox"],[role="menuitemradio"]'
    )
  );
}
async function key(el: El, k: string): Promise<void> {
  const focused = el.querySelector('[role="menu"] [tabindex="0"]') ?? menu(el);
  focused?.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }));
  await el.updateComplete;
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("lv-context-menu structure + ARIA", () => {
  test("renders into the light DOM (no shadow root)", async () => {
    const el = await mount();
    expect(el.shadowRoot).toBeNull();
  });

  test("the menu is closed until a contextmenu event on the trigger", async () => {
    const el = await mount();
    expect(menu(el)).toBeNull();
    await openAt(el);
    expect(menu(el)).not.toBeNull();
    expect(menu(el)?.getAttribute("role")).toBe("menu");
  });

  test("contextmenu is prevented (we own the menu, not the browser)", async () => {
    const el = await mount();
    const ev = new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 10, clientY: 10 });
    trigger(el).dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
  });

  test("renders the correct roles incl. separators and checkbox", async () => {
    const el = await mount();
    await openAt(el);
    const root = menu(el)!;
    expect(items(el, root).length).toBe(4); // back, fwd, checkbox, submenu (separators excluded)
    expect(root.querySelectorAll('[role="separator"]').length).toBe(2);
    expect(root.querySelector('[role="menuitemcheckbox"]')?.getAttribute("aria-checked")).toBe("true");
  });

  test("a disabled item carries aria-disabled", async () => {
    const el = await mount();
    await openAt(el);
    const fwd = items(el)[1];
    expect(fwd.getAttribute("aria-disabled")).toBe("true");
  });

  test("the submenu trigger advertises aria-haspopup + aria-expanded", async () => {
    const el = await mount();
    await openAt(el);
    const sub = items(el).find((i) => i.getAttribute("aria-haspopup") === "menu")!;
    expect(sub).toBeTruthy();
    expect(sub.getAttribute("aria-expanded")).toBe("false");
  });

  test("icons render as inline Lucide svg, never Font Awesome", async () => {
    const el = await mount();
    await openAt(el);
    expect(el.querySelector(".lv-context-menu__icon svg")).not.toBeNull();
    expect(el.querySelector("i.fa, i.fas")).toBeNull();
  });
});

describe("lv-context-menu keyboard", () => {
  test("ArrowDown skips the disabled item", async () => {
    const el = await mount();
    await openAt(el);
    // first enabled is index 0 (Back); next enabled skips disabled Forward -> checkbox
    await key(el, "ArrowDown");
    const active = el.querySelector(".lv-context-menu__item--active");
    expect(active?.getAttribute("role")).toBe("menuitemcheckbox");
  });

  test("Enter activates and emits lv-select with the key", async () => {
    const el = await mount();
    let got = "";
    el.addEventListener("lv-select", (e) => (got = (e as CustomEvent).detail));
    await openAt(el);
    await key(el, "Enter"); // Back is active by default
    expect(got).toBe("back");
  });

  test("activating a checkbox emits lv-checked-change with the toggled value", async () => {
    const el = await mount();
    let detail: { key?: string; checked?: boolean } = {};
    el.addEventListener("lv-checked-change", (e) => (detail = (e as CustomEvent).detail));
    await openAt(el);
    await key(el, "ArrowDown"); // -> checkbox (checked:true)
    await key(el, "Enter");
    expect(detail).toEqual({ key: "show-bar", checked: false });
  });

  test("typeahead jumps to the item starting with the typed letter", async () => {
    const el = await mount();
    await openAt(el);
    await key(el, "S"); // "Show Bookmarks"
    expect(el.querySelector(".lv-context-menu__item--active")?.textContent).toContain("Show Bookmarks");
  });

  test("ArrowRight opens the submenu; ArrowLeft closes it", async () => {
    const el = await mount();
    await openAt(el);
    await key(el, "End"); // -> the submenu item (last enabled)
    await key(el, "ArrowRight");
    expect(el.querySelectorAll('[role="menu"]').length).toBe(2);
    await key(el, "ArrowLeft");
    expect(el.querySelectorAll('[role="menu"]').length).toBe(1);
  });

  test("Escape closes the menu", async () => {
    const el = await mount();
    await openAt(el);
    expect(menu(el)).not.toBeNull();
    await key(el, "Escape");
    expect(menu(el)).toBeNull();
  });
});

describe("lv-context-menu mouse", () => {
  test("clicking an item emits lv-select and closes", async () => {
    const el = await mount();
    let got = "";
    el.addEventListener("lv-select", (e) => (got = (e as CustomEvent).detail));
    await openAt(el);
    items(el)[0].click(); // Back
    await el.updateComplete;
    expect(got).toBe("back");
    expect(menu(el)).toBeNull();
  });

  test("a click outside closes the menu", async () => {
    const el = await mount();
    await openAt(el);
    document.body.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    await el.updateComplete;
    expect(menu(el)).toBeNull();
  });
});
