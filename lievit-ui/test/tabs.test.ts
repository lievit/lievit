/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * Tests for the re-forged tabs primitive (v-next: headless controlled/uncontrolled PARTIAL).
 *
 * LAYER SPLIT:
 *   1. Source-text assertions (no JTE compiler in the Node harness): assert on the @param API,
 *      the data-slot set, WAI-ARIA roles, roving tabindex, aria-selected, aria-controls /
 *      aria-labelledby pairing, token-driven styling, CSP-safety, escaping contracts,
 *      collection-nav wiring. These are "spec holds in the source" tests.
 *   2. Runtime assertions (real LievitRuntime + installCollectionNav + happy-dom DOM): assert
 *      roving-tabindex keyboard navigation and automatic/manual activation using the collection-nav
 *      tests infra (mirrors the buildRovingCollection helper pattern from
 *      collection-nav.enhancer.test.ts). The JTE-compile + real-render gate lives in
 *      test/jte-compile/ (coordinator-run per-wave; not executed here).
 *
 * CLIENT-ISLAND FIDELITY NOTE: the runtime tests use a REAL LievitRuntime + installCollectionNav,
 * not a mocked $lievit, per the client-island-fidelity lesson in gest CLAUDE.md.
 * The JTE-compile gate (real compiler + DOM render) and the Playwright gate (real browser gesture)
 * are out-of-scope for this file (coordinator-run and e2e, respectively).
 */
import { describe, test, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

import { LievitRuntime } from "../runtime/runtime.js";
import { installCollectionNav } from "../runtime/features/collection-nav.enhancer.js";

const jteDir = join(import.meta.dirname, "..", "registry", "jte");
const read = (rel: string) => readFileSync(join(jteDir, rel), "utf8");

// ---------------------------------------------------------------------------
// Source-text assertions
// ---------------------------------------------------------------------------

describe("tabs (v-next headless controlled/uncontrolled PARTIAL — source-text assertions)", () => {
  const src = read("tabs.jte");

  test("Apache license header present", () => {
    expect(src).toContain("Copyright 2026 Francesco Bilotta");
    expect(src).toContain("Apache License");
  });

  test("meta.json exists at registry/jte/tabs/meta.json", () => {
    expect(existsSync(join(jteDir, "tabs", "meta.json"))).toBe(true);
  });

  test("comment block present and closes without nesting (no inner --%>)", () => {
    expect(src).toContain("<%--");
    expect(src).toContain("--%>");
    // The outer doc-comment must not contain a nested --%> that would close it early.
    // Strategy: extract everything between the first <%-- and its matching --%>, then assert
    // the comment body itself does not contain a second closing --%>.
    const firstOpen = src.indexOf("<%--");
    const firstClose = src.indexOf("--%>", firstOpen + 4);
    const commentBody = src.slice(firstOpen + 4, firstClose);
    expect(commentBody).not.toContain("--%>");
  });

  test("Usage section present in doc-comment", () => {
    expect(src).toMatch(/Usage[:\s]/);
    expect(src).toContain("@@template.lievit.tabs(");
  });

  test("NEVER imports io.lievit.* (JTE-compile gate classpath excludes it)", () => {
    expect(src).not.toMatch(/@import\s+io\.lievit\./);
  });

  test("NEVER has @Wire, _component, _instance, _componentSnapshot params (outside comments)", () => {
    // Strip JTE comments first -- the doc-comment explains the controlled/uncontrolled model
    // using the words "@Wire field", "_instance.activeTab()" as prose; the check is that none
    // of these appear as ACTUAL JTE directives / @param names outside the comment block.
    const withoutComments = src.replace(/<%--[\s\S]*?--%>/g, "");
    expect(withoutComments).not.toMatch(/@Wire\b/);
    expect(withoutComments).not.toContain("_component");
    expect(withoutComments).not.toContain("_instance");
    expect(withoutComments).not.toContain("_componentSnapshot");
  });

  test("declares the v-next CONTROLLED/UNCONTROLLED @param API", () => {
    // Core identity params
    expect(src).toContain("@param String tabsId");
    expect(src).toContain("@param List<String> tabIds");
    expect(src).toContain("@param List<String> tabLabels");
    expect(src).toContain("@param List<String> tabIcons");
    expect(src).toContain("@param List<Boolean> tabClosable");
    expect(src).toContain("@param List<Boolean> tabDisabled");
    expect(src).toContain("@param String activeTab");
    // Configuration params
    expect(src).toContain("@param String orientation");
    expect(src).toContain("@param String size");
    expect(src).toContain("@param String type");
    expect(src).toContain("@param boolean lazyLoad");
    expect(src).toContain("@param boolean addable");
    expect(src).toContain("@param boolean manualActivation");
    // ARIA label params
    expect(src).toContain("@param String tabsLabel");
    expect(src).toContain("@param String tabsLabelledBy");
    // Wire action name params (controlled seam: caller passes their own action names)
    expect(src).toContain("@param String selectAction");
    expect(src).toContain("@param String closeAction");
    expect(src).toContain("@param String addAction");
    // Extension params
    expect(src).toContain("@param String cssClass");
    expect(src).toContain('@param String attrs = ""');
  });

  test("does NOT declare the old static-tier API (tabIds+labels+hrefs+active+content)", () => {
    // The old tabs.jte had List<String> hrefs + gg.jte.Content content; the new one does not.
    expect(src).not.toContain("@param List<String> hrefs");
    expect(src).not.toContain("@param gg.jte.Content content");
    // The old `active` (bare) param is gone; the new one is `activeTab`.
    expect(src).not.toMatch(/@param\s+String\s+active\b/);
  });

  test("carries the v-next data-slot set", () => {
    expect(src).toContain('data-slot="tabs"');
    expect(src).toContain('data-slot="tabs-list"');
    expect(src).toContain('data-slot="tabs-trigger"');
    expect(src).toContain('data-slot="tabs-close"');
    expect(src).toContain('data-slot="tabs-add"');
    expect(src).toContain('data-slot="tabs-content"');
  });

  test("carries data-orientation, data-type, data-size on root for styling hooks + tests", () => {
    expect(src).toContain('data-orientation="${orientation}"');
    expect(src).toContain('data-type="${type}"');
    expect(src).toContain('data-size="${size}"');
  });

  test("WAI-ARIA APG roles: tablist > tab + tabpanel", () => {
    expect(src).toContain('role="tablist"');
    expect(src).toContain('role="tab"');
    expect(src).toContain('role="tabpanel"');
    // Tab is a real <button> NOT an <a> or <div>.
    expect(src).toMatch(/<button[\s\S]{0,200}role="tab"/);
    expect(src).not.toMatch(/<a[\s\S]{0,200}role="tab"/);
  });

  test("aria-label and aria-labelledby both wired (one MUST be set per APG)", () => {
    expect(src).toContain('aria-label="${tabsLabel}"');
    expect(src).toContain('aria-labelledby="${tabsLabelledBy}"');
  });

  test("aria-orientation emitted on tablist root", () => {
    expect(src).toContain('aria-orientation="${orientation}"');
  });

  test("active tab: aria-selected=true + tabindex=0; inactive: false + -1 (roving tabindex)", () => {
    expect(src).toContain('aria-selected="${isActive ? "true" : "false"}"');
    expect(src).toContain('tabindex="${isActive ? "0" : "-1"}"');
  });

  test("aria-controls on each tab points to the correct panel id scheme", () => {
    // aria-controls="panel-{tabsId}-{safeTabId}"
    expect(src).toContain('aria-controls="panel-${tabsId}-$unsafe{safeTabId}"');
  });

  test("aria-labelledby on each panel points back to the tab id (correct cross-ref)", () => {
    // Panel aria-labelledby="tab-{tabsId}-{safeId}"
    expect(src).toContain('aria-labelledby="tab-${tabsId}-$unsafe{ptSafeId}"');
  });

  test("tab ids and panel ids use deterministic tabsId+tabId anchor scheme", () => {
    expect(src).toContain('id="tab-${tabsId}-$unsafe{safeTabId}"');
    expect(src).toContain('id="panel-${tabsId}-$unsafe{ptSafeId}"');
  });

  test("disabled tabs: aria-disabled=true ONLY — NO native disabled attribute", () => {
    expect(src).toContain('aria-disabled="${isDisabled ? "true" : null}"');
    // The spec forbids native `disabled` on tabs (it removes from tab order, breaks APG).
    // We look for disabled as a bare attribute assignment that is NOT aria-disabled.
    const withoutComments = src.replace(/<%--[\s\S]*?--%>/g, "");
    expect(withoutComments).not.toMatch(/\bdisabled="${isDisabled[^"]*}"/);
  });

  test("closable tabs: close button with aria-label inside the tab button", () => {
    expect(src).toContain('aria-label="Close $unsafe{safeTabLabel}"');
    expect(src).toContain('data-slot="tabs-close"');
  });

  test("addable: add button with aria-label, NOT a data-lievit-item", () => {
    expect(src).toContain('aria-label="Add tab"');
    expect(src).toContain('data-slot="tabs-add"');
    // The add button must NOT be in the roving tablist (it is a trailing action).
    const addButtonSection = src.slice(src.indexOf("aria-label=\"Add tab\"") - 300);
    expect(addButtonSection.slice(0, 300)).not.toContain("data-lievit-item");
  });

  test("panels: eager mode uses hidden=${!ptIsActive}; lazy mode uses hx-get", () => {
    expect(src).toContain('hidden="${!ptIsActive}"');
    expect(src).toContain("hx-get=");
    expect(src).toContain('hx-swap="outerHTML"');
    expect(src).toContain("hx-trigger=");
  });

  test("panel tabindex=0 emitted by default (APG: panel must be keyboard-reachable)", () => {
    expect(src).toContain('tabindex="0"');
  });

  test("collection-nav wiring: all required data-lievit-* attributes on the tablist root", () => {
    expect(src).toContain("data-lievit-collection");
    expect(src).toContain('data-lievit-collection-roving-tabindex="true"');
    expect(src).toContain("data-lievit-collection-orientation=");
    expect(src).toContain('data-lievit-collection-wrap="true"');
    expect(src).toContain("data-lievit-collection-select-action=");
    expect(src).toContain("data-manual-activation=");
  });

  test("each tab button carries data-lievit-item (marks it as a collection item)", () => {
    expect(src).toContain("data-lievit-item");
  });

  test("wire actions emitted via l:click on tab / close / add buttons", () => {
    expect(src).toContain("l:click=");
  });

  test("XSS: per-tab ids go through Escape.htmlAttribute (SAFE channel; never raw attrs)", () => {
    expect(src).toContain("Escape.htmlAttribute(tabId,");
    // The safeTabId and ptSafeId are emitted via $unsafe{...} AFTER escaping -- this is the
    // correct SAFE pattern (pre-escaped, then $unsafe to bypass double-escaping).
    expect(src).toContain("$unsafe{safeTabId}");
    expect(src).toContain("$unsafe{ptSafeId}");
    // The close button label also goes through Escape.htmlAttribute.
    expect(src).toContain("Escape.htmlAttribute(tabLabel,");
    expect(src).toContain("$unsafe{safeTabLabel}");
  });

  test("token-driven: reads --lv-* tokens for colour, space, type, radius, shadow, ring", () => {
    // Colour tokens
    expect(src).toContain("var(--lv-color-primary)");
    expect(src).toContain("var(--lv-color-primary-fg)");
    expect(src).toContain("var(--lv-color-muted-fg)");
    expect(src).toContain("var(--lv-color-border)");
    expect(src).toContain("var(--lv-color-accent)");
    expect(src).toContain("var(--lv-color-fg)");
    expect(src).toContain("var(--lv-color-card)");
    expect(src).toContain("var(--lv-color-bg)");
    // Space tokens (height + padding scale)
    expect(src).toContain("var(--lv-space-8)");
    expect(src).toContain("var(--lv-space-9)");
    expect(src).toContain("var(--lv-space-10)");
    expect(src).toContain("var(--lv-space-4)");
    expect(src).toContain("var(--lv-space-6)");
    // Type tokens
    expect(src).toContain("var(--lv-text-sm)");
    expect(src).toContain("var(--lv-text-base)");
    expect(src).toContain("var(--lv-font-medium)");
    expect(src).toContain("var(--lv-font-sans)");
    // Structural tokens
    expect(src).toContain("var(--lv-radius-md)");
    expect(src).toContain("var(--lv-radius-full)");
    expect(src).toContain("var(--lv-shadow-xs)");
    expect(src).toContain("var(--lv-ring)");
    expect(src).toContain("var(--lv-duration-fast)");
  });

  test("no hardcoded hex colours", () => {
    const withoutComments = src.replace(/<%--[\s\S]*?--%>/g, "");
    expect(withoutComments).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  test("CSP-clean: no inline <script>, no on*= handler, no <style> block", () => {
    const withoutComments = src.replace(/<%--[\s\S]*?--%>/g, "");
    expect(withoutComments).not.toMatch(/<script/i);
    expect(withoutComments).not.toMatch(/<style[\s>]/i);
    expect(withoutComments).not.toMatch(/\son[a-z]+=/i);
  });

  test("size sm maps to --lv-space-8; lg maps to --lv-space-10 (toolbar alignment)", () => {
    expect(src).toContain('"sm" -> "h-[var(--lv-space-8)]"');
    expect(src).toContain('"lg" -> "h-[var(--lv-space-10)]"');
  });

  test("type=card emits card background + top rounding classes; type=pill emits full rounding", () => {
    expect(src).toContain("var(--lv-color-card)");
    expect(src).toContain("rounded-t-[var(--lv-radius-md)]");
    expect(src).toContain("rounded-[var(--lv-radius-full)]");
  });

  test("vertical orientation: collection-nav orientation attr maps to 'vertical'", () => {
    expect(src).toContain('"vertical".equals(orientation) ? "vertical" : "horizontal"');
  });

  test("root flex direction: horizontal = flex-col; vertical = flex-row", () => {
    expect(src).toContain('"vertical".equals(orientation) ? "flex-row" : "flex-col"');
  });

  test("manualActivation: data-manual-activation emitted as 'true' or null (smart attr)", () => {
    expect(src).toContain('data-manual-activation="${manualActivation ? "true" : null}"');
  });

  test("meta.json registers icon as a registryDependency (icon sub-partial is composed)", () => {
    const meta = JSON.parse(readFileSync(join(jteDir, "tabs", "meta.json"), "utf8") as string);
    expect(meta.registryDependencies).toContain("icon");
  });

  test("meta.json registers collection-nav enhancer", () => {
    const meta = JSON.parse(readFileSync(join(jteDir, "tabs", "meta.json"), "utf8") as string);
    expect(meta.enhancers).toBeDefined();
    expect(meta.enhancers).toContain("collection-nav.enhancer.ts");
  });
});

// ---------------------------------------------------------------------------
// Runtime assertions (real LievitRuntime + collection-nav, happy-dom)
// These mirror the buildRovingCollection pattern from collection-nav.enhancer.test.ts.
// They assert the KEYBOARD + ROVING behavior against a real DOM built to match what tabs.jte
// renders (manual build -- no JTE compiler in this environment).
// ---------------------------------------------------------------------------

function makeFetchImpl(calledActions: string[]): typeof fetch {
  return vi.fn(async (_url: unknown, init?: RequestInit) => {
    const body = JSON.parse((init?.body as string) ?? "{}") as Record<string, unknown>;
    const calls = body._calls as string[] | undefined;
    if (calls) {
      calledActions.push(...calls);
    }
    return new Response("<div></div>", {
      status: 200,
      headers: { "Lievit-Snapshot": "s2" },
    });
  }) as unknown as typeof fetch;
}

type TabDef = { id: string; label: string; disabled?: boolean };

/**
 * Build a tabs DOM that mirrors what tabs.jte renders for a 3-tab horizontal tablist.
 * Uses real <button role=tab> elements so .focus() works in happy-dom.
 * The first non-disabled tab starts with tabindex="0"; others get tabindex="-1".
 */
function buildTabsDom(opts: {
  tabs: TabDef[];
  activeTabId: string;
  orientation?: "horizontal" | "vertical";
  manualActivation?: boolean;
  selectAction?: string;
}): {
  runtime: LievitRuntime;
  calledActions: string[];
  tablistEl: HTMLElement;
  tabButtons: HTMLButtonElement[];
  panelEls: HTMLElement[];
} {
  document.body.innerHTML = "";
  const calledActions: string[] = [];

  const tabsId = "test-tabs";
  const orientation = opts.orientation ?? "horizontal";
  const manualActivation = opts.manualActivation ?? false;
  const selectAction = opts.selectAction ?? "activate";

  // Component root (required by the runtime).
  const componentRoot = document.createElement("div");
  componentRoot.setAttribute("data-lievit-component", "com.example.TestTabs");
  componentRoot.setAttribute("data-lievit-id", tabsId);
  componentRoot.setAttribute("data-lievit-snapshot", "s1");

  // Root wrapper.
  const tabsRoot = document.createElement("div");
  tabsRoot.setAttribute("data-slot", "tabs");
  tabsRoot.setAttribute("data-orientation", orientation);
  tabsRoot.setAttribute("data-type", "line");
  tabsRoot.setAttribute("data-size", "md");

  // Tablist strip.
  const tablistEl = document.createElement("div") as HTMLElement;
  tablistEl.setAttribute("role", "tablist");
  tablistEl.setAttribute("aria-label", "Test tabs");
  tablistEl.setAttribute("aria-orientation", orientation);
  tablistEl.setAttribute("data-slot", "tabs-list");
  tablistEl.setAttribute("data-lievit-collection", "");
  tablistEl.setAttribute("data-lievit-collection-roving-tabindex", "true");
  tablistEl.setAttribute(
    "data-lievit-collection-orientation",
    orientation === "vertical" ? "vertical" : "horizontal",
  );
  tablistEl.setAttribute("data-lievit-collection-wrap", "true");
  tablistEl.setAttribute("data-lievit-collection-select-action", selectAction);
  if (manualActivation) {
    tablistEl.setAttribute("data-manual-activation", "true");
  }

  // Tab buttons.
  const tabButtons: HTMLButtonElement[] = [];
  let firstEnabled = true;
  for (const tab of opts.tabs) {
    const btn = document.createElement("button") as HTMLButtonElement;
    btn.setAttribute("type", "button");
    btn.setAttribute("role", "tab");
    btn.id = `tab-${tabsId}-${tab.id}`;
    btn.setAttribute("aria-selected", tab.id === opts.activeTabId ? "true" : "false");
    btn.setAttribute("aria-controls", `panel-${tabsId}-${tab.id}`);
    btn.setAttribute("data-slot", "tabs-trigger");
    btn.setAttribute("data-lievit-item", "");
    btn.setAttribute("data-id", tab.id);
    btn.textContent = tab.label;

    if (tab.disabled) {
      // APG Tabs: aria-disabled ONLY (NOT native disabled).
      btn.setAttribute("aria-disabled", "true");
      btn.tabIndex = -1;
    } else {
      // First non-disabled tab gets tabindex=0 (matches server-rendered initial state from tabs.jte).
      btn.tabIndex = firstEnabled ? 0 : -1;
      firstEnabled = false;
    }

    tablistEl.appendChild(btn);
    tabButtons.push(btn);
  }

  // Panel elements.
  const panelEls: HTMLElement[] = [];
  for (const tab of opts.tabs) {
    const panel = document.createElement("div") as HTMLElement;
    panel.setAttribute("role", "tabpanel");
    panel.id = `panel-${tabsId}-${tab.id}`;
    panel.setAttribute("aria-labelledby", `tab-${tabsId}-${tab.id}`);
    panel.setAttribute("tabindex", "0");
    panel.setAttribute("data-slot", "tabs-content");
    if (tab.id !== opts.activeTabId) {
      panel.setAttribute("hidden", "");
    }
    panel.textContent = `Content for ${tab.label}`;
    panelEls.push(panel);
  }

  tabsRoot.appendChild(tablistEl);
  for (const panel of panelEls) {
    tabsRoot.appendChild(panel);
  }
  componentRoot.appendChild(tabsRoot);
  document.body.appendChild(componentRoot);

  const runtime = new LievitRuntime({ fetchImpl: makeFetchImpl(calledActions) });
  installCollectionNav(runtime);
  runtime.start();

  return { runtime, calledActions, tablistEl, tabButtons, panelEls };
}

function key(el: Element, k: string): void {
  el.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }));
}

beforeEach(() => {
  document.body.innerHTML = "";
});

afterEach(() => {
  document.body.innerHTML = "";
});

// ---------------------------------------------------------------------------
// tabs-render-structure: basic ARIA structure assertions on built DOM.
// ---------------------------------------------------------------------------

describe("tabs runtime — DOM structure (APG Tabs contract)", () => {
  it("tabs-render-structure: tablist + 3 tabs + 3 panels with correct ARIA cross-references", () => {
    const { tablistEl, tabButtons, panelEls } = buildTabsDom({
      tabs: [
        { id: "info", label: "Info" },
        { id: "docs", label: "Docs" },
        { id: "history", label: "History" },
      ],
      activeTabId: "info",
    });

    expect(tablistEl.getAttribute("role")).toBe("tablist");
    expect(tabButtons).toHaveLength(3);
    expect(panelEls).toHaveLength(3);

    // First tab is active.
    expect(tabButtons[0].getAttribute("aria-selected")).toBe("true");
    expect(tabButtons[0].tabIndex).toBe(0);
    // Others are inactive.
    expect(tabButtons[1].getAttribute("aria-selected")).toBe("false");
    expect(tabButtons[1].tabIndex).toBe(-1);
    expect(tabButtons[2].getAttribute("aria-selected")).toBe("false");
    expect(tabButtons[2].tabIndex).toBe(-1);

    // aria-controls links to the panel id.
    expect(tabButtons[0].getAttribute("aria-controls")).toBe(panelEls[0].id);
    expect(tabButtons[1].getAttribute("aria-controls")).toBe(panelEls[1].id);

    // aria-labelledby on panels points back to the tab button id.
    expect(panelEls[0].getAttribute("aria-labelledby")).toBe(tabButtons[0].id);
    expect(panelEls[1].getAttribute("aria-labelledby")).toBe(tabButtons[1].id);
    expect(panelEls[2].getAttribute("aria-labelledby")).toBe(tabButtons[2].id);

    // Active panel visible; others hidden.
    expect(panelEls[0].hasAttribute("hidden")).toBe(false);
    expect(panelEls[1].hasAttribute("hidden")).toBe(true);
    expect(panelEls[2].hasAttribute("hidden")).toBe(true);
  });

  it("tabs-render-disabled-tab: aria-disabled=true, NOT native disabled, tabIndex=-1 but stays in DOM", () => {
    const { tabButtons } = buildTabsDom({
      tabs: [
        { id: "tab1", label: "Tab 1" },
        { id: "tab2", label: "Tab 2", disabled: true },
        { id: "tab3", label: "Tab 3" },
      ],
      activeTabId: "tab1",
    });

    expect(tabButtons[1].getAttribute("aria-disabled")).toBe("true");
    // Native disabled must NOT be set (disabled tabs must remain focusable in APG model).
    expect(tabButtons[1].hasAttribute("disabled")).toBe(false);
    // disabled tab gets tabIndex=-1 in the initial server-rendered state (before arrow key
    // navigation; collection-nav skips it during navigation but it is still in the DOM).
    expect(tabButtons[1].tabIndex).toBe(-1);
  });

  it("tabs-render-vertical: aria-orientation=vertical on tablist + collection-nav attr", () => {
    const { tablistEl } = buildTabsDom({
      tabs: [
        { id: "a", label: "A" },
        { id: "b", label: "B" },
      ],
      activeTabId: "a",
      orientation: "vertical",
    });

    expect(tablistEl.getAttribute("aria-orientation")).toBe("vertical");
    expect(tablistEl.getAttribute("data-lievit-collection-orientation")).toBe("vertical");
  });
});

// ---------------------------------------------------------------------------
// tabs-key-*: keyboard interaction via real collection-nav enhancer.
// ---------------------------------------------------------------------------

describe("tabs runtime — keyboard interaction (real collection-nav, APG Tabs model)", () => {
  it("tabs-key-arrow-right-automatic: ArrowRight moves focus + fires activate in automatic mode", async () => {
    const { tablistEl, tabButtons, calledActions } = buildTabsDom({
      tabs: [
        { id: "tab1", label: "Tab 1" },
        { id: "tab2", label: "Tab 2" },
        { id: "tab3", label: "Tab 3" },
      ],
      activeTabId: "tab1",
      selectAction: "activate",
    });

    // Initial state: tab1 has tabindex=0.
    expect(tabButtons[0].tabIndex).toBe(0);
    expect(tabButtons[1].tabIndex).toBe(-1);

    key(tablistEl, "ArrowRight");

    // Focus moved to tab2 synchronously.
    expect(document.activeElement).toBe(tabButtons[1]);
    expect(tabButtons[1].tabIndex).toBe(0);
    expect(tabButtons[0].tabIndex).toBe(-1);

    // Automatic activation: the wire action fires asynchronously.
    await new Promise<void>((r) => setTimeout(r, 20));
    expect(calledActions).toContain("activate");
  });

  it("tabs-key-arrow-left-automatic: ArrowLeft moves focus backwards + fires activate", async () => {
    const { tablistEl, tabButtons, calledActions } = buildTabsDom({
      tabs: [
        { id: "tab1", label: "Tab 1" },
        { id: "tab2", label: "Tab 2" },
        { id: "tab3", label: "Tab 3" },
      ],
      activeTabId: "tab1",
      selectAction: "activate",
    });

    // Move to tab2 first.
    key(tablistEl, "ArrowRight");
    expect(document.activeElement).toBe(tabButtons[1]);

    key(tablistEl, "ArrowLeft");
    expect(document.activeElement).toBe(tabButtons[0]);
    expect(tabButtons[0].tabIndex).toBe(0);

    await new Promise<void>((r) => setTimeout(r, 20));
    expect(calledActions.length).toBeGreaterThan(0);
  });

  it("tabs-key-wrap: ArrowRight at last tab wraps to first", () => {
    const { tablistEl, tabButtons } = buildTabsDom({
      tabs: [
        { id: "tab1", label: "Tab 1" },
        { id: "tab2", label: "Tab 2" },
        { id: "tab3", label: "Tab 3" },
      ],
      activeTabId: "tab1",
    });

    key(tablistEl, "End"); // → last tab
    expect(document.activeElement).toBe(tabButtons[2]);

    key(tablistEl, "ArrowRight"); // wraps → first
    expect(document.activeElement).toBe(tabButtons[0]);
    expect(tabButtons[0].tabIndex).toBe(0);
  });

  it("tabs-key-arrow-vertical: vertical tablist uses ArrowDown/Up", () => {
    const { tablistEl, tabButtons } = buildTabsDom({
      tabs: [
        { id: "va", label: "A" },
        { id: "vb", label: "B" },
        { id: "vc", label: "C" },
      ],
      activeTabId: "va",
      orientation: "vertical",
    });

    key(tablistEl, "ArrowDown");
    expect(document.activeElement).toBe(tabButtons[1]);

    key(tablistEl, "ArrowUp");
    expect(document.activeElement).toBe(tabButtons[0]);

    // ArrowRight must NOT move focus in vertical mode.
    const activeBefore = document.activeElement;
    key(tablistEl, "ArrowRight");
    expect(document.activeElement).toBe(activeBefore);
  });

  it("tabs-key-home-end: Home moves to first, End to last", () => {
    const { tablistEl, tabButtons } = buildTabsDom({
      tabs: [
        { id: "t1", label: "T1" },
        { id: "t2", label: "T2" },
        { id: "t3", label: "T3" },
        { id: "t4", label: "T4" },
      ],
      activeTabId: "t1",
    });

    key(tablistEl, "End");
    expect(document.activeElement).toBe(tabButtons[3]);
    expect(tabButtons[3].tabIndex).toBe(0);

    key(tablistEl, "Home");
    expect(document.activeElement).toBe(tabButtons[0]);
    expect(tabButtons[0].tabIndex).toBe(0);
  });

  it("tabs-key-skip-disabled: ArrowRight skips disabled tabs (default skipDisabled=true via collection-nav)", () => {
    const { tablistEl, tabButtons } = buildTabsDom({
      tabs: [
        { id: "tab1", label: "Tab 1" },
        { id: "tab2", label: "Tab 2", disabled: true },
        { id: "tab3", label: "Tab 3" },
      ],
      activeTabId: "tab1",
    });

    key(tablistEl, "ArrowRight"); // should skip disabled tab2, land on tab3
    expect(document.activeElement).toBe(tabButtons[2]);
    expect(tabButtons[2].tabIndex).toBe(0);
  });

  it("tabs-key-manual-activation: ArrowRight moves focus but does NOT fire action", async () => {
    const { tablistEl, tabButtons, calledActions } = buildTabsDom({
      tabs: [
        { id: "tab1", label: "Tab 1" },
        { id: "tab2", label: "Tab 2" },
      ],
      activeTabId: "tab1",
      manualActivation: true,
      selectAction: "activate",
    });

    key(tablistEl, "ArrowRight");
    await new Promise<void>((r) => setTimeout(r, 20));

    // Focus moved but action NOT fired yet.
    expect(document.activeElement).toBe(tabButtons[1]);
    expect(calledActions).not.toContain("activate");
  });

  it("tabs-key-manual-activation-enter: Enter fires the action after focus moves", async () => {
    const { tablistEl, tabButtons, calledActions } = buildTabsDom({
      tabs: [
        { id: "tab1", label: "Tab 1" },
        { id: "tab2", label: "Tab 2" },
      ],
      activeTabId: "tab1",
      manualActivation: true,
      selectAction: "activate",
    });

    key(tablistEl, "ArrowRight"); // focus → tab2
    expect(document.activeElement).toBe(tabButtons[1]);

    key(tablistEl, "Enter"); // fires action
    await new Promise<void>((r) => setTimeout(r, 20));
    expect(calledActions).toContain("activate");
  });

  it("tabs-key-manual-activation-space: Space fires the action after focus moves", async () => {
    const { tablistEl, calledActions } = buildTabsDom({
      tabs: [
        { id: "tab1", label: "Tab 1" },
        { id: "tab2", label: "Tab 2" },
      ],
      activeTabId: "tab1",
      manualActivation: true,
      selectAction: "activate",
    });

    key(tablistEl, "ArrowRight");
    key(tablistEl, " ");
    await new Promise<void>((r) => setTimeout(r, 20));
    expect(calledActions).toContain("activate");
  });
});

// ---------------------------------------------------------------------------
// tabs-focus-*: roving tabindex state after navigation.
// ---------------------------------------------------------------------------

describe("tabs runtime — roving tabindex state", () => {
  it("tabs-focus-roving-tabindex: after ArrowRight, tabindex=0 on new item; -1 on all others", () => {
    const { tablistEl, tabButtons } = buildTabsDom({
      tabs: [
        { id: "tab1", label: "Tab 1" },
        { id: "tab2", label: "Tab 2" },
        { id: "tab3", label: "Tab 3" },
      ],
      activeTabId: "tab1",
    });

    key(tablistEl, "ArrowRight"); // → tab2

    expect(tabButtons[0].tabIndex).toBe(-1);
    expect(tabButtons[1].tabIndex).toBe(0);
    expect(tabButtons[2].tabIndex).toBe(-1);
  });

  it("tabs-focus-no-aria-activedescendant: roving mode must NOT set aria-activedescendant", () => {
    const { tablistEl } = buildTabsDom({
      tabs: [
        { id: "tab1", label: "Tab 1" },
        { id: "tab2", label: "Tab 2" },
      ],
      activeTabId: "tab1",
    });

    key(tablistEl, "ArrowRight");
    expect(tablistEl.hasAttribute("aria-activedescendant")).toBe(false);
  });
});
