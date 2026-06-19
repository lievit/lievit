/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
import { describe, test, expect, afterEach } from "vitest";
import "../registry/components/dropdown-menu/dropdown-menu.js";

type LvDropdownEl = HTMLElement & {
  items: Array<{ key: string; label: string; disabled?: boolean; separator?: boolean }>;
  label: string;
  disabled: boolean;
  updateComplete: Promise<unknown>;
};

/**
 * Mount a slotted-nav `<lv-dropdown-menu>`: write the trigger + panel content as light-DOM
 * children FIRST, then connect, so firstUpdated() adopts them (the carousel pattern).
 */
async function mountSlotted(innerHTML: string): Promise<LvDropdownEl> {
  const el = document.createElement("lv-dropdown-menu") as LvDropdownEl;
  el.innerHTML = innerHTML;
  document.body.appendChild(el);
  await el.updateComplete;
  // adoptSlotted + the slotted-mode re-render happen across a microtask; settle twice.
  await el.updateComplete;
  await el.updateComplete;
  return el;
}

async function settle(el: LvDropdownEl) {
  await el.updateComplete;
}

const trigger = (el: HTMLElement) =>
  el.querySelector(".lv-dropdown__trigger") as HTMLButtonElement;
const panel = (el: HTMLElement) =>
  el.querySelector(".lv-dropdown__panel") as HTMLElement;
const navHtml = `
  <a href="/profile" id="lnk-profile">Profile</a>
  <a href="/settings" id="lnk-settings">Settings</a>
  <hr />
  <form method="post" action="/logout"><button type="submit" id="btn-logout">Log out</button></form>
`;

afterEach(() => {
  document.body.innerHTML = "";
});

describe("lv-dropdown-menu slotted-nav mode", () => {
  test("light DOM: no shadow root to pierce", async () => {
    const el = await mountSlotted(navHtml);
    expect(el.shadowRoot).toBeNull();
  });

  test("slotted <a href> items render as REAL anchors inside the panel", async () => {
    const el = await mountSlotted(navHtml);
    const anchors = panel(el).querySelectorAll("a[href]");
    expect(anchors.length).toBe(2);
    expect((anchors[0] as HTMLAnchorElement).getAttribute("href")).toBe("/profile");
    expect((anchors[1] as HTMLAnchorElement).getAttribute("href")).toBe("/settings");
  });

  test("real links survive JS-off: the anchors are genuine <a href> the browser navigates", async () => {
    const el = await mountSlotted(navHtml);
    const a = panel(el).querySelector("#lnk-profile") as HTMLAnchorElement;
    // a genuine anchor (not a JS-action button) -> works without the island's JS.
    expect(a.tagName).toBe("A");
    expect(a.hasAttribute("href")).toBe(true);
  });

  test("projected items get role=menuitem; the panel keeps role=menu", async () => {
    const el = await mountSlotted(navHtml);
    expect(panel(el).getAttribute("role")).toBe("menu");
    const items = panel(el).querySelectorAll('[role="menuitem"]');
    // two anchors + the logout submit button
    expect(items.length).toBe(3);
  });

  test("trigger advertises aria-haspopup=menu and starts collapsed", async () => {
    const el = await mountSlotted(navHtml);
    expect(trigger(el).getAttribute("aria-haspopup")).toBe("menu");
    expect(trigger(el).getAttribute("aria-expanded")).toBe("false");
  });

  test("slot=trigger content is adopted into the trigger button", async () => {
    const el = await mountSlotted(
      `<span slot="trigger" id="ada">Ada</span>${navHtml}`
    );
    expect(trigger(el).querySelector("#ada")).not.toBeNull();
    expect(trigger(el).textContent).toContain("Ada");
  });

  test("panel hidden by default, opens on trigger click, closes on second click", async () => {
    const el = await mountSlotted(navHtml);
    expect(el.querySelector(".lv-dropdown__panel--open")).toBeNull();
    trigger(el).click();
    await settle(el);
    expect(el.querySelector(".lv-dropdown__panel--open")).not.toBeNull();
    expect(trigger(el).getAttribute("aria-expanded")).toBe("true");
    trigger(el).click();
    await settle(el);
    expect(el.querySelector(".lv-dropdown__panel--open")).toBeNull();
  });

  test("Escape closes the open menu and returns focus to the trigger", async () => {
    const el = await mountSlotted(navHtml);
    trigger(el).click();
    await settle(el);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await settle(el);
    expect(el.querySelector(".lv-dropdown__panel--open")).toBeNull();
  });

  test("outside click closes the open menu", async () => {
    const el = await mountSlotted(navHtml);
    trigger(el).click();
    await settle(el);
    const outside = document.createElement("button");
    document.body.appendChild(outside);
    outside.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    await settle(el);
    expect(el.querySelector(".lv-dropdown__panel--open")).toBeNull();
  });

  test("opening focuses the first slotted link", async () => {
    const el = await mountSlotted(navHtml);
    trigger(el).click();
    await settle(el);
    expect(document.activeElement?.id).toBe("lnk-profile");
  });

  test("ArrowDown / ArrowUp roam over the slotted links; Home/End jump to ends", async () => {
    const el = await mountSlotted(navHtml);
    trigger(el).click();
    await settle(el);
    const p = panel(el);
    p.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    await settle(el);
    expect(document.activeElement?.id).toBe("lnk-settings");
    p.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }));
    await settle(el);
    expect(document.activeElement?.id).toBe("lnk-profile");
    p.dispatchEvent(new KeyboardEvent("keydown", { key: "End", bubbles: true }));
    await settle(el);
    expect(document.activeElement?.id).toBe("btn-logout");
    p.dispatchEvent(new KeyboardEvent("keydown", { key: "Home", bubbles: true }));
    await settle(el);
    expect(document.activeElement?.id).toBe("lnk-profile");
  });

  test("roving tabindex: only the active item is tabbable while open", async () => {
    const el = await mountSlotted(navHtml);
    trigger(el).click();
    await settle(el);
    const a1 = panel(el).querySelector("#lnk-profile") as HTMLAnchorElement;
    const a2 = panel(el).querySelector("#lnk-settings") as HTMLAnchorElement;
    expect(a1.tabIndex).toBe(0);
    expect(a2.tabIndex).toBe(-1);
  });

  test("Enter activates the focused link (clicks the real anchor) and closes", async () => {
    const el = await mountSlotted(navHtml);
    const a = el.querySelector("#lnk-profile") as HTMLAnchorElement;
    let clicked = false;
    a.addEventListener("click", (e) => {
      clicked = true;
      e.preventDefault(); // happy-dom: stop the jsdom navigation noise
    });
    trigger(el).click();
    await settle(el);
    panel(el).dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    await settle(el);
    expect(clicked).toBe(true);
    expect(el.querySelector(".lv-dropdown__panel--open")).toBeNull();
  });

  test("<hr> divider is adopted and styled as a separator", async () => {
    const el = await mountSlotted(navHtml);
    expect(panel(el).querySelector("hr")).not.toBeNull();
  });

  test("ArrowDown on the trigger opens the menu", async () => {
    const el = await mountSlotted(navHtml);
    trigger(el).dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    await settle(el);
    expect(el.querySelector(".lv-dropdown__panel--open")).not.toBeNull();
  });

  test("back-compat: with items and no slotted children, action mode still renders", async () => {
    const el = document.createElement("lv-dropdown-menu") as LvDropdownEl;
    el.items = [
      { key: "edit", label: "Edit" },
      { key: "copy", label: "Copy" },
    ];
    el.label = "Actions";
    document.body.appendChild(el);
    await el.updateComplete;
    await el.updateComplete;
    expect(trigger(el).textContent).toContain("Actions");
    trigger(el).click();
    await el.updateComplete;
    let detail: unknown;
    el.addEventListener("lv-select", (e) => { detail = (e as CustomEvent).detail; });
    (panel(el).querySelector('[role="menuitem"]') as HTMLButtonElement).click();
    await el.updateComplete;
    expect(detail).toBe("edit");
  });
});
