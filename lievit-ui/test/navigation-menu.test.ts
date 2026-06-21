/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * navigation-menu (issue #449) is now a server-first JTE PARTIAL family (ADR-0012, Wave 2): the
 * Lit island is gone. A navigation menu has no client state worth holding server-side -- the
 * links are real <a href> (the browser navigates), which entry is current is a fact the server
 * already knows (passed as the `active` flag -> aria-current), and the panel reveal is pure CSS
 * (:hover / :focus-within). So it is a `registry:jte` partial, not a wire component. This test
 * pins the registry shape + the server-purity / structure of the source; the real-compiler
 * render gate is test/jte-compile (precompiles every registry/jte/**, the render-asserting
 * backstop for a partial that has no JVM Java component).
 */
import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildRegistry } from "../cli/build-registry.js";
import { resolve } from "../cli/registry.js";
import type { Registry } from "../cli/registry.js";

const registryRoot = join(import.meta.dirname, "..", "registry");
const registry: Registry = buildRegistry(registryRoot);
const read = (rel: string) => readFileSync(join(registryRoot, rel), "utf8");
// the markup of a partial, with its <%-- --%> doc-comment stripped (the prose names role="menu"
// / @floating-ui to explain their ABSENCE, which would trip a raw source match).
const markup = (rel: string) => read(rel).replace(/<%--[\s\S]*?--%>/g, "");

const SHELL = "jte/navigation-menu.jte";
const LINK = "jte/navigation-menu/link.jte";
const MENU = "jte/navigation-menu/menu.jte";
const ALL = [SHELL, LINK, MENU] as const;

describe("navigation-menu registry:jte item shape", () => {
  test("navigation-menu is a single registry:jte item (the Lit island is gone)", () => {
    const matches = registry.items.filter((i) => i.name === "navigation-menu");
    expect(matches, "exactly one navigation-menu item").toHaveLength(1);
    expect(matches[0].type).toBe("registry:jte");
  });

  test("it ships the shell + the link + the menu (trigger/panel) sub-partials, all jte root", () => {
    const item = registry.items.find((i) => i.name === "navigation-menu")!;
    const targets = item.files.map((f) => f.target).sort();
    expect(targets).toEqual([
      "lievit/navigation-menu.jte",
      "lievit/navigation-menu/link.jte",
      "lievit/navigation-menu/menu.jte",
    ]);
    expect(item.files.every((f) => f.root === "jte")).toBe(true);
  });

  test("resolving the partial pulls its tokens + icon partial dependencies", () => {
    const closure = resolve(registry, ["navigation-menu"]).map((i) => i.name);
    expect(closure).toContain("navigation-menu");
    expect(closure).toContain("tokens");
    expect(closure).toContain("icon");
  });
});

describe("navigation-menu partials: house rules", () => {
  test.each(ALL)("%s never ships an inline <script> (CSP)", (f) => {
    expect(read(f)).not.toMatch(/<script/i);
  });

  test.each(ALL)("%s uses JTE comment syntax <%-- --%>, not @* *@", (f) => {
    expect(read(f)).not.toMatch(/@\*/);
  });

  test.each(ALL)("%s never carries an inline on* handler (CSP)", (f) => {
    // a strict CSP drops inline handlers silently (the bug the pivot exists to kill).
    expect(read(f)).not.toMatch(/\son[a-z]+=/);
  });
});

describe("navigation-menu structure + ARIA (server-rendered source)", () => {
  test("the root is a <nav> landmark, NOT a menu role", () => {
    const shell = markup(SHELL);
    expect(shell).toContain("<nav");
    expect(shell).toContain('aria-label="${label}"');
    expect(shell).not.toMatch(/role="menu"/);
  });

  test("a plain entry renders a real <a href> with aria-current on the active one", () => {
    const link = markup(LINK);
    expect(link).toContain('href="${href}"');
    expect(link).toContain('aria-current="${active ? "page" : null}"');
    // real anchors: browser navigation, open-in-new-tab works (no JS handler).
    expect(link).toContain("<a");
  });

  test("a menu entry is a button[aria-haspopup][aria-controls] over a region of real links", () => {
    const menu = markup(MENU);
    expect(menu).toContain("<button");
    expect(menu).toContain('aria-haspopup="true"');
    expect(menu).toContain('aria-controls="${panelId}"');
    expect(menu).toContain('role="region"');
    // ARIA bug fix: a CSS-only :hover/:focus-within reveal has no JS to keep aria-expanded in sync,
    // so a frozen SSR aria-expanded would LIE to AT (claim collapsed while the panel is open). It is
    // dropped; aria-haspopup + aria-controls remain. The platform exposes the links via focus order.
    expect(menu).not.toContain("aria-expanded");
    // the content panel carries the shadcn data-slot contract (was navigation-menu-panel).
    expect(menu).toContain('data-slot="navigation-menu-content"');
    // the z-index uses the popover token, never a hardcoded value.
    expect(menu).toContain("z-index: var(--lv-z-popover)");
    expect(menu).not.toContain("9300");
    // the panel reveal is pure CSS group-hover / group-focus-within, no JS, no @floating-ui.
    expect(menu).toContain("group-hover:block");
    expect(menu).toContain("group-focus-within:block");
    expect(menu).not.toMatch(/@floating-ui\/dom/);
  });
});
