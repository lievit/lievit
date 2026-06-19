/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * <lv-navigation-menu> (issue #449): site nav with rich dropdown panels. Pins the nav
 * landmark (not a menu role), real <a> links, aria-expanded, click/keyboard open, Escape
 * close, and the intent-delay hover open / pointer-leave close.
 */
import { describe, test, expect, afterEach, vi } from "vitest";
import "../registry/components/navigation-menu/navigation-menu.js";

interface NavLink {
  label: string;
  href: string;
  description?: string;
  icon?: string;
}
interface NavItem {
  key: string;
  label: string;
  href?: string;
  links?: NavLink[];
}
type El = HTMLElement & {
  items: NavItem[];
  openDelay: number;
  closeDelay: number;
  updateComplete: Promise<unknown>;
};

const sample: NavItem[] = [
  {
    key: "products",
    label: "Products",
    links: [
      { label: "Analytics", href: "/analytics", description: "Track everything", icon: "eye" },
      { label: "Engagement", href: "/engagement" },
    ],
  },
  {
    key: "company",
    label: "Company",
    links: [{ label: "About", href: "/about" }],
  },
  { key: "docs", label: "Docs", href: "/docs" },
];

async function mount(items: NavItem[] = sample): Promise<El> {
  const el = document.createElement("lv-navigation-menu") as El;
  el.items = items;
  el.openDelay = 0;
  el.closeDelay = 0;
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}
function triggers(el: El): HTMLElement[] {
  return Array.from(el.querySelectorAll<HTMLElement>(".lv-nav__trigger"));
}
function openPanels(el: El): HTMLElement[] {
  return Array.from(el.querySelectorAll<HTMLElement>(".lv-nav__panel--open"));
}

afterEach(() => {
  document.body.innerHTML = "";
  vi.useRealTimers();
});

describe("lv-navigation-menu structure + ARIA", () => {
  test("renders into the light DOM (no shadow root)", async () => {
    const el = await mount();
    expect(el.shadowRoot).toBeNull();
  });

  test("the root is a nav landmark, NOT a menu role", async () => {
    const el = await mount();
    expect(el.querySelector("nav")).not.toBeNull();
    expect(el.querySelector('[role="menu"]')).toBeNull();
    expect(el.querySelector("nav")?.getAttribute("aria-label")).toBe("Main");
  });

  test("a plain item (no links) renders a bare anchor, not a trigger", async () => {
    const el = await mount();
    const docs = el.querySelector(".lv-nav__link") as HTMLAnchorElement;
    expect(docs.tagName).toBe("A");
    expect(docs.getAttribute("href")).toBe("/docs");
  });

  test("triggers advertise aria-expanded + aria-controls", async () => {
    const el = await mount();
    const t = triggers(el)[0];
    expect(t.getAttribute("aria-expanded")).toBe("false");
    expect(t.getAttribute("aria-controls")).toBeTruthy();
  });

  test("panel links are real anchors (browser navigation, open-in-new-tab works)", async () => {
    const el = await mount();
    triggers(el)[0].click();
    await el.updateComplete;
    const links = openPanels(el)[0].querySelectorAll("a");
    expect(links.length).toBe(2);
    expect((links[0] as HTMLAnchorElement).getAttribute("href")).toBe("/analytics");
  });

  test("link icons render as inline Lucide svg, never Font Awesome", async () => {
    const el = await mount();
    triggers(el)[0].click();
    await el.updateComplete;
    expect(el.querySelector(".lv-nav__item-icon svg")).not.toBeNull();
    expect(el.querySelector("i.fa, i.fas")).toBeNull();
  });
});

describe("lv-navigation-menu open / close", () => {
  test("clicking a trigger opens its panel and sets aria-expanded", async () => {
    const el = await mount();
    triggers(el)[0].click();
    await el.updateComplete;
    expect(openPanels(el).length).toBe(1);
    expect(triggers(el)[0].getAttribute("aria-expanded")).toBe("true");
  });

  test("only one panel is open at a time", async () => {
    const el = await mount();
    triggers(el)[0].click();
    await el.updateComplete;
    triggers(el)[1].click();
    await el.updateComplete;
    expect(openPanels(el).length).toBe(1);
    expect(triggers(el)[1].getAttribute("aria-expanded")).toBe("true");
  });

  test("ArrowDown on a trigger opens the panel and emits lv-open", async () => {
    const el = await mount();
    let opened = "";
    el.addEventListener("lv-open", (e) => (opened = (e as CustomEvent).detail.key));
    triggers(el)[0].dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true })
    );
    await el.updateComplete;
    expect(openPanels(el).length).toBe(1);
    expect(opened).toBe("products");
  });

  test("Escape closes the open panel and emits lv-close", async () => {
    const el = await mount();
    let closed = "";
    el.addEventListener("lv-close", (e) => (closed = (e as CustomEvent).detail.key));
    triggers(el)[0].click();
    await el.updateComplete;
    triggers(el)[0].dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })
    );
    await el.updateComplete;
    expect(openPanels(el).length).toBe(0);
    expect(closed).toBe("products");
  });

  test("ArrowRight/ArrowLeft move focus between triggers", async () => {
    const el = await mount();
    triggers(el)[0].focus();
    triggers(el)[0].dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, cancelable: true })
    );
    expect(document.activeElement).toBe(triggers(el)[1]);
  });

  test("a click outside closes the open panel", async () => {
    const el = await mount();
    triggers(el)[0].click();
    await el.updateComplete;
    document.body.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    await el.updateComplete;
    expect(openPanels(el).length).toBe(0);
  });
});

describe("lv-navigation-menu hover intent", () => {
  test("hover opens after the intent delay; it is not immediate", async () => {
    vi.useFakeTimers();
    const el = document.createElement("lv-navigation-menu") as El;
    el.items = sample;
    el.openDelay = 150;
    el.closeDelay = 200;
    document.body.appendChild(el);
    await el.updateComplete;
    const li = triggers(el)[0].closest("li") as HTMLElement;
    li.dispatchEvent(new MouseEvent("pointerenter", { bubbles: true }));
    await el.updateComplete;
    expect(openPanels(el).length).toBe(0); // still closed before the delay elapses
    vi.advanceTimersByTime(150);
    await el.updateComplete;
    expect(openPanels(el).length).toBe(1);
  });

  test("pointer-leave closes after the close delay", async () => {
    vi.useFakeTimers();
    const el = document.createElement("lv-navigation-menu") as El;
    el.items = sample;
    el.openDelay = 0;
    el.closeDelay = 200;
    document.body.appendChild(el);
    await el.updateComplete;
    const li = triggers(el)[0].closest("li") as HTMLElement;
    li.dispatchEvent(new MouseEvent("pointerenter", { bubbles: true }));
    vi.advanceTimersByTime(0);
    await el.updateComplete;
    expect(openPanels(el).length).toBe(1);
    li.dispatchEvent(new MouseEvent("pointerleave", { bubbles: true }));
    expect(openPanels(el).length).toBe(1); // still open before close delay
    vi.advanceTimersByTime(200);
    await el.updateComplete;
    expect(openPanels(el).length).toBe(0);
  });
});
