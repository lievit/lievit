/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * context-menu v-next: re-forged as an UNCONTROLLED PARTIAL (registry:jte).
 * The open state is managed client-side by context-menu-trigger.enhancer.ts;
 * keyboard roving is delegated to the shared collection-nav.enhancer.ts.
 *
 * These tests pin:
 *   A. Registry shape: context-menu is now a registry:jte partial, not a registry:wire.
 *   B. Source-text assertions on the JTE markup (panel absent when open=false; correct ARIA
 *      roles; data-slot contracts; smart-attribute escaping; no dev.lievit import; no inline
 *      script / on* handler; data-lievit-collection on the panel for collection-nav handoff).
 *   C. Trigger enhancer unit tests: right-click interception, coordinate attributes, keyboard
 *      open (ContextMenu key / Shift+F10), outside-click dismiss, Escape dismiss, focus restore,
 *      idempotency (no double-wire), teardown hygiene.
 *
 * Substrate: happy-dom (real DOM, real KeyboardEvent / MouseEvent).
 * NOTE: these tests run against the TS source of the enhancer, NOT a mocked runtime.
 * The JTE compile + render gate is the coordinator-run per-wave gate (not run here).
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { installContextMenuTrigger } from "../runtime/features/context-menu-trigger.enhancer.js";

const root = join(import.meta.dirname, "..");

const readJte = (rel: string): string =>
  readFileSync(join(root, "registry/jte", rel), "utf8");

const readFeature = (rel: string): string =>
  readFileSync(join(root, "runtime/features", rel), "utf8");

// ============================================================================
// A. Registry shape
// ============================================================================

describe("context-menu registry:jte shape", () => {
  test("meta.json declares type registry:jte (not registry:wire)", () => {
    const meta = JSON.parse(
      readFileSync(join(root, "registry/jte/context-menu/meta.json"), "utf8"),
    ) as { type: string; files: Array<{ path: string; root?: string }> };
    expect(meta.type).toBe("registry:jte");
  });

  test("meta.json files list includes the main .jte with root:jte", () => {
    const meta = JSON.parse(
      readFileSync(join(root, "registry/jte/context-menu/meta.json"), "utf8"),
    ) as { files: Array<{ path: string; root?: string }> };
    const mainJte = meta.files.find((f) => f.path === "jte/context-menu.jte");
    expect(mainJte).toBeDefined();
    expect(mainJte?.root).toBe("jte");
  });

  test("meta.json files list includes item, separator, group sub-partials", () => {
    const meta = JSON.parse(
      readFileSync(join(root, "registry/jte/context-menu/meta.json"), "utf8"),
    ) as { files: Array<{ path: string }> };
    const paths = meta.files.map((f) => f.path);
    expect(paths).toContain("jte/context-menu/item.jte");
    expect(paths).toContain("jte/context-menu/separator.jte");
    expect(paths).toContain("jte/context-menu/group.jte");
  });

  test("meta.json files list includes context-menu.css", () => {
    const meta = JSON.parse(
      readFileSync(join(root, "registry/jte/context-menu/meta.json"), "utf8"),
    ) as { files: Array<{ path: string }> };
    const paths = meta.files.map((f) => f.path);
    expect(paths).toContain("jte/context-menu.css");
  });
});

// ============================================================================
// B. JTE source-text assertions (no dev.lievit import; correct ARIA; data-slot)
// ============================================================================

describe("context-menu.jte source-text (CSP + ARIA + no-import contract)", () => {
  const jte = readJte("context-menu.jte");
  // Strip JTE doc-comment before asserting (preserve body assertions only).
  const body = jte.replace(/<%--[\s\S]*?--%>/g, "");

  test("no dev.lievit import (JTE classpath only has JDK + jte + icons)", () => {
    expect(jte).not.toMatch(/@import\s+dev\.lievit/);
  });

  test("no _component / _instance / _componentSnapshot params (this is a PARTIAL)", () => {
    expect(jte).not.toMatch(/@param.*_component/);
    expect(jte).not.toMatch(/@param.*_instance/);
    expect(jte).not.toMatch(/@param.*_componentSnapshot/);
  });

  test("no inline <script> tag or on* handler (CSP-clean)", () => {
    expect(body).not.toMatch(/<script/i);
    expect(body).not.toMatch(/\bon\w+\s*=/);
  });

  test("no inline style that carries computed logic (position via CSS attr, not inline style)", () => {
    // The template may emit style= for structural layout (position:fixed; top:0; left:0) but must
    // NOT compute the x/y coordinates inline.
    expect(body).not.toMatch(/style="[^"]*clientX|style="[^"]*clientY|left:\s*\$\{x\}|top:\s*\$\{y\}/);
  });

  test("data-slot=context-menu on the root wrapper", () => {
    expect(body).toContain('data-slot="context-menu"');
  });

  test("trigger wrapper has data-slot=context-menu-trigger", () => {
    expect(body).toContain('data-slot="context-menu-trigger"');
  });

  test("panel has role=menu aria-orientation=vertical tabindex=-1", () => {
    expect(body).toContain('role="menu"');
    expect(body).toContain('aria-orientation="vertical"');
    expect(body).toContain('tabindex="-1"');
  });

  test("panel is wrapped in @if(open) so it is ABSENT when open=false", () => {
    expect(jte).toContain("@if(open)");
  });

  test("panel carries data-lievit-collection for collection-nav handoff", () => {
    expect(body).toContain("data-lievit-collection");
  });

  test("panel carries data-lievit-collection-escape-action for Escape-to-close", () => {
    expect(body).toContain("data-lievit-collection-escape-action");
  });

  test("panel carries data-lievit-collection-wrap=true (wraps at ends)", () => {
    expect(body).toContain('data-lievit-collection-wrap="true"');
  });

  test("panel has aria-label and aria-labelledby params (accessible name)", () => {
    expect(jte).toContain("@param String ariaLabel");
    expect(jte).toContain("@param String ariaLabelledby");
  });

  test("data-size attribute propagated to panel for CSS size variant", () => {
    expect(body).toContain("data-size=");
  });

  test("no nested JTE comment (would close the outer doc-comment early)", () => {
    // The doc-comment block is the FIRST occurrence of --%>; after that there must be no --%>.
    const firstClose = jte.indexOf("--%>");
    const bodyAfterComment = jte.slice(firstClose + 4);
    expect(bodyAfterComment).not.toContain("--%>");
  });
});

describe("context-menu/item.jte source-text (ARIA roles + escaping contract)", () => {
  const jte = readJte("context-menu/item.jte");
  const body = jte.replace(/<%--[\s\S]*?--%>/g, "");

  test("no dev.lievit import", () => {
    expect(jte).not.toMatch(/@import\s+dev\.lievit/);
  });

  test("uses Escape.htmlAttribute for wireArgs (SAFE channel, not attrs)", () => {
    expect(jte).toContain("Escape.htmlAttribute");
  });

  test("role computed from type param (menuitem / menuitemcheckbox / menuitemradio)", () => {
    expect(jte).toContain("menuitemcheckbox");
    expect(jte).toContain("menuitemradio");
    expect(jte).toContain("menuitem");
  });

  test("aria-checked emitted for checkbox and radio items", () => {
    expect(body).toContain("aria-checked");
  });

  test("aria-disabled emitted for disabled items (item stays in a11y tree)", () => {
    expect(body).toContain("aria-disabled");
  });

  test("aria-haspopup and aria-expanded emitted for submenu items", () => {
    expect(body).toContain("aria-haspopup");
    expect(body).toContain("aria-expanded");
  });

  test("aria-keyshortcuts emitted when shortcut param is present", () => {
    expect(body).toContain("aria-keyshortcuts");
  });

  test("data-slot=context-menu-item on item elements", () => {
    expect(body).toContain('data-slot="context-menu-item"');
  });

  test("data-lievit-item on item elements (collection-nav item registration)", () => {
    expect(body).toContain("data-lievit-item");
  });

  test("data-danger and data-variant=destructive emitted for destructive items", () => {
    expect(body).toContain("data-danger");
    expect(body).toContain("data-variant");
  });

  test("no inline script or on* handler", () => {
    expect(body).not.toMatch(/<script/i);
    expect(body).not.toMatch(/\bon\w+\s*=/);
  });
});

describe("context-menu/separator.jte source-text", () => {
  const jte = readJte("context-menu/separator.jte");

  test("renders role=separator", () => {
    expect(jte).toContain('role="separator"');
  });

  test("data-slot=context-menu-separator", () => {
    expect(jte).toContain('data-slot="context-menu-separator"');
  });
});

describe("context-menu/group.jte source-text", () => {
  const jte = readJte("context-menu/group.jte");
  const body = jte.replace(/<%--[\s\S]*?--%>/g, "");

  test("renders role=group", () => {
    expect(body).toContain('role="group"');
  });

  test("aria-labelledby on the group wrapper", () => {
    expect(body).toContain("aria-labelledby");
  });

  test("group header has role=presentation (visual label, not a menu item)", () => {
    expect(body).toContain('role="presentation"');
  });

  test("data-slot=context-menu-group on the wrapper", () => {
    expect(body).toContain('data-slot="context-menu-group"');
  });
});

describe("context-menu.css source-text (coordinate positioning contract)", () => {
  const css = readFileSync(join(root, "registry/jte/context-menu.css"), "utf8");

  test("declares --lv-context-menu-min-width in :root", () => {
    expect(css).toContain("--lv-context-menu-min-width");
    expect(css).toContain(":root");
  });

  test("positions panel via CSS translate reading data-menu-x / data-menu-y (no inline style)", () => {
    expect(css).toContain("data-menu-x");
    expect(css).toContain("data-menu-y");
    expect(css).toContain("transform");
    expect(css).toContain("translate");
  });

  test("size variant tokens cascade to items via --lv-item-height", () => {
    expect(css).toContain("--lv-item-height");
  });
});

describe("context-menu-trigger.enhancer.ts source-text (CSP + no-import contract)", () => {
  const src = readFeature("context-menu-trigger.enhancer.ts");
  // Strip block comments.
  const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*/g, "");

  test("no dev.lievit import (enhancer has no runtime dependency beyond the DOM)", () => {
    expect(src).not.toMatch(/^import.*dev\.lievit/m);
  });

  test("intercepts contextmenu event", () => {
    expect(code).toContain('"contextmenu"');
  });

  test("calls preventDefault() on the contextmenu event", () => {
    expect(code).toContain("preventDefault");
  });

  test("sets data-menu-x and data-menu-y attributes (not inline style)", () => {
    expect(code).toContain("data-menu-x");
    expect(code).toContain("data-menu-y");
    expect(code).toContain("setAttribute");
    expect(code).not.toContain('.style.left');
    expect(code).not.toContain('.style.top');
  });

  test("handles Escape via document keydown listener (named constant or string literal)", () => {
    expect(src).toMatch(/['"']Escape['"']/);
  });

  test("handles ContextMenu key and Shift+F10 (APG keyboard affordances)", () => {
    expect(src).toContain("ContextMenu");
    expect(src).toContain("F10");
  });

  test("idempotency guard via wired attribute prevents listener stacking", () => {
    expect(code).toContain("WIRED_ATTR");
  });

  test("document listener refcounting (installDocListeners / removeDocListeners)", () => {
    expect(code).toContain("docListenerRefCount");
  });

  test("exports installContextMenuTrigger function", () => {
    expect(src).toContain("export function installContextMenuTrigger");
  });
});

// ============================================================================
// C. Trigger enhancer unit tests (real DOM, real events, no mocked runtime)
// ============================================================================

describe("installContextMenuTrigger: right-click open + coordinate attributes", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });
  afterEach(() => {
    document.body.innerHTML = "";
  });

  function renderContextMenuDOM(open = false): {
    root: HTMLElement;
    trigger: HTMLElement;
    panel: HTMLElement | null;
    panelId: string;
  } {
    const panelId = "test-panel-" + Math.random().toString(36).slice(2);
    const root = document.createElement("div");
    root.setAttribute("data-slot", "context-menu");
    root.setAttribute("data-panel-id", panelId);

    const trigger = document.createElement("div");
    trigger.setAttribute("data-slot", "context-menu-trigger");
    trigger.setAttribute("data-context-menu-for", panelId);
    trigger.setAttribute("tabindex", "0");
    root.appendChild(trigger);

    let panel: HTMLElement | null = null;
    if (open) {
      panel = document.createElement("div");
      panel.id = panelId;
      panel.setAttribute("data-slot", "context-menu-panel");
      panel.setAttribute("role", "menu");
      panel.setAttribute("tabindex", "-1");
      root.appendChild(panel);
    }
    document.body.appendChild(root);
    return { root, trigger, panel, panelId };
  }

  test("right-click suppresses the native browser menu (preventDefault)", () => {
    const { trigger } = renderContextMenuDOM(true);
    installContextMenuTrigger(document.body);
    const e = new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 50, clientY: 80 });
    trigger.dispatchEvent(e);
    expect(e.defaultPrevented).toBe(true);
  });

  test("right-click sets data-menu-x and data-menu-y on the panel", () => {
    const { trigger, panel, panelId } = renderContextMenuDOM(true);
    installContextMenuTrigger(document.body);
    trigger.dispatchEvent(
      new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 123, clientY: 456 }),
    );
    const panelEl = document.getElementById(panelId) ?? panel;
    expect(panelEl?.getAttribute("data-menu-x")).toBe("123");
    expect(panelEl?.getAttribute("data-menu-y")).toBe("456");
  });

  test("keyboard contextmenu (ContextMenu key) opens the panel (preventDefault)", () => {
    const { trigger } = renderContextMenuDOM(true);
    installContextMenuTrigger(document.body);
    const e = new KeyboardEvent("keydown", { key: "ContextMenu", bubbles: true, cancelable: true });
    trigger.dispatchEvent(e);
    expect(e.defaultPrevented).toBe(true);
  });

  test("Shift+F10 opens the panel (APG keyboard affordance, preventDefault)", () => {
    const { trigger } = renderContextMenuDOM(true);
    installContextMenuTrigger(document.body);
    const e = new KeyboardEvent("keydown", { key: "F10", shiftKey: true, bubbles: true, cancelable: true });
    trigger.dispatchEvent(e);
    expect(e.defaultPrevented).toBe(true);
  });

  test("Escape fires close: removes data-menu-x/y from the panel", () => {
    const { trigger, panelId } = renderContextMenuDOM(true);
    installContextMenuTrigger(document.body);
    // Open first.
    trigger.dispatchEvent(
      new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 10, clientY: 20 }),
    );
    const panelEl = document.getElementById(panelId)!;
    expect(panelEl.getAttribute("data-menu-x")).toBe("10");
    // Press Escape.
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(panelEl.hasAttribute("data-menu-x")).toBe(false);
    expect(panelEl.hasAttribute("data-menu-y")).toBe(false);
  });

  test("outside mousedown closes the menu (light-dismiss)", () => {
    const { trigger, panelId } = renderContextMenuDOM(true);
    installContextMenuTrigger(document.body);
    trigger.dispatchEvent(
      new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 5, clientY: 5 }),
    );
    const panelEl = document.getElementById(panelId)!;
    expect(panelEl.hasAttribute("data-menu-x")).toBe(true);
    // Mousedown outside the panel.
    document.body.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    expect(panelEl.hasAttribute("data-menu-x")).toBe(false);
  });

  test("mousedown inside the panel does NOT close the menu", () => {
    const { trigger, panel, panelId } = renderContextMenuDOM(true);
    installContextMenuTrigger(document.body);
    trigger.dispatchEvent(
      new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 5, clientY: 5 }),
    );
    // Mousedown INSIDE the panel.
    (panel ?? document.getElementById(panelId))!.dispatchEvent(
      new MouseEvent("mousedown", { bubbles: true }),
    );
    const panelEl = document.getElementById(panelId)!;
    expect(panelEl.hasAttribute("data-menu-x")).toBe(true);
  });
});

describe("installContextMenuTrigger: idempotency (no listener stacking)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  function makeRoot(): { trigger: HTMLElement; panelId: string } {
    const panelId = "idem-panel-" + Math.random().toString(36).slice(2);
    const root = document.createElement("div");
    root.setAttribute("data-slot", "context-menu");
    const trigger = document.createElement("div");
    trigger.setAttribute("data-slot", "context-menu-trigger");
    trigger.setAttribute("data-context-menu-for", panelId);
    root.appendChild(trigger);
    const panel = document.createElement("div");
    panel.id = panelId;
    panel.setAttribute("data-slot", "context-menu-panel");
    panel.setAttribute("tabindex", "-1");
    root.appendChild(panel);
    document.body.appendChild(root);
    return { trigger, panelId };
  }

  test("re-scanning the same trigger does NOT stack contextmenu listeners", () => {
    const { trigger } = makeRoot();
    const add = vi.spyOn(trigger, "addEventListener");
    installContextMenuTrigger(document.body);
    installContextMenuTrigger(document.body);
    installContextMenuTrigger(document.body);
    const contextmenuAdds = add.mock.calls.filter((c) => c[0] === "contextmenu");
    expect(contextmenuAdds).toHaveLength(1);
    vi.restoreAllMocks();
  });

  test("teardown is idempotent: calling it twice does not throw", () => {
    makeRoot();
    const td = installContextMenuTrigger(document.body);
    td();
    expect(() => td()).not.toThrow();
  });

  test("after teardown, a right-click no longer sets coordinate attributes", () => {
    const { trigger, panelId } = makeRoot();
    const td = installContextMenuTrigger(document.body);
    td();
    trigger.dispatchEvent(
      new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 9, clientY: 9 }),
    );
    expect(document.getElementById(panelId)?.hasAttribute("data-menu-x")).toBe(false);
  });
});

describe("installContextMenuTrigger: focus save + restore", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  test("focus is restored to the element active at contextmenu time after Escape", () => {
    const panelId = "focus-panel-" + Math.random().toString(36).slice(2);
    const root = document.createElement("div");
    root.setAttribute("data-slot", "context-menu");

    const button = document.createElement("button");
    button.textContent = "Focusable";
    root.appendChild(button);

    const trigger = document.createElement("div");
    trigger.setAttribute("data-slot", "context-menu-trigger");
    trigger.setAttribute("data-context-menu-for", panelId);
    trigger.tabIndex = 0;
    root.appendChild(trigger);

    const panel = document.createElement("div");
    panel.id = panelId;
    panel.setAttribute("data-slot", "context-menu-panel");
    panel.setAttribute("tabindex", "-1");
    root.appendChild(panel);

    document.body.appendChild(root);

    // Focus the button before right-clicking.
    button.focus();
    expect(document.activeElement).toBe(button);

    installContextMenuTrigger(document.body);

    trigger.dispatchEvent(
      new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 1, clientY: 1 }),
    );

    // Escape closes: focus should return to the button.
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(document.activeElement).toBe(button);
  });
});
