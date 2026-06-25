/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * Tests for the tabs primitive (v-next: headless controlled/uncontrolled PARTIAL) after the
 * Stimulus conversion of its interactive behaviour.
 *
 * LAYER SPLIT:
 *   1. Source-text assertions (no JTE compiler in the Node harness): assert on the @param API,
 *      the data-slot set, WAI-ARIA roles, roving tabindex, aria-selected, aria-controls /
 *      aria-labelledby pairing, token-driven styling, CSP-safety, escaping contracts, and the
 *      Stimulus wiring (data-controller="lv-tabs"). These are "spec holds in the source" tests.
 *   2. Runtime assertions (REAL @hotwired/stimulus Application + the REAL lv-tabs controller +
 *      happy-dom DOM): assert roving-tabindex keyboard navigation, automatic/manual activation,
 *      the controlled/uncontrolled wire doctrine, and morph-safety. The keyboard behaviour used to
 *      live in collection-nav.enhancer.ts (roving-tabindex mode); it now lives in
 *      runtime/stimulus/controllers/lv-tabs-controller.ts and the enhancer SKIPS a tablist that
 *      carries data-controller="lv-tabs" (the migration guard). These tests therefore drive the
 *      controller through startStimulus(), NOT installCollectionNav.
 *
 * CLIENT-ISLAND FIDELITY NOTE: the runtime tests use a REAL Stimulus Application + the REAL lievit
 * wire morph (a fetch stub captures the actual `_calls` the runtime POSTs), not a mocked $lievit,
 * per the client-island-fidelity lesson in gest CLAUDE.md and the Stimulus conversion convention.
 * The JTE-compile gate (real compiler + DOM render) and the Playwright gate (real browser gesture)
 * are out-of-scope for this file (coordinator-run and e2e, respectively).
 */
import { describe, test, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

import { LievitRuntime } from "../runtime/runtime.js";
import { morph } from "../runtime/morph.js";
import { startStimulus, stopStimulus, flushStimulus } from "../runtime/stimulus/application.js";

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
    const firstOpen = src.indexOf("<%--");
    const firstClose = src.indexOf("--%>", firstOpen + 4);
    const commentBody = src.slice(firstOpen + 4, firstClose);
    expect(commentBody).not.toContain("--%>");
  });

  test("Usage section present in doc-comment", () => {
    expect(src).toMatch(/Usage[:\s]/);
    expect(src).toContain("@@template.lievit.tabs(");
  });

  test("NEVER imports dev.lievit.* (JTE-compile gate classpath excludes it)", () => {
    expect(src).not.toMatch(/@import\s+dev\.lievit\./);
  });

  test("NEVER has @Wire, _component, _instance, _componentSnapshot params (outside comments)", () => {
    const withoutComments = src.replace(/<%--[\s\S]*?--%>/g, "");
    expect(withoutComments).not.toMatch(/@Wire\b/);
    expect(withoutComments).not.toContain("_component");
    expect(withoutComments).not.toContain("_instance");
    expect(withoutComments).not.toContain("_componentSnapshot");
  });

  test("declares the v-next CONTROLLED/UNCONTROLLED @param API", () => {
    expect(src).toContain("@param String tabsId");
    expect(src).toContain("@param List<String> tabIds");
    expect(src).toContain("@param List<String> tabLabels");
    expect(src).toContain("@param List<String> tabIcons");
    expect(src).toContain("@param List<Boolean> tabClosable");
    expect(src).toContain("@param List<Boolean> tabDisabled");
    expect(src).toContain("@param String activeTab");
    expect(src).toContain("@param String orientation");
    expect(src).toContain("@param String size");
    expect(src).toContain("@param String type");
    expect(src).toContain("@param boolean lazyLoad");
    expect(src).toContain("@param boolean addable");
    expect(src).toContain("@param boolean manualActivation");
    expect(src).toContain("@param String tabsLabel");
    expect(src).toContain("@param String tabsLabelledBy");
    expect(src).toContain("@param String selectAction");
    expect(src).toContain("@param String closeAction");
    expect(src).toContain("@param String addAction");
    expect(src).toContain("@param String cssClass");
    expect(src).toContain('@param String attrs = ""');
  });

  test("does NOT declare the old static-tier API (tabIds+labels+hrefs+active+content)", () => {
    expect(src).not.toContain("@param List<String> hrefs");
    expect(src).not.toContain("@param gg.jte.Content content");
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
    expect(src).toContain('aria-controls="panel-${tabsId}-$unsafe{safeTabId}"');
  });

  test("aria-labelledby on each panel points back to the tab id (correct cross-ref)", () => {
    expect(src).toContain('aria-labelledby="tab-${tabsId}-$unsafe{ptSafeId}"');
  });

  test("tab ids and panel ids use deterministic tabsId+tabId anchor scheme", () => {
    expect(src).toContain('id="tab-${tabsId}-$unsafe{safeTabId}"');
    expect(src).toContain('id="panel-${tabsId}-$unsafe{ptSafeId}"');
  });

  test("disabled tabs: aria-disabled=true ONLY — NO native disabled attribute", () => {
    expect(src).toContain('aria-disabled="${isDisabled ? "true" : null}"');
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

  test("Stimulus: tablist carries data-controller=\"lv-tabs\" (the converted interactive owner)", () => {
    expect(src).toContain('data-controller="lv-tabs"');
  });

  test("collection-nav wiring preserved on the tablist root (the controller reads these attrs)", () => {
    // The established data-lievit-collection-* attributes are KEPT (the controller reads
    // orientation / wrap / select-action / manual from them; the enhancer SKIPS this tablist via
    // the data-controller="lv-tabs" guard). Mirrors the popover exemplar keeping data-lv-opener.
    expect(src).toContain("data-lievit-collection");
    expect(src).toContain('data-lievit-collection-roving-tabindex="true"');
    expect(src).toContain("data-lievit-collection-orientation=");
    expect(src).toContain('data-lievit-collection-wrap="true"');
    expect(src).toContain("data-lievit-collection-select-action=");
    expect(src).toContain("data-manual-activation=");
  });

  test("each tab button carries data-lievit-item (the roving collection item the controller reads)", () => {
    expect(src).toContain("data-lievit-item");
  });

  test("wire actions emitted via l:click on tab / close / add buttons", () => {
    expect(src).toContain("l:click=");
  });

  test("XSS: per-tab ids go through Escape.htmlAttribute (SAFE channel; never raw attrs)", () => {
    expect(src).toContain("Escape.htmlAttribute(tabId,");
    expect(src).toContain("$unsafe{safeTabId}");
    expect(src).toContain("$unsafe{ptSafeId}");
    expect(src).toContain("Escape.htmlAttribute(tabLabel,");
    expect(src).toContain("$unsafe{safeTabLabel}");
  });

  test("token-driven: reads --lv-* tokens for colour, space, type, radius, shadow, ring", () => {
    expect(src).toContain("var(--lv-color-primary)");
    expect(src).toContain("var(--lv-color-primary-fg)");
    expect(src).toContain("var(--lv-color-muted-fg)");
    expect(src).toContain("var(--lv-color-border)");
    expect(src).toContain("var(--lv-color-accent)");
    expect(src).toContain("var(--lv-color-fg)");
    expect(src).toContain("var(--lv-color-card)");
    expect(src).toContain("var(--lv-color-bg)");
    expect(src).toContain("var(--lv-space-8)");
    expect(src).toContain("var(--lv-space-9)");
    expect(src).toContain("var(--lv-space-10)");
    expect(src).toContain("var(--lv-space-4)");
    expect(src).toContain("var(--lv-space-6)");
    expect(src).toContain("var(--lv-text-sm)");
    expect(src).toContain("var(--lv-text-base)");
    expect(src).toContain("var(--lv-font-medium)");
    expect(src).toContain("var(--lv-font-sans)");
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
});

// ---------------------------------------------------------------------------
// Runtime assertions (REAL Stimulus Application + the REAL lv-tabs controller, happy-dom)
// These drive the converted controller, NOT installCollectionNav. The DOM is built to match what
// tabs.jte renders (manual build -- no JTE compiler in this environment), including the
// data-controller="lv-tabs" the template stamps on the tablist.
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

interface BuildOpts {
  tabs: TabDef[];
  activeTabId: string;
  orientation?: "horizontal" | "vertical";
  manualActivation?: boolean;
  /** Wire action name; omit to render an UNCONTROLLED tablist (no select-action attribute). */
  selectAction?: string;
}

/**
 * Emits the tabs DOM string exactly as tabs.jte renders it for a horizontal/vertical tablist,
 * including data-controller="lv-tabs" + the data-lievit-collection-* attributes the controller
 * reads. Returned as a string so the morph-safety tests can replay it through the real morph.
 */
function tabsHtml(opts: BuildOpts): string {
  const tabsId = "test-tabs";
  const orientation = opts.orientation ?? "horizontal";
  const manualActivation = opts.manualActivation ?? false;
  const collOrientation = orientation === "vertical" ? "vertical" : "horizontal";

  let firstEnabled = true;
  const tabButtons = opts.tabs
    .map((tab) => {
      const active = tab.id === opts.activeTabId;
      let tabindex: number;
      if (tab.disabled) {
        tabindex = -1;
      } else {
        tabindex = firstEnabled ? 0 : -1;
        firstEnabled = false;
      }
      const disabledAttr = tab.disabled ? ' aria-disabled="true"' : "";
      return (
        `<button type="button" role="tab" id="tab-${tabsId}-${tab.id}" ` +
        `aria-selected="${active ? "true" : "false"}" aria-controls="panel-${tabsId}-${tab.id}"` +
        `${disabledAttr} tabindex="${tabindex}" data-slot="tabs-trigger" data-lievit-item ` +
        `data-id="${tab.id}"${opts.selectAction != null ? ` l:click="${opts.selectAction}"` : ""}>` +
        `${tab.label}</button>`
      );
    })
    .join("");

  const panels = opts.tabs
    .map((tab) => {
      const active = tab.id === opts.activeTabId;
      return (
        `<div role="tabpanel" id="panel-${tabsId}-${tab.id}" ` +
        `aria-labelledby="tab-${tabsId}-${tab.id}" tabindex="0" data-slot="tabs-content"` +
        `${active ? "" : " hidden"}>Content for ${tab.label}</div>`
      );
    })
    .join("");

  const selectActionAttr =
    opts.selectAction != null
      ? ` data-lievit-collection-select-action="${opts.selectAction}"`
      : "";
  const manualAttr = manualActivation ? ' data-manual-activation="true"' : "";

  return (
    `<div data-lievit-component="com.example.TestTabs" data-lievit-id="${tabsId}" ` +
    `data-lievit-snapshot="s1">` +
    `<div data-slot="tabs" data-orientation="${orientation}" data-type="line" data-size="md">` +
    `<div role="tablist" aria-label="Test tabs" aria-orientation="${orientation}" ` +
    `data-slot="tabs-list" data-controller="lv-tabs" data-lievit-collection ` +
    `data-lievit-collection-roving-tabindex="true" ` +
    `data-lievit-collection-orientation="${collOrientation}" ` +
    `data-lievit-collection-wrap="true"${selectActionAttr}${manualAttr}>` +
    `${tabButtons}</div>${panels}</div></div>`
  );
}

interface Built {
  runtime: LievitRuntime;
  calledActions: string[];
  componentRoot: HTMLElement;
  tablistEl: HTMLElement;
  tabButtons: HTMLButtonElement[];
  panelEls: HTMLElement[];
}

/** Mounts the tabs DOM, starts the real Stimulus app (auto-loads lv-tabs), and awaits connect. */
async function buildTabsDom(opts: BuildOpts): Promise<Built> {
  document.body.innerHTML = "";
  const calledActions: string[] = [];
  const runtime = new LievitRuntime({ fetchImpl: makeFetchImpl(calledActions) });

  document.body.innerHTML = tabsHtml(opts);
  const componentRoot = document.body.firstElementChild as HTMLElement;
  const tablistEl = componentRoot.querySelector<HTMLElement>('[role="tablist"]')!;
  const tabButtons = Array.from(tablistEl.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
  const panelEls = Array.from(componentRoot.querySelectorAll<HTMLElement>('[role="tabpanel"]'));

  startStimulus({ runtime });
  await flushStimulus();

  return { runtime, calledActions, componentRoot, tablistEl, tabButtons, panelEls };
}

function key(el: Element, k: string): void {
  el.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }));
}

beforeEach(() => {
  document.body.innerHTML = "";
});

afterEach(() => {
  stopStimulus();
  document.body.innerHTML = "";
});

// ---------------------------------------------------------------------------
// tabs-render-structure: basic ARIA structure assertions on the rendered DOM.
// ---------------------------------------------------------------------------

describe("tabs runtime — DOM structure (APG Tabs contract)", () => {
  it("tabs-render-structure: tablist + 3 tabs + 3 panels with correct ARIA cross-references", async () => {
    const { tablistEl, tabButtons, panelEls } = await buildTabsDom({
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

    expect(tabButtons[0].getAttribute("aria-selected")).toBe("true");
    expect(tabButtons[0].tabIndex).toBe(0);
    expect(tabButtons[1].getAttribute("aria-selected")).toBe("false");
    expect(tabButtons[1].tabIndex).toBe(-1);
    expect(tabButtons[2].getAttribute("aria-selected")).toBe("false");
    expect(tabButtons[2].tabIndex).toBe(-1);

    expect(tabButtons[0].getAttribute("aria-controls")).toBe(panelEls[0].id);
    expect(tabButtons[1].getAttribute("aria-controls")).toBe(panelEls[1].id);

    expect(panelEls[0].getAttribute("aria-labelledby")).toBe(tabButtons[0].id);
    expect(panelEls[1].getAttribute("aria-labelledby")).toBe(tabButtons[1].id);
    expect(panelEls[2].getAttribute("aria-labelledby")).toBe(tabButtons[2].id);

    expect(panelEls[0].hasAttribute("hidden")).toBe(false);
    expect(panelEls[1].hasAttribute("hidden")).toBe(true);
    expect(panelEls[2].hasAttribute("hidden")).toBe(true);
  });

  it("tabs-render-disabled-tab: aria-disabled=true, NOT native disabled, tabIndex=-1 but stays in DOM", async () => {
    const { tabButtons } = await buildTabsDom({
      tabs: [
        { id: "tab1", label: "Tab 1" },
        { id: "tab2", label: "Tab 2", disabled: true },
        { id: "tab3", label: "Tab 3" },
      ],
      activeTabId: "tab1",
    });

    expect(tabButtons[1].getAttribute("aria-disabled")).toBe("true");
    expect(tabButtons[1].hasAttribute("disabled")).toBe(false);
    expect(tabButtons[1].tabIndex).toBe(-1);
  });

  it("tabs-render-vertical: aria-orientation=vertical on tablist + collection-nav attr", async () => {
    const { tablistEl } = await buildTabsDom({
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
// tabs-key-*: keyboard interaction via the real lv-tabs controller.
// ---------------------------------------------------------------------------

describe("tabs runtime — keyboard interaction (real lv-tabs controller, APG Tabs model)", () => {
  it("tabs-key-arrow-right-automatic: ArrowRight moves focus + fires activate in automatic mode", async () => {
    const { tablistEl, tabButtons, calledActions } = await buildTabsDom({
      tabs: [
        { id: "tab1", label: "Tab 1" },
        { id: "tab2", label: "Tab 2" },
        { id: "tab3", label: "Tab 3" },
      ],
      activeTabId: "tab1",
      selectAction: "activate",
    });

    expect(tabButtons[0].tabIndex).toBe(0);
    expect(tabButtons[1].tabIndex).toBe(-1);

    key(tablistEl, "ArrowRight");

    expect(document.activeElement).toBe(tabButtons[1]);
    expect(tabButtons[1].tabIndex).toBe(0);
    expect(tabButtons[0].tabIndex).toBe(-1);

    await new Promise<void>((r) => setTimeout(r, 20));
    expect(calledActions).toContain("activate");
  });

  it("tabs-key-arrow-left-automatic: ArrowLeft moves focus backwards + fires activate", async () => {
    const { tablistEl, tabButtons, calledActions } = await buildTabsDom({
      tabs: [
        { id: "tab1", label: "Tab 1" },
        { id: "tab2", label: "Tab 2" },
        { id: "tab3", label: "Tab 3" },
      ],
      activeTabId: "tab1",
      selectAction: "activate",
    });

    key(tablistEl, "ArrowRight");
    expect(document.activeElement).toBe(tabButtons[1]);

    key(tablistEl, "ArrowLeft");
    expect(document.activeElement).toBe(tabButtons[0]);
    expect(tabButtons[0].tabIndex).toBe(0);

    await new Promise<void>((r) => setTimeout(r, 20));
    expect(calledActions.length).toBeGreaterThan(0);
  });

  it("tabs-key-wrap: ArrowRight at last tab wraps to first", async () => {
    const { tablistEl, tabButtons } = await buildTabsDom({
      tabs: [
        { id: "tab1", label: "Tab 1" },
        { id: "tab2", label: "Tab 2" },
        { id: "tab3", label: "Tab 3" },
      ],
      activeTabId: "tab1",
    });

    key(tablistEl, "End");
    expect(document.activeElement).toBe(tabButtons[2]);

    key(tablistEl, "ArrowRight");
    expect(document.activeElement).toBe(tabButtons[0]);
    expect(tabButtons[0].tabIndex).toBe(0);
  });

  it("tabs-key-arrow-vertical: vertical tablist uses ArrowDown/Up; cross-axis ArrowRight is a no-op", async () => {
    const { tablistEl, tabButtons } = await buildTabsDom({
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

    const activeBefore = document.activeElement;
    key(tablistEl, "ArrowRight");
    expect(document.activeElement).toBe(activeBefore);
  });

  it("tabs-key-home-end: Home moves to first, End to last", async () => {
    const { tablistEl, tabButtons } = await buildTabsDom({
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

  it("tabs-key-skip-disabled: ArrowRight skips disabled tabs", async () => {
    const { tablistEl, tabButtons } = await buildTabsDom({
      tabs: [
        { id: "tab1", label: "Tab 1" },
        { id: "tab2", label: "Tab 2", disabled: true },
        { id: "tab3", label: "Tab 3" },
      ],
      activeTabId: "tab1",
    });

    key(tablistEl, "ArrowRight");
    expect(document.activeElement).toBe(tabButtons[2]);
    expect(tabButtons[2].tabIndex).toBe(0);
  });

  it("tabs-key-manual-activation: ArrowRight moves focus but does NOT fire action", async () => {
    const { tablistEl, tabButtons, calledActions } = await buildTabsDom({
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

    expect(document.activeElement).toBe(tabButtons[1]);
    expect(calledActions).not.toContain("activate");
  });

  it("tabs-key-manual-activation-enter: Enter fires the action after focus moves", async () => {
    const { tablistEl, tabButtons, calledActions } = await buildTabsDom({
      tabs: [
        { id: "tab1", label: "Tab 1" },
        { id: "tab2", label: "Tab 2" },
      ],
      activeTabId: "tab1",
      manualActivation: true,
      selectAction: "activate",
    });

    key(tablistEl, "ArrowRight");
    expect(document.activeElement).toBe(tabButtons[1]);

    key(tablistEl, "Enter");
    await new Promise<void>((r) => setTimeout(r, 20));
    expect(calledActions).toContain("activate");
  });

  it("tabs-key-manual-activation-space: Space fires the action after focus moves", async () => {
    const { tablistEl, calledActions } = await buildTabsDom({
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
// tabs-doctrine-*: the controlled / uncontrolled wire doctrine (the whole-contract rule:
// assert BOTH branches, never just the firing one).
// ---------------------------------------------------------------------------

describe("tabs runtime — controlled/uncontrolled wire doctrine", () => {
  it("tabs-doctrine-controlled-fires: a select action set => ArrowRight fires it exactly once", async () => {
    const { tablistEl, calledActions } = await buildTabsDom({
      tabs: [
        { id: "tab1", label: "Tab 1" },
        { id: "tab2", label: "Tab 2" },
      ],
      activeTabId: "tab1",
      selectAction: "activate",
    });

    key(tablistEl, "ArrowRight");
    await new Promise<void>((r) => setTimeout(r, 20));
    expect(calledActions.filter((a) => a === "activate")).toHaveLength(1);
  });

  it("tabs-doctrine-uncontrolled-silent: no select action => focus moves but ZERO wire calls (the 410 guard)", async () => {
    const { tablistEl, tabButtons, calledActions } = await buildTabsDom({
      tabs: [
        { id: "tab1", label: "Tab 1" },
        { id: "tab2", label: "Tab 2" },
      ],
      activeTabId: "tab1",
      // no selectAction => UNCONTROLLED tablist (no data-lievit-collection-select-action attr).
    });

    key(tablistEl, "ArrowRight");
    key(tablistEl, "End");
    key(tablistEl, "Home");
    await new Promise<void>((r) => setTimeout(r, 20));

    // Focus still rove client-side, but nothing rode the wire.
    expect(document.activeElement).toBe(tabButtons[0]);
    expect(calledActions).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// tabs-focus-*: roving tabindex state after navigation.
// ---------------------------------------------------------------------------

describe("tabs runtime — roving tabindex state", () => {
  it("tabs-focus-roving-tabindex: after ArrowRight, tabindex=0 on new item; -1 on all others", async () => {
    const { tablistEl, tabButtons } = await buildTabsDom({
      tabs: [
        { id: "tab1", label: "Tab 1" },
        { id: "tab2", label: "Tab 2" },
        { id: "tab3", label: "Tab 3" },
      ],
      activeTabId: "tab1",
    });

    key(tablistEl, "ArrowRight");

    expect(tabButtons[0].tabIndex).toBe(-1);
    expect(tabButtons[1].tabIndex).toBe(0);
    expect(tabButtons[2].tabIndex).toBe(-1);
  });

  it("tabs-focus-no-aria-activedescendant: roving mode must NOT set aria-activedescendant", async () => {
    const { tablistEl } = await buildTabsDom({
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

// ---------------------------------------------------------------------------
// tabs-morph-*: morph-safety. Stimulus owns connect/disconnect, so a wire morph that replays the
// tablist must NOT stack listeners (one gesture => one effect), and a morph that removes the
// tablist must leave the detached node inert.
// ---------------------------------------------------------------------------

describe("tabs runtime — morph-safety (real lievit morph)", () => {
  it("after a real morph, ArrowRight still fires activate EXACTLY once (no stacked listeners)", async () => {
    const opts: BuildOpts = {
      tabs: [
        { id: "tab1", label: "Tab 1" },
        { id: "tab2", label: "Tab 2" },
        { id: "tab3", label: "Tab 3" },
      ],
      activeTabId: "tab1",
      selectAction: "activate",
    };
    const { componentRoot, calledActions } = await buildTabsDom(opts);

    // A real lievit wire morph re-renders the component subtree (idiomorph) with identical markup.
    // The controller must NOT be double-connected and the keydown handler must stay single.
    morph(componentRoot, tabsHtml(opts));
    await flushStimulus();

    const tablistEl = componentRoot.querySelector<HTMLElement>('[role="tablist"]')!;
    key(tablistEl, "ArrowRight");

    await new Promise<void>((r) => setTimeout(r, 20));
    expect(calledActions.filter((a) => a === "activate")).toHaveLength(1);
  });

  it("a tablist removed by a morph stops firing (disconnect tears the listener down)", async () => {
    const { componentRoot, tablistEl, calledActions } = await buildTabsDom({
      tabs: [
        { id: "tab1", label: "Tab 1" },
        { id: "tab2", label: "Tab 2" },
      ],
      activeTabId: "tab1",
      selectAction: "activate",
    });

    // Morph the tablist out of the tree.
    morph(
      componentRoot,
      `<div data-lievit-component="com.example.TestTabs" data-lievit-snapshot="s2"><span>gone</span></div>`,
    );
    await flushStimulus();

    // The detached tablist must no longer reach a live controller -> no focus move, no wire call.
    key(tablistEl, "ArrowRight");
    await new Promise<void>((r) => setTimeout(r, 20));
    expect(calledActions).toHaveLength(0);
  });
});
