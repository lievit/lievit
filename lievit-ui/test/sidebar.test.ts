/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * <lv-sidebar> (issue #454): the app sidebar primitive. Pins light-DOM, the nav landmark +
 * aria-current, group/menu/menu-sub rendering, the collapse toggle + Ctrl/Cmd+B shortcut,
 * localStorage persistence, and the lv-navigate / lv-state-change contract.
 */
import { describe, test, expect, afterEach, beforeEach } from "vitest";
import "../registry/components/sidebar/sidebar.js";
import type { SidebarGroup } from "../registry/components/sidebar/sidebar.js";

type SidebarEl = HTMLElement & {
  groups: SidebarGroup[];
  active: string;
  label: string;
  state: "expanded" | "collapsed";
  side: "left" | "right";
  collapsible: "icon" | "offcanvas";
  storageKey: string;
  shortcut: string;
  toggle: () => void;
  updateComplete: Promise<unknown>;
};

const groups = [
  {
    label: "Platform",
    items: [
      { key: "home", label: "Home", icon: "house", href: "/" },
      { key: "users", label: "Users", icon: "users", badge: "3" },
      {
        key: "settings",
        label: "Settings",
        icon: "settings",
        items: [
          { key: "settings.general", label: "General" },
          { key: "settings.security", label: "Security" },
        ],
      },
      { key: "logs", label: "Logs", disabled: true },
    ],
  },
];

async function mount(set?: (el: SidebarEl) => void): Promise<SidebarEl> {
  const el = document.createElement("lv-sidebar") as SidebarEl;
  el.groups = groups;
  set?.(el);
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

beforeEach(() => {
  try {
    globalThis.localStorage?.clear();
  } catch {
    /* no storage */
  }
});

afterEach(() => {
  document.body.innerHTML = "";
});

describe("lv-sidebar", () => {
  test("renders into the light DOM (no shadow root)", async () => {
    const el = await mount();
    expect(el.shadowRoot).toBeNull();
  });

  test("renders a <nav> landmark with the accessible label", async () => {
    const el = await mount((e) => {
      e.label = "Primary";
    });
    const nav = el.querySelector("nav");
    expect(nav).not.toBeNull();
    expect(nav?.getAttribute("aria-label")).toBe("Primary");
  });

  test("renders the group label and one menu item per top-level entry", async () => {
    const el = await mount();
    expect(el.querySelector(".lv-sidebar__group-label")?.textContent?.trim()).toBe("Platform");
    // 4 top-level items (sub-items only render when the parent is open)
    expect(el.querySelectorAll(".lv-sidebar__menu > li > .lv-sidebar__item").length).toBe(4);
  });

  test("an item with href renders an <a>, a plain item renders a <button>", async () => {
    const el = await mount();
    const home = el.querySelector('a.lv-sidebar__item') as HTMLAnchorElement;
    expect(home).not.toBeNull();
    expect(home.getAttribute("href")).toBe("/");
    expect(el.querySelector('button.lv-sidebar__item')).not.toBeNull();
  });

  test("active item gets aria-current=page", async () => {
    const el = await mount((e) => {
      e.active = "users";
    });
    const current = el.querySelector('[aria-current="page"]');
    expect(current).not.toBeNull();
    expect(current?.textContent).toContain("Users");
  });

  test("badge renders for items that declare one", async () => {
    const el = await mount();
    const badge = el.querySelector(".lv-sidebar__badge");
    expect(badge?.textContent?.trim()).toBe("3");
  });

  test("disabled item is marked aria-disabled and is a disabled button", async () => {
    const el = await mount();
    const logs = Array.from(el.querySelectorAll<HTMLButtonElement>("button.lv-sidebar__item")).find(
      (b) => b.textContent?.includes("Logs")
    );
    expect(logs?.getAttribute("aria-disabled")).toBe("true");
    expect(logs?.disabled).toBe(true);
  });

  test("clicking a leaf item emits lv-navigate with its key", async () => {
    let detail: unknown;
    const el = await mount();
    el.addEventListener("lv-navigate", (ev) => {
      detail = (ev as CustomEvent).detail;
    });
    const users = Array.from(el.querySelectorAll<HTMLElement>(".lv-sidebar__item")).find((i) =>
      i.textContent?.includes("Users")
    );
    users?.click();
    expect(detail).toBe("users");
  });

  test("a parent item expands its sub-tree instead of navigating", async () => {
    let navigated = false;
    const el = await mount();
    el.addEventListener("lv-navigate", () => {
      navigated = true;
    });
    const settings = Array.from(el.querySelectorAll<HTMLElement>(".lv-sidebar__item")).find((i) =>
      i.textContent?.includes("Settings")
    ) as HTMLButtonElement;
    expect(settings.getAttribute("aria-expanded")).toBe("false");
    settings.click();
    await el.updateComplete;
    expect(navigated).toBe(false);
    expect(settings.getAttribute("aria-expanded")).toBe("true");
    const sub = el.querySelector(".lv-sidebar__sub");
    expect(sub).not.toBeNull();
    expect(sub?.querySelectorAll(".lv-sidebar__item").length).toBe(2);
  });

  test("toggle() flips expanded <-> collapsed and emits lv-state-change", async () => {
    let detail: unknown;
    const el = await mount();
    el.addEventListener("lv-state-change", (ev) => {
      detail = (ev as CustomEvent).detail;
    });
    expect(el.state).toBe("expanded");
    el.toggle();
    await el.updateComplete;
    expect(el.state).toBe("collapsed");
    expect(detail).toBe("collapsed");
    expect(el.querySelector(".lv-sidebar--collapsed")).not.toBeNull();
  });

  test("collapsed state persists to localStorage and rehydrates on a fresh instance", async () => {
    const el = await mount((e) => {
      e.storageKey = "lv-sidebar-test";
    });
    el.toggle();
    await el.updateComplete;
    expect(globalThis.localStorage?.getItem("lv-sidebar-test")).toBe("collapsed");

    document.body.innerHTML = "";
    const el2 = document.createElement("lv-sidebar") as SidebarEl;
    el2.groups = groups;
    el2.storageKey = "lv-sidebar-test";
    document.body.appendChild(el2);
    await el2.updateComplete;
    expect(el2.state).toBe("collapsed");
  });

  test("Ctrl/Cmd+B keyboard shortcut toggles the sidebar", async () => {
    const el = await mount();
    expect(el.state).toBe("expanded");
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "b", ctrlKey: true }));
    await el.updateComplete;
    expect(el.state).toBe("collapsed");
  });
});
