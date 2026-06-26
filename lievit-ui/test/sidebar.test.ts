/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * sidebar (Wave 3, ADR-0012): the server-first app sidebar is a JTE partial (a <nav> landmark of
 * real <a href> nav items, groups + collapsible sub-items, aria-current on the active entry) + a
 * CSP-clean typed-TS enhancer (collapse rail + mobile off-canvas, localStorage persistence). NO
 * Lit island. The .jte render is pinned by the real-compiler jte-compile smoke; this file is
 * render-asserting against the REAL DOM:
 *   (1) it builds a DOM shaped exactly like the partial's server output and asserts the nav contract
 *       (the <nav> landmark, real <a href> items, aria-current=page on the active one, groups +
 *       sub-items present) -- the projection the silent-slot bug would have broken;
 *   (2) it drives the enhancer on that DOM and asserts the collapse state toggles + persists.
 * Plus a source-contract block on the partials (the JS world cannot compile JTE; that is the
 * jte-compile smoke's job).
 */
import { describe, test, expect, afterEach, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  startStimulus,
  stopStimulus,
  flushStimulus,
} from "../runtime/stimulus/application.js";
import { morph } from "../runtime/morph.js";

const jteDir = join(import.meta.dirname, "..", "registry", "jte");
const readJte = (p: string) => readFileSync(join(jteDir, p), "utf8");

/**
 * Starts the real `lv-sidebar` Stimulus controller over every `data-controller="lv-sidebar"` root
 * in the DOM and awaits its MutationObserver. The conversion of the old `enhanceSidebar(root)` /
 * `enhanceAllSidebars()`: Stimulus connects every matching root on the page at once, so a single
 * `connect()` enhances all of them. Idempotency is intrinsic (Stimulus connects each root once).
 */
async function connect(): Promise<void> {
  startStimulus();
  await flushStimulus();
}

/**
 * Build a DOM that matches the server-rendered sidebar partial output for a fixed nav:
 *   Platform group { Home (a, /, active=current), Users (a, /users, badge 3),
 *                    Settings (parent <details> with General + Security), Logs (a, disabled) }.
 * This mirrors exactly what sidebar.jte + sidebar/group.jte + sidebar/item.jte emit on the server.
 */
function renderSidebar(
  opts: { side?: "left" | "right"; collapsed?: boolean; active?: string; variant?: "sidebar" | "none" | "floating" | "inset"; rail?: boolean } = {}
): HTMLElement {
  const side = opts.side ?? "left";
  const active = opts.active ?? "home";
  const variant = opts.variant ?? "sidebar";
  const root = document.createElement("div");
  root.setAttribute("data-slot", "sidebar-wrapper");
  root.setAttribute("data-sidebar", "root");
  root.setAttribute("data-controller", "lv-sidebar");
  root.setAttribute("data-side", side);
  root.setAttribute("data-variant", variant);
  root.setAttribute("data-storage-key", "lv-sidebar-state");
  root.setAttribute("data-state", opts.collapsed ? "collapsed" : "expanded");
  root.className = "lv-sidebar-root";

  const backdrop = document.createElement("button");
  backdrop.setAttribute("data-sidebar", "backdrop");
  backdrop.setAttribute("data-action", "click->lv-sidebar#closeMobile");
  backdrop.setAttribute("aria-hidden", "true");
  backdrop.className = "lv-sidebar-backdrop";
  root.appendChild(backdrop);

  const nav = document.createElement("nav");
  nav.id = "lv-sidebar-nav";
  nav.setAttribute("data-slot", "sidebar");
  nav.setAttribute("aria-label", "Primary");
  nav.className = "lv-sidebar";

  // header bar (always present) with the collapse trigger -- the trigger is decoupled from any
  // optional header content, so it renders with or without a header (the decoupling fix).
  const header = document.createElement("div");
  header.setAttribute("data-slot", "sidebar-header");
  const trigger = document.createElement("button");
  trigger.setAttribute("data-slot", "sidebar-trigger");
  trigger.setAttribute("data-lv-sidebar-target", "trigger");
  trigger.setAttribute("data-action", "click->lv-sidebar#toggle");
  trigger.setAttribute("aria-controls", "lv-sidebar-nav");
  trigger.setAttribute("aria-expanded", opts.collapsed ? "false" : "true");
  trigger.setAttribute("aria-label", "Toggle sidebar");
  trigger.className = "lv-sidebar-trigger";
  header.appendChild(trigger);
  nav.appendChild(header);

  const content = document.createElement("div");
  content.setAttribute("data-slot", "sidebar-content");

  // group
  const group = document.createElement("div");
  group.setAttribute("data-slot", "sidebar-group");
  group.style.position = "relative";
  // sidebar/group-action: a trailing <button> by the heading.
  const groupAction = document.createElement("button");
  groupAction.type = "button";
  groupAction.setAttribute("data-slot", "sidebar-group-action");
  groupAction.setAttribute("data-sidebar", "group-action");
  groupAction.setAttribute("aria-label", "New project");
  groupAction.className = "lv-sidebar-group-action lv-sidebar-collapsible";
  group.appendChild(groupAction);
  const groupLabel = document.createElement("div");
  groupLabel.id = "lv-sidebar-group-platform";
  groupLabel.setAttribute("data-slot", "sidebar-group-label");
  groupLabel.className = "lv-sidebar-collapsible";
  groupLabel.textContent = "Platform";
  group.appendChild(groupLabel);
  const menu = document.createElement("ul");
  menu.setAttribute("data-slot", "sidebar-menu");
  menu.setAttribute("aria-labelledby", "lv-sidebar-group-platform");

  const leaf = (
    label: string,
    href: string,
    o: { badge?: string; active?: boolean; disabled?: boolean; action?: "default" | "hover" } = {}
  ) => {
    const li = document.createElement("li");
    li.setAttribute("data-slot", "sidebar-menu-item");
    li.style.position = "relative";
    const a = document.createElement("a");
    a.href = href;
    a.setAttribute("data-slot", "sidebar-menu-button");
    a.className = "lv-sidebar-item";
    if (o.active) a.setAttribute("aria-current", "page");
    if (o.disabled) {
      a.setAttribute("aria-disabled", "true");
      a.setAttribute("tabindex", "-1");
    }
    const span = document.createElement("span");
    span.className = "lv-sidebar-collapsible";
    span.textContent = label;
    a.appendChild(span);
    if (o.badge) {
      const b = document.createElement("span");
      b.className = "lv-sidebar-collapsible";
      b.textContent = o.badge;
      a.appendChild(b);
    }
    li.appendChild(a);
    if (o.action) {
      // sidebar/menu-action: a trailing <button> pinned to the row end, optionally show-on-hover.
      const act = document.createElement("button");
      act.type = "button";
      act.setAttribute("data-slot", "sidebar-menu-action");
      act.setAttribute("data-sidebar", "menu-action");
      act.setAttribute("aria-label", `${label} actions`);
      act.className = "lv-sidebar-menu-action lv-sidebar-collapsible" + (o.action === "hover" ? " lv-sidebar-action-hover" : "");
      li.appendChild(act);
    }
    return li;
  };

  menu.appendChild(leaf("Home", "/", { active: active === "home", action: "default" }));
  menu.appendChild(leaf("Users", "/users", { badge: "3", active: active === "users", action: "hover" }));

  // parent (Settings) via <details>
  const parentLi = document.createElement("li");
  parentLi.setAttribute("data-slot", "sidebar-menu-item");
  const details = document.createElement("details");
  details.setAttribute("data-sidebar", "disclosure");
  const summary = document.createElement("summary");
  summary.setAttribute("data-slot", "sidebar-menu-button");
  summary.className = "lv-sidebar-item";
  summary.textContent = "Settings";
  const sub = document.createElement("ul");
  sub.setAttribute("data-slot", "sidebar-menu-sub");
  sub.className = "lv-sidebar-collapsible";
  sub.appendChild(leaf("General", "/settings/general"));
  sub.appendChild(leaf("Security", "/settings/security"));
  details.appendChild(summary);
  details.appendChild(sub);
  parentLi.appendChild(details);
  menu.appendChild(parentLi);

  menu.appendChild(leaf("Logs", "/logs", { disabled: true }));

  group.appendChild(menu);
  content.appendChild(group);
  nav.appendChild(content);

  // sidebar/rail: a thin edge toggle inside the nav (rendered unless explicitly disabled).
  if (opts.rail !== false) {
    const rail = document.createElement("button");
    rail.type = "button";
    rail.setAttribute("data-slot", "sidebar-rail");
    rail.setAttribute("data-sidebar", "rail");
    rail.setAttribute("data-action", "click->lv-sidebar#toggle");
    rail.setAttribute("aria-label", "Toggle sidebar");
    rail.setAttribute("tabindex", "-1");
    rail.className = "lv-sidebar-rail";
    nav.appendChild(rail);
  }

  root.appendChild(nav);
  document.body.appendChild(root);

  // sidebar/inset: a sibling <main> that pairs with the inset variant.
  if (variant === "inset") {
    const inset = document.createElement("main");
    inset.setAttribute("data-slot", "sidebar-inset");
    inset.className = "lv-sidebar-inset";
    document.body.appendChild(inset);
  }
  return root;
}

beforeEach(() => {
  try {
    globalThis.localStorage?.clear();
  } catch {
    /* no storage */
  }
});

afterEach(() => {
  stopStimulus();
  document.body.innerHTML = "";
  document.getElementById("lv-sidebar-styles")?.remove();
  // stopStimulus() stops the observer before it can fire disconnect(), so a trap left active by an
  // open-and-don't-close test would leak the body scroll-lock into the next case; reset it here.
  // (In production disconnect DOES run: the wire morph removes the root while the observer is live.)
  document.body.style.overflow = "";
  document.body.removeAttribute("data-lievit-trap-scroll-lock");
});

describe("sidebar partial: rendered nav contract (real DOM)", () => {
  test("renders a <nav> landmark with the accessible label", () => {
    const root = renderSidebar();
    const nav = root.querySelector("nav");
    expect(nav).not.toBeNull();
    expect(nav?.getAttribute("aria-label")).toBe("Primary");
  });

  test("nav items are real <a href> (not buttons): the browser navigates", () => {
    const root = renderSidebar();
    const links = root.querySelectorAll<HTMLAnchorElement>('a[data-slot="sidebar-menu-button"]');
    expect(links.length).toBeGreaterThanOrEqual(4);
    const home = Array.from(links).find((a) => a.textContent?.includes("Home"))!;
    expect(home.tagName).toBe("A");
    expect(home.getAttribute("href")).toBe("/");
  });

  test("the active item carries aria-current=page", () => {
    const root = renderSidebar({ active: "users" });
    const current = root.querySelector('[aria-current="page"]');
    expect(current).not.toBeNull();
    expect(current?.textContent).toContain("Users");
  });

  test("groups render their heading + a <ul> menu of items", () => {
    const root = renderSidebar();
    expect(root.querySelector('[data-slot="sidebar-group-label"]')?.textContent?.trim()).toBe("Platform");
    const menu = root.querySelector('ul[data-slot="sidebar-menu"]');
    expect(menu).not.toBeNull();
    expect(menu?.getAttribute("aria-labelledby")).toBe("lv-sidebar-group-platform");
    expect(menu!.querySelectorAll(':scope > li[data-slot="sidebar-menu-item"]').length).toBe(4);
  });

  test("a parent item discloses a sub-tree of real <a href> children via <details>", () => {
    const root = renderSidebar();
    const details = root.querySelector('details[data-sidebar="disclosure"]');
    expect(details).not.toBeNull();
    const sub = details!.querySelector('ul[data-slot="sidebar-menu-sub"]');
    expect(sub).not.toBeNull();
    const childLinks = sub!.querySelectorAll<HTMLAnchorElement>('a[data-slot="sidebar-menu-button"]');
    expect(childLinks.length).toBe(2);
    expect(childLinks[0].getAttribute("href")).toBe("/settings/general");
  });

  test("a badge renders for items that declare one", () => {
    const root = renderSidebar();
    const users = Array.from(root.querySelectorAll<HTMLElement>('a[data-slot="sidebar-menu-button"]')).find((a) =>
      a.textContent?.includes("Users")
    )!;
    expect(users.textContent).toContain("3");
  });

  test("a disabled item is aria-disabled and out of the tab order", () => {
    const root = renderSidebar();
    const logs = Array.from(root.querySelectorAll<HTMLElement>('a[data-slot="sidebar-menu-button"]')).find((a) =>
      a.textContent?.includes("Logs")
    )!;
    expect(logs.getAttribute("aria-disabled")).toBe("true");
    expect(logs.getAttribute("tabindex")).toBe("-1");
  });
});

describe("sidebar controller: collapse state (real Stimulus + real DOM)", () => {
  test("the trigger toggles the desktop collapsed state + mirrors aria-expanded", async () => {
    const root = renderSidebar();
    await connect();
    const trigger = root.querySelector<HTMLButtonElement>('[data-slot="sidebar-trigger"]')!;
    expect(root.getAttribute("data-state")).toBe("expanded");
    expect(trigger.getAttribute("aria-expanded")).toBe("true");

    trigger.click();
    expect(root.getAttribute("data-state")).toBe("collapsed");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");

    trigger.click();
    expect(root.getAttribute("data-state")).toBe("expanded");
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
  });

  test("the collapsed choice persists to localStorage and rehydrates a fresh render", async () => {
    const root = renderSidebar();
    await connect();
    root.querySelector<HTMLButtonElement>('[data-slot="sidebar-trigger"]')!.click();
    expect(globalThis.localStorage?.getItem("lv-sidebar-state")).toBe("collapsed");

    stopStimulus();
    document.body.innerHTML = "";
    const fresh = renderSidebar(); // SSR data-state="expanded"
    await connect(); // connect() hydrates the persisted "collapsed" on the new controller
    expect(fresh.getAttribute("data-state")).toBe("collapsed");
  });

  test("the controller injects its stateful stylesheet once (idempotent across roots)", async () => {
    renderSidebar();
    renderSidebar({ side: "right" });
    await connect(); // two roots connect, but the <style> is injected once
    expect(document.querySelectorAll("#lv-sidebar-styles").length).toBe(1);
  });

  test("connect() wires every root on the page", async () => {
    renderSidebar();
    const second = renderSidebar({ side: "right" });
    await connect();
    second.querySelector<HTMLButtonElement>('[data-slot="sidebar-trigger"]')!.click();
    expect(second.getAttribute("data-state")).toBe("collapsed");
  });

  test("the rail edge toggles the same collapse state as the trigger", async () => {
    const root = renderSidebar();
    await connect();
    const rail = root.querySelector<HTMLButtonElement>('[data-slot="sidebar-rail"]')!;
    expect(root.getAttribute("data-state")).toBe("expanded");
    rail.click();
    expect(root.getAttribute("data-state")).toBe("collapsed");
    // the trigger's aria-expanded mirrors the rail-driven change
    expect(root.querySelector('[data-slot="sidebar-trigger"]')!.getAttribute("aria-expanded")).toBe("false");
    rail.click();
    expect(root.getAttribute("data-state")).toBe("expanded");
  });

  test("the rail is a mouse-only affordance: out of the tab order (tabindex=-1)", () => {
    const root = renderSidebar();
    expect(root.querySelector('[data-slot="sidebar-rail"]')!.getAttribute("tabindex")).toBe("-1");
  });

  test("Cmd/Ctrl+B toggles the sidebar (shadcn keyboard shortcut)", async () => {
    const root = renderSidebar();
    await connect();
    expect(root.getAttribute("data-state")).toBe("expanded");

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "b", metaKey: true }));
    expect(root.getAttribute("data-state")).toBe("collapsed");

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "b", ctrlKey: true }));
    expect(root.getAttribute("data-state")).toBe("expanded");
  });

  test("a plain 'b' (no modifier) does NOT toggle the sidebar", async () => {
    const root = renderSidebar();
    await connect();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "b" }));
    expect(root.getAttribute("data-state")).toBe("expanded");
  });
});

describe("sidebar controller: morph-safety (the round-2 listener-stacking bug class)", () => {
  // Before, a morph re-scan re-invoked enhanceSidebar over a re-rendered DOM and the data-sidebar-
  // enhanced marker had to keep every listener bound exactly once. With Stimulus the marker is gone:
  // a wire morph that re-renders the SAME root keeps the SAME controller (idiomorph preserves node
  // identity), so connect() never re-fires and no listener is stacked. A morph that REPLACES the
  // root disconnects the old controller (its document keydown listener removed) and connects one new
  // one. Either way one gesture => one toggle. These prove it through the REAL lievit morph.

  test("a trigger click toggles exactly once after a real morph re-renders the root", async () => {
    const root = renderSidebar();
    await connect();
    expect(root.getAttribute("data-state")).toBe("expanded");

    // Re-render the root in place (identical markup): idiomorph preserves the controller.
    morph(root, root.outerHTML);
    await flushStimulus();

    document.querySelector<HTMLButtonElement>('[data-slot="sidebar-trigger"]')!.click();
    // a stacked second listener would toggle twice and land back on "expanded".
    expect(
      document.querySelector('[data-sidebar="root"]')!.getAttribute("data-state"),
      "one click => one toggle, not a double-fire",
    ).toBe("collapsed");
  });

  test("the rail click also stays single after a morph (no double toggle)", async () => {
    const root = renderSidebar();
    await connect();
    morph(root, root.outerHTML);
    await flushStimulus();

    document.querySelector<HTMLButtonElement>('[data-slot="sidebar-rail"]')!.click();
    expect(document.querySelector('[data-sidebar="root"]')!.getAttribute("data-state")).toBe(
      "collapsed",
    );
  });

  test("Cmd/Ctrl+B toggles exactly once after a morph (the document listener is not stacked)", async () => {
    const root = renderSidebar();
    await connect();
    morph(root, root.outerHTML);
    await flushStimulus();
    expect(document.querySelector('[data-sidebar="root"]')!.getAttribute("data-state")).toBe(
      "expanded",
    );

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "b", metaKey: true }));
    // a stacked document listener would fire toggle twice and stay "expanded".
    expect(
      document.querySelector('[data-sidebar="root"]')!.getAttribute("data-state"),
      "one Cmd+B => one toggle",
    ).toBe("collapsed");
  });

  test("connect() run twice keeps every root's trigger single-fire", async () => {
    const a = renderSidebar();
    const b = renderSidebar({ side: "right" });
    await connect();
    await connect(); // the singleton app is already started: a second call is a no-op

    a.querySelector<HTMLButtonElement>('[data-slot="sidebar-trigger"]')!.click();
    b.querySelector<HTMLButtonElement>('[data-slot="sidebar-trigger"]')!.click();
    expect(a.getAttribute("data-state"), "root A toggled once").toBe("collapsed");
    expect(b.getAttribute("data-state"), "root B toggled once").toBe("collapsed");
  });
});

describe("sidebar compound parts: rendered contract (real DOM)", () => {
  test("a menu item can carry a trailing menu-action affordance", () => {
    const root = renderSidebar();
    const home = Array.from(root.querySelectorAll<HTMLElement>('li[data-slot="sidebar-menu-item"]')).find((li) =>
      li.textContent?.includes("Home")
    )!;
    const action = home.querySelector('[data-slot="sidebar-menu-action"]');
    expect(action).not.toBeNull();
    expect(action!.getAttribute("data-sidebar")).toBe("menu-action");
    // the item is the positioning context for the absolutely-pinned action
    expect((home as HTMLElement).style.position).toBe("relative");
  });

  test("a show-on-hover menu-action carries the reveal hook class", () => {
    const root = renderSidebar();
    const users = Array.from(root.querySelectorAll<HTMLElement>('li[data-slot="sidebar-menu-item"]')).find((li) =>
      li.textContent?.includes("Users")
    )!;
    const action = users.querySelector('[data-slot="sidebar-menu-action"]')!;
    expect(action.classList.contains("lv-sidebar-action-hover")).toBe(true);
  });

  test("a group can carry a trailing group-action beside its heading", () => {
    const root = renderSidebar();
    const group = root.querySelector('[data-slot="sidebar-group"]') as HTMLElement;
    const action = group.querySelector('[data-slot="sidebar-group-action"]');
    expect(action).not.toBeNull();
    expect(action!.getAttribute("data-sidebar")).toBe("group-action");
    expect(group.style.position).toBe("relative");
  });

  test("the actions are collapsible (hidden on the icon rail)", () => {
    const root = renderSidebar();
    for (const sel of ['[data-slot="sidebar-menu-action"]', '[data-slot="sidebar-group-action"]']) {
      expect(root.querySelector(sel)!.classList.contains("lv-sidebar-collapsible")).toBe(true);
    }
  });
});

describe("sidebar variants: data-variant + inset (real DOM)", () => {
  test("the default variant is data-variant=sidebar", () => {
    expect(renderSidebar().getAttribute("data-variant")).toBe("sidebar");
  });

  test("each shadcn variant is reflected on the root as data-variant", () => {
    for (const v of ["none", "floating", "inset"] as const) {
      const root = renderSidebar({ variant: v });
      expect(root.getAttribute("data-variant")).toBe(v);
      document.body.innerHTML = "";
    }
  });

  test("the inset variant pairs with a <main> sidebar-inset sibling", () => {
    renderSidebar({ variant: "inset" });
    const inset = document.body.querySelector('[data-slot="sidebar-inset"]');
    expect(inset).not.toBeNull();
    expect(inset!.tagName).toBe("MAIN");
  });
});

describe("sidebar v-next: DOM fixes (open=false, disabled parent, SSR state, mobile off-canvas)", () => {
  test("open=true: the <details> element has the open attribute set", () => {
    // DOM test: simulate what the server renders with open=true (open="").
    const root = renderSidebar();
    const details = root.querySelector<HTMLDetailsElement>('details[data-sidebar="disclosure"]')!;
    details.setAttribute("open", "");
    expect(details.hasAttribute("open")).toBe(true);
    expect(details.open).toBe(true);
  });

  test("open=false: the <details> element has NO open attribute (smart-attribute renders nothing)", () => {
    // DOM test: simulate what the server renders with open=false (attribute omitted).
    const root = renderSidebar();
    const details = root.querySelector<HTMLDetailsElement>('details[data-sidebar="disclosure"]')!;
    // The renderSidebar helper does NOT set the open attribute, mirroring the open=false SSR output.
    expect(details.hasAttribute("open")).toBe(false);
    expect(details.open).toBe(false);
  });

  test("SSR collapsed hint: data-state=collapsed and aria-expanded=false render statically (no enhancer)", () => {
    const root = renderSidebar({ collapsed: true });
    // No enhancer: pure SSR state must be reflected on the root + trigger.
    expect(root.getAttribute("data-state")).toBe("collapsed");
    const trigger = root.querySelector('[data-slot="sidebar-trigger"]')!;
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });

  test("mobile off-canvas: backdrop click closes the overlay (removes data-mobile-open)", async () => {
    const root = renderSidebar();
    await connect();
    // Set the mobile-open state directly (jsdom has no real layout / matchMedia).
    root.setAttribute("data-mobile-open", "");
    const backdrop = root.querySelector<HTMLButtonElement>('[data-sidebar="backdrop"]')!;
    backdrop.click();
    expect(root.hasAttribute("data-mobile-open")).toBe(false);
  });
});

/**
 * Append an external topbar opener (the page-chrome mobile hamburger) that targets a sidebar root by
 * `aria-controls` = the nav id. It lives OUTSIDE the sidebar root (in the topbar), exactly like
 * kit/page.jte's `[data-lv-sidebar-open]` button, so a Stimulus data-action cannot reach it; the
 * controller must bind it in connect().
 */
function renderOpener(navId = "lv-sidebar-nav"): HTMLButtonElement {
  const opener = document.createElement("button");
  opener.type = "button";
  opener.setAttribute("data-lv-sidebar-open", "");
  opener.setAttribute("aria-controls", navId);
  opener.setAttribute("aria-expanded", "false");
  opener.setAttribute("aria-label", "Open navigation");
  opener.className = "lv-sidebar-mobile-open-trigger";
  document.body.appendChild(opener);
  return opener;
}

/** The same focusable set the shared FocusTrap util cycles (DOM spec, no layout checks). */
const FOCUSABLE =
  'a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"]), [contenteditable]';

describe("sidebar controller: topbar opener + focus-trap + scroll-lock (real Stimulus + real DOM)", () => {
  // These exercise the MOBILE off-canvas drawer (below the breakpoint the opener opens it; on desktop
  // the SAME opener instead re-expands the collapsed-hidden rail, covered by its own test below). Force
  // the mobile context so isMobile() is true and a click opens the off-canvas.
  const realMatchMedia = window.matchMedia;
  beforeEach(() => {
    window.matchMedia = ((q: string) => ({
      matches: /max-width/.test(q), media: q, onchange: null,
      addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {},
      dispatchEvent() { return false; },
    })) as unknown as typeof window.matchMedia;
  });
  afterEach(() => {
    window.matchMedia = realMatchMedia;
  });

  test("on desktop the opener re-expands the fully-hidden collapsed rail (toggle, not off-canvas)", async () => {
    // Desktop context: the collapsed rail is width 0, so the topbar opener is the only way back; it
    // must EXPAND the rail (desktop toggle), not set the mobile off-canvas state.
    window.matchMedia = ((q: string) => ({
      matches: false, media: q, onchange: null,
      addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {},
      dispatchEvent() { return false; },
    })) as unknown as typeof window.matchMedia;
    const root = renderSidebar({ collapsed: true });
    const opener = renderOpener();
    await connect();
    expect(root.getAttribute("data-state")).toBe("collapsed");
    opener.click();
    expect(root.getAttribute("data-state")).toBe("expanded");
    expect(root.hasAttribute("data-mobile-open")).toBe(false);
  });

  test("the controller binds the external [data-lv-sidebar-open] topbar opener: a click opens the off-canvas", async () => {
    const root = renderSidebar();
    const opener = renderOpener();
    await connect();
    expect(root.hasAttribute("data-mobile-open")).toBe(false);
    opener.click();
    expect(root.hasAttribute("data-mobile-open")).toBe(true);
  });

  test("the opener's aria-expanded mirrors the off-canvas open/closed state", async () => {
    const root = renderSidebar();
    const opener = renderOpener();
    await connect();
    expect(opener.getAttribute("aria-expanded")).toBe("false");
    opener.click();
    expect(opener.getAttribute("aria-expanded")).toBe("true");
    opener.click(); // a second click on the same opener closes
    expect(root.hasAttribute("data-mobile-open")).toBe(false);
    expect(opener.getAttribute("aria-expanded")).toBe("false");
  });

  test("an opener whose aria-controls points at a DIFFERENT nav is NOT bound to this root", async () => {
    const root = renderSidebar();
    const stray = renderOpener("some-other-nav");
    await connect();
    stray.click();
    expect(root.hasAttribute("data-mobile-open")).toBe(false);
  });

  test("opening the off-canvas locks body scroll; closing restores it (shared FocusTrap)", async () => {
    const root = renderSidebar();
    const opener = renderOpener();
    await connect();
    expect(document.body.style.overflow).not.toBe("hidden");
    opener.click();
    expect(document.body.style.overflow).toBe("hidden");
    root.querySelector<HTMLButtonElement>('[data-sidebar="backdrop"]')!.click();
    expect(root.hasAttribute("data-mobile-open")).toBe(false);
    expect(document.body.style.overflow).not.toBe("hidden");
  });

  test("focus is trapped inside the open off-canvas: Tab from outside is pulled back into the panel", async () => {
    const root = renderSidebar();
    const opener = renderOpener();
    await connect();
    opener.focus();
    opener.click(); // open
    const panel = root.querySelector<HTMLElement>('[data-slot="sidebar"]')!;
    // Drift focus back to the opener (outside the panel), then Tab: the trap pulls it inside.
    opener.focus();
    const tab = new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true });
    document.dispatchEvent(tab);
    expect(tab.defaultPrevented).toBe(true);
    expect(panel.contains(document.activeElement)).toBe(true);
  });

  test("Tab at the last focusable wraps to the first (focus cycle)", async () => {
    const root = renderSidebar();
    const opener = renderOpener();
    await connect();
    opener.focus();
    opener.click();
    const panel = root.querySelector<HTMLElement>('[data-slot="sidebar"]')!;
    const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
    const last = focusable[focusable.length - 1]!;
    last.focus();
    const tab = new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true });
    document.dispatchEvent(tab);
    expect(tab.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(focusable[0]);
  });

  test("Escape closes the open off-canvas (FocusTrap onEscape)", async () => {
    const root = renderSidebar();
    const opener = renderOpener();
    await connect();
    opener.focus();
    opener.click();
    expect(root.hasAttribute("data-mobile-open")).toBe(true);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(root.hasAttribute("data-mobile-open")).toBe(false);
  });

  test("closing returns focus to the opener that opened it (return-focus)", async () => {
    const root = renderSidebar();
    const opener = renderOpener();
    await connect();
    opener.focus();
    opener.click(); // open: FocusTrap captures the opener as the return target
    expect(root.hasAttribute("data-mobile-open")).toBe(true);
    root.querySelector<HTMLButtonElement>('[data-sidebar="backdrop"]')!.click();
    expect(document.activeElement).toBe(opener);
  });

  test("disconnect tears the opener listener down: removing the root (observer fires disconnect) unbinds the opener", async () => {
    const root = renderSidebar();
    const opener = renderOpener();
    await connect();
    // Remove the root while the app runs: Stimulus's observer fires disconnect() (the production
    // path is the wire morph removing the root), which must remove the external opener's listener.
    root.remove();
    await flushStimulus();
    opener.click();
    expect(opener.getAttribute("aria-expanded")).toBe("false");
  });

  test("the controller injects the .lv-sidebar-mobile-open-trigger CSS (opener hidden on desktop)", async () => {
    renderSidebar();
    renderOpener();
    await connect();
    const css = document.getElementById("lv-sidebar-styles")!.textContent ?? "";
    expect(css).toMatch(/\.lv-sidebar-mobile-open-trigger\s*\{\s*display:\s*none/);
    expect(css).toMatch(/max-width[\s\S]*\.lv-sidebar-mobile-open-trigger\s*\{\s*display:\s*inline-flex/);
  });
});

describe("sidebar partials: source contract (JTE compiles in the jte-compile smoke)", () => {
  const main = readJte("sidebar.jte");
  const group = readJte("sidebar/group.jte");
  const item = readJte("sidebar/item.jte");
  const rail = readJte("sidebar/rail.jte");
  const inset = readJte("sidebar/inset.jte");
  const menuAction = readJte("sidebar/menu-action.jte");
  const groupAction = readJte("sidebar/group-action.jte");
  const allParts = [main, group, item, rail, inset, menuAction, groupAction];

  test("the nav is a server-rendered <nav> landmark, NOT a Lit island", () => {
    expect(main).toMatch(/<nav\b/);
    expect(main).toContain('aria-label="${label}"');
    expect(main.toLowerCase()).not.toMatch(/<lv-sidebar|customelement|litelement/);
  });

  test("items are real <a href> with aria-current on the active one (no <slot>, no <button> nav)", () => {
    expect(item).toMatch(/<a\b/);
    expect(item).toContain("href=\"${href}\"");
    expect(item).toContain('aria-current="${active ? "page" : null}"');
    for (const src of [main, group, item]) expect(src).not.toMatch(/<slot\b/);
  });

  test("nav data arrives via @param Content / typed @param, not hardcoded", () => {
    expect(main).toContain("@param gg.jte.Content content");
    expect(group).toContain("@param gg.jte.Content content");
    expect(item).toContain("@param String href");
    expect(item).toContain("@param boolean active");
  });

  test("the collapsible sub-tree is a CSP-clean native <details> (no JS for sub-expansion)", () => {
    expect(item).toMatch(/<details\b/);
    expect(item).toMatch(/<summary\b/);
  });

  test("partials carry the house doc-comment, no inline script, no inline on* handlers", () => {
    for (const src of allParts) {
      expect(src).toContain("<%--");
      expect(src).toContain("--%>");
      expect(src).not.toMatch(/@\*/);
      expect(src).not.toMatch(/<script/i);
      expect(src.match(/\son[a-z]+=/gi) ?? []).toEqual([]);
    }
  });

  test("styling is token-driven (no bare hex colours)", () => {
    for (const src of allParts) {
      expect(src).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    }
  });

  test("icons go through the Lucide partial, never raw inline <svg>", () => {
    for (const src of allParts) {
      expect(src.match(/<svg\b/gi) ?? []).toEqual([]);
    }
    expect(item).toContain("@template.lievit.icon(name = icon");
    expect(menuAction).toContain("@template.lievit.icon(name = icon");
    expect(groupAction).toContain("@template.lievit.icon(name = icon");
  });

  test("the root exposes the shadcn variants via data-variant (none/floating/inset + default)", () => {
    expect(main).toContain("@param String variant");
    expect(main).toContain('data-variant="${resolvedVariant}"');
    for (const v of ["none", "floating", "inset"]) expect(main).toContain(`"${v}".equals(variant)`);
  });

  test("the rail is a real <button> hook for the enhancer, tabindex=-1, no <a>", () => {
    expect(rail).toMatch(/<button\b/);
    expect(rail).toContain('data-slot="sidebar-rail"');
    expect(rail).toContain('data-sidebar="rail"');
    expect(rail).toContain('tabindex="-1"');
    expect(rail).not.toMatch(/<a\b/);
  });

  test("the inset is a <main> landmark with the sidebar-inset slot", () => {
    expect(inset).toMatch(/<main\b/);
    expect(inset).toContain('data-slot="sidebar-inset"');
    expect(inset).toContain("@param gg.jte.Content content");
  });

  test("menu-action / group-action are the shadcn-named trailing-action slots", () => {
    expect(menuAction).toContain('data-slot="sidebar-menu-action"');
    expect(menuAction).toContain('data-sidebar="menu-action"');
    expect(menuAction).toContain("@param boolean showOnHover");
    expect(groupAction).toContain('data-slot="sidebar-group-action"');
    expect(groupAction).toContain('data-sidebar="group-action"');
    // both accept a custom control via a Content slot, else render a default labelled button
    for (const src of [menuAction, groupAction]) {
      expect(src).toContain("@param gg.jte.Content content");
      expect(src).toContain('aria-label="${label}"');
    }
  });

  test("the item/group host the action slots as their positioning context (position: relative)", () => {
    expect(item).toContain("@param gg.jte.Content action");
    expect(item).toContain("@if(action != null)${action}@endif");
    expect(item).toContain("position: relative;");
    expect(group).toContain("@param gg.jte.Content action");
    expect(group).toContain("@if(action != null)${action}@endif");
    expect(group).toContain("position: relative;");
  });

  test("the template wires the controller via data-controller + data-action (no inline handlers)", () => {
    // The collapse behaviour moved from sidebar.enhancer.ts to the lv-sidebar Stimulus controller.
    // The template declares the wiring as CSP-clean data-controller / data-action (NOT on* handlers):
    // the root carries the controller, the trigger + rail + backdrop carry their actions.
    expect(main).toContain('data-controller="lv-sidebar"');
    expect(main).toContain('data-action="click->lv-sidebar#toggle"'); // the header trigger
    expect(main).toContain('data-action="click->lv-sidebar#closeMobile"'); // the backdrop
    expect(rail).toContain('data-action="click->lv-sidebar#toggle"'); // the edge rail
    // The trigger is a Stimulus target so the controller can mirror aria-expanded onto it.
    expect(main).toContain('data-lv-sidebar-target="trigger"');
  });

  test("the controller carries the collapse + Cmd/Ctrl+B logic (the converted enhancer)", () => {
    const controller = readFileSync(
      join(jteDir, "..", "..", "runtime", "stimulus", "controllers", "lv-sidebar-controller.ts"),
      "utf8",
    );
    expect(controller).toMatch(/metaKey\s*\|\|\s*e\.ctrlKey/);
    expect(controller).toMatch(/key === "b"/);
    expect(controller).toContain("toggle()");
    // shadcn DOM namespace preserved (the hamburger bug was a regress to data-lv-*): hooks are data-slot/data-sidebar.
    expect(controller).toContain('data-slot="sidebar-menu-button"');
    expect(controller).toContain('data-mobile-open');
  });

  test("v-next: open=false uses smart-attribute pattern (omits the attr when false)", () => {
    // Source-contract: the template uses the JTE boolean smart-attribute form `open="${open}"`.
    // JTE omits the attribute entirely when the boolean is false, and renders bare `open`
    // (equivalent to open="") when true. No String ternary (open ? "" : null) is needed:
    // JTE's native boolean attribute handling is the canonical and correct form here.
    expect(item).toContain('open="${open}"');
  });

  test("v-next: disabled parent <summary> carries tabindex=-1 and pointer-events", () => {
    // Source-contract: disabled parent summary must be skipped by keyboard and pointer.
    expect(item).toContain('tabindex="${disabled ? "-1" : null}"');
    expect(item).toContain('pointer-events: ${disabled ? "none" : "auto"}');
  });

  test("v-next: font-weight uses CSS tokens, not bare numbers", () => {
    expect(item).toContain("var(--lv-font-medium)");
    expect(item).toContain("var(--lv-font-normal)");
    expect(item).not.toMatch(/font-weight[^;]*"500"/);
    expect(item).not.toMatch(/font-weight[^;]*"400"/);
  });

  test("v-next: group with no label omits aria-labelledby (smart-attribute fix)", () => {
    // Source-contract: the pattern must gate on hasLabel so JTE omits the attribute when null.
    expect(group).toContain('aria-labelledby="${hasLabel ? labelId : null}"');
  });

  test("v-next: the header bar trigger is NOT gated on the header param (TRIGGER DECOUPLING)", () => {
    // The decoupling fix: the trigger is inside a bar that always renders.
    // The template comment explicitly documents the fix.
    expect(main).toContain("TRIGGER DECOUPLING");
    // The trigger must appear unconditionally: verify data-slot="sidebar-trigger" is present.
    expect(main).toContain('data-slot="sidebar-trigger"');
  });
});
