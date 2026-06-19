/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * <lv-menubar> (issue #448): horizontal application menubar. Pins menubar/menuitem ARIA,
 * roving tabindex, Left/Right between menus, Down opens, one-open-at-a-time, submenus.
 */
import { describe, test, expect, afterEach } from "vitest";
import "../registry/components/menubar/menubar.js";

interface Item {
  key?: string;
  label?: string;
  shortcut?: string;
  disabled?: boolean;
  type?: "item" | "checkbox" | "radio" | "separator" | "submenu";
  checked?: boolean;
  children?: Item[];
}
interface Menu {
  key: string;
  label: string;
  disabled?: boolean;
  items: Item[];
}
type El = HTMLElement & { menus: Menu[]; updateComplete: Promise<unknown> };

const sample: Menu[] = [
  {
    key: "file",
    label: "File",
    items: [
      { key: "new", label: "New Tab", shortcut: "⌘T" },
      { type: "separator" },
      { key: "print", label: "Print", shortcut: "⌘P" },
    ],
  },
  {
    key: "edit",
    label: "Edit",
    items: [
      { key: "undo", label: "Undo" },
      {
        label: "Find",
        type: "submenu",
        children: [
          { key: "search", label: "Search the web" },
          { key: "find-in", label: "Find in page" },
        ],
      },
    ],
  },
  {
    key: "view",
    label: "View",
    items: [{ key: "fullscreen", label: "Fullscreen", type: "checkbox", checked: false }],
  },
];

async function mount(menus: Menu[] = sample): Promise<El> {
  const el = document.createElement("lv-menubar") as El;
  el.menus = menus;
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}
function triggers(el: El): HTMLElement[] {
  return Array.from(el.querySelectorAll<HTMLElement>('[role="menubar"] > [role="menuitem"]'));
}
function panels(el: El): HTMLElement[] {
  return Array.from(el.querySelectorAll<HTMLElement>('[role="menu"]'));
}
async function triggerKey(el: El, index: number, k: string): Promise<void> {
  triggers(el)[index].dispatchEvent(
    new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true })
  );
  await el.updateComplete;
}
async function menuKey(el: El, k: string): Promise<void> {
  const focused = el.querySelector('[role="menu"] [tabindex="0"]') ?? panels(el)[0];
  focused?.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }));
  await el.updateComplete;
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("lv-menubar structure + ARIA", () => {
  test("renders into the light DOM (no shadow root)", async () => {
    const el = await mount();
    expect(el.shadowRoot).toBeNull();
  });

  test("the bar is role=menubar with one role=menuitem trigger per menu", async () => {
    const el = await mount();
    expect(el.querySelector('[role="menubar"]')).not.toBeNull();
    expect(triggers(el).length).toBe(3);
    expect(triggers(el)[0].getAttribute("aria-haspopup")).toBe("menu");
  });

  test("exactly one trigger is tabbable (roving tabindex)", async () => {
    const el = await mount();
    const tabbable = triggers(el).filter((t) => t.getAttribute("tabindex") === "0");
    expect(tabbable.length).toBe(1);
  });

  test("triggers are closed by default (aria-expanded=false, no panel)", async () => {
    const el = await mount();
    expect(triggers(el).every((t) => t.getAttribute("aria-expanded") === "false")).toBe(true);
    expect(panels(el).length).toBe(0);
  });
});

describe("lv-menubar open / navigation", () => {
  test("ArrowDown on a trigger opens its menu", async () => {
    const el = await mount();
    await triggerKey(el, 0, "ArrowDown");
    expect(triggers(el)[0].getAttribute("aria-expanded")).toBe("true");
    expect(panels(el).length).toBe(1);
  });

  test("clicking a trigger opens its menu; clicking again closes it", async () => {
    const el = await mount();
    triggers(el)[0].click();
    await el.updateComplete;
    expect(panels(el).length).toBe(1);
    triggers(el)[0].click();
    await el.updateComplete;
    expect(panels(el).length).toBe(0);
  });

  test("only one menu is open at a time", async () => {
    const el = await mount();
    triggers(el)[0].click();
    await el.updateComplete;
    triggers(el)[1].dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
    await el.updateComplete;
    expect(panels(el).length).toBe(1);
    expect(triggers(el)[1].getAttribute("aria-expanded")).toBe("true");
    expect(triggers(el)[0].getAttribute("aria-expanded")).toBe("false");
  });

  test("with a menu open, ArrowRight slides to the next menu", async () => {
    const el = await mount();
    await triggerKey(el, 0, "ArrowDown"); // open File
    await menuKey(el, "ArrowRight"); // slide to Edit
    expect(triggers(el)[1].getAttribute("aria-expanded")).toBe("true");
    expect(triggers(el)[0].getAttribute("aria-expanded")).toBe("false");
  });

  test("ArrowDown/Up navigate items, skipping the separator", async () => {
    const el = await mount();
    await triggerKey(el, 0, "ArrowDown"); // open File, first item active (New Tab)
    await menuKey(el, "ArrowDown"); // skip separator -> Print
    const active = el.querySelector(".lv-menubar__item--active");
    expect(active?.textContent).toContain("Print");
  });

  test("Enter activates an item and emits lv-select { menu, key }", async () => {
    const el = await mount();
    let detail: { menu?: string; key?: string } = {};
    el.addEventListener("lv-select", (e) => (detail = (e as CustomEvent).detail));
    await triggerKey(el, 0, "ArrowDown"); // New Tab active
    await menuKey(el, "Enter");
    expect(detail).toEqual({ menu: "file", key: "new" });
  });

  test("ArrowRight opens a submenu, ArrowLeft closes it", async () => {
    const el = await mount();
    await triggerKey(el, 1, "ArrowDown"); // open Edit; Undo active
    await menuKey(el, "ArrowDown"); // -> Find (submenu)
    await menuKey(el, "ArrowRight"); // open submenu
    expect(panels(el).length).toBe(2);
    await menuKey(el, "ArrowLeft"); // close submenu
    expect(panels(el).length).toBe(1);
  });

  test("Escape closes the open menu", async () => {
    const el = await mount();
    await triggerKey(el, 0, "ArrowDown");
    expect(panels(el).length).toBe(1);
    await menuKey(el, "Escape");
    expect(panels(el).length).toBe(0);
  });

  test("a click outside closes the open menu", async () => {
    const el = await mount();
    triggers(el)[0].click();
    await el.updateComplete;
    document.body.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    await el.updateComplete;
    expect(panels(el).length).toBe(0);
  });
});
