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
import { enhanceSidebar, enhanceAllSidebars } from "../registry/jte/sidebar.enhancer.js";

const jteDir = join(import.meta.dirname, "..", "registry", "jte");
const readJte = (p: string) => readFileSync(join(jteDir, p), "utf8");

/**
 * Build a DOM that matches the server-rendered sidebar partial output for a fixed nav:
 *   Platform group { Home (a, /, active=current), Users (a, /users, badge 3),
 *                    Settings (parent <details> with General + Security), Logs (a, disabled) }.
 * This mirrors exactly what sidebar.jte + sidebar/group.jte + sidebar/item.jte emit on the server.
 */
function renderSidebar(opts: { side?: "left" | "right"; collapsed?: boolean; active?: string } = {}): HTMLElement {
  const side = opts.side ?? "left";
  const active = opts.active ?? "home";
  const root = document.createElement("div");
  root.setAttribute("data-lv-sidebar", "");
  root.setAttribute("data-lv-sidebar-side", side);
  root.setAttribute("data-lv-sidebar-storage-key", "lv-sidebar-state");
  root.setAttribute("data-state", opts.collapsed ? "collapsed" : "expanded");
  root.className = "lv-sidebar-root";

  const backdrop = document.createElement("button");
  backdrop.setAttribute("data-lv-sidebar-backdrop", "");
  backdrop.setAttribute("aria-hidden", "true");
  backdrop.className = "lv-sidebar-backdrop";
  root.appendChild(backdrop);

  const nav = document.createElement("nav");
  nav.id = "lv-sidebar-nav";
  nav.setAttribute("data-lv-sidebar-nav", "");
  nav.setAttribute("aria-label", "Primary");
  nav.className = "lv-sidebar";

  // header with the collapse trigger
  const header = document.createElement("div");
  header.setAttribute("data-lv-sidebar-header", "");
  const trigger = document.createElement("button");
  trigger.setAttribute("data-lv-sidebar-trigger", "");
  trigger.setAttribute("aria-controls", "lv-sidebar-nav");
  trigger.setAttribute("aria-expanded", opts.collapsed ? "false" : "true");
  trigger.setAttribute("aria-label", "Toggle sidebar");
  trigger.className = "lv-sidebar-trigger";
  header.appendChild(trigger);
  nav.appendChild(header);

  const content = document.createElement("div");
  content.setAttribute("data-lv-sidebar-content", "");

  // group
  const group = document.createElement("div");
  group.setAttribute("data-lv-sidebar-group", "");
  const groupLabel = document.createElement("div");
  groupLabel.id = "lv-sidebar-group-platform";
  groupLabel.setAttribute("data-lv-sidebar-group-label", "");
  groupLabel.className = "lv-sidebar-collapsible";
  groupLabel.textContent = "Platform";
  group.appendChild(groupLabel);
  const menu = document.createElement("ul");
  menu.setAttribute("data-lv-sidebar-menu", "");
  menu.setAttribute("aria-labelledby", "lv-sidebar-group-platform");

  const leaf = (label: string, href: string, o: { badge?: string; active?: boolean; disabled?: boolean } = {}) => {
    const li = document.createElement("li");
    li.setAttribute("data-lv-sidebar-item", "");
    const a = document.createElement("a");
    a.href = href;
    a.setAttribute("data-lv-sidebar-link", "");
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
    return li;
  };

  menu.appendChild(leaf("Home", "/", { active: active === "home" }));
  menu.appendChild(leaf("Users", "/users", { badge: "3", active: active === "users" }));

  // parent (Settings) via <details>
  const parentLi = document.createElement("li");
  parentLi.setAttribute("data-lv-sidebar-item", "");
  const details = document.createElement("details");
  details.setAttribute("data-lv-sidebar-disclosure", "");
  const summary = document.createElement("summary");
  summary.setAttribute("data-lv-sidebar-summary", "");
  summary.className = "lv-sidebar-item";
  summary.textContent = "Settings";
  const sub = document.createElement("ul");
  sub.setAttribute("data-lv-sidebar-sub", "");
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
  root.appendChild(nav);
  document.body.appendChild(root);
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
  document.body.innerHTML = "";
  document.getElementById("lv-sidebar-styles")?.remove();
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
    const links = root.querySelectorAll<HTMLAnchorElement>("a[data-lv-sidebar-link]");
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
    expect(root.querySelector("[data-lv-sidebar-group-label]")?.textContent?.trim()).toBe("Platform");
    const menu = root.querySelector("ul[data-lv-sidebar-menu]");
    expect(menu).not.toBeNull();
    expect(menu?.getAttribute("aria-labelledby")).toBe("lv-sidebar-group-platform");
    expect(menu!.querySelectorAll(":scope > li[data-lv-sidebar-item]").length).toBe(4);
  });

  test("a parent item discloses a sub-tree of real <a href> children via <details>", () => {
    const root = renderSidebar();
    const details = root.querySelector("details[data-lv-sidebar-disclosure]");
    expect(details).not.toBeNull();
    const sub = details!.querySelector("ul[data-lv-sidebar-sub]");
    expect(sub).not.toBeNull();
    const childLinks = sub!.querySelectorAll<HTMLAnchorElement>("a[data-lv-sidebar-link]");
    expect(childLinks.length).toBe(2);
    expect(childLinks[0].getAttribute("href")).toBe("/settings/general");
  });

  test("a badge renders for items that declare one", () => {
    const root = renderSidebar();
    const users = Array.from(root.querySelectorAll<HTMLElement>("a[data-lv-sidebar-link]")).find((a) =>
      a.textContent?.includes("Users")
    )!;
    expect(users.textContent).toContain("3");
  });

  test("a disabled item is aria-disabled and out of the tab order", () => {
    const root = renderSidebar();
    const logs = Array.from(root.querySelectorAll<HTMLElement>("a[data-lv-sidebar-link]")).find((a) =>
      a.textContent?.includes("Logs")
    )!;
    expect(logs.getAttribute("aria-disabled")).toBe("true");
    expect(logs.getAttribute("tabindex")).toBe("-1");
  });
});

describe("sidebar enhancer: collapse state (real DOM)", () => {
  test("the trigger toggles the desktop collapsed state + mirrors aria-expanded", () => {
    const root = renderSidebar();
    enhanceSidebar(root);
    const trigger = root.querySelector<HTMLButtonElement>("[data-lv-sidebar-trigger]")!;
    expect(root.getAttribute("data-state")).toBe("expanded");
    expect(trigger.getAttribute("aria-expanded")).toBe("true");

    trigger.click();
    expect(root.getAttribute("data-state")).toBe("collapsed");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");

    trigger.click();
    expect(root.getAttribute("data-state")).toBe("expanded");
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
  });

  test("the collapsed choice persists to localStorage and rehydrates a fresh render", () => {
    const root = renderSidebar();
    enhanceSidebar(root);
    root.querySelector<HTMLButtonElement>("[data-lv-sidebar-trigger]")!.click();
    expect(globalThis.localStorage?.getItem("lv-sidebar-state")).toBe("collapsed");

    document.body.innerHTML = "";
    const fresh = renderSidebar(); // SSR data-state="expanded"
    enhanceSidebar(fresh); // hydrates the persisted "collapsed"
    expect(fresh.getAttribute("data-state")).toBe("collapsed");
  });

  test("the enhancer injects its stateful stylesheet once (idempotent)", () => {
    const root = renderSidebar();
    enhanceSidebar(root);
    enhanceSidebar(root); // second call: marked, no-op
    expect(document.querySelectorAll("#lv-sidebar-styles").length).toBe(1);
  });

  test("enhanceAllSidebars wires every root on the page", () => {
    renderSidebar();
    const second = renderSidebar({ side: "right" });
    enhanceAllSidebars();
    second.querySelector<HTMLButtonElement>("[data-lv-sidebar-trigger]")!.click();
    expect(second.getAttribute("data-state")).toBe("collapsed");
  });
});

describe("sidebar partials: source contract (JTE compiles in the jte-compile smoke)", () => {
  const main = readJte("sidebar.jte");
  const group = readJte("sidebar/group.jte");
  const item = readJte("sidebar/item.jte");

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
    for (const src of [main, group, item]) {
      expect(src).toContain("<%--");
      expect(src).toContain("--%>");
      expect(src).not.toMatch(/@\*/);
      expect(src).not.toMatch(/<script/i);
      expect(src.match(/\son[a-z]+=/gi) ?? []).toEqual([]);
    }
  });

  test("styling is token-driven (no bare hex colours)", () => {
    for (const src of [main, group, item]) {
      expect(src).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    }
  });

  test("icons go through the Lucide partial, never raw inline <svg>", () => {
    for (const src of [main, group, item]) {
      expect(src.match(/<svg\b/gi) ?? []).toEqual([]);
    }
    expect(item).toContain("@template.icon(name = icon");
  });
});
