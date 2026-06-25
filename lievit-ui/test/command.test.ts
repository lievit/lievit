/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * Tests for the v-next command palette (registry/jte/command.jte) converted to the
 * `lv-command` Stimulus controller. The palette is a CONTROLLED/UNCONTROLLED overlay rendered
 * by the caller's Wire component.
 *
 * Substrate: happy-dom + the REAL @hotwired/stimulus Application started by startStimulus()
 * (auto-loads controllers by filename) + the REAL LievitRuntime behind a fetch stub + the REAL
 * lievit wire morph. No mocked $lievit, no mocked runtime: the stub captures the actual `_calls`
 * the runtime POSTs. flushStimulus() awaits the MutationObserver.
 *
 * Coverage (every branch the command.enhancer + focus-trap.enhancer suite had, plus the doctrine
 * and morph-safety the enhancer test could not state):
 *   - commandFilter: pure, DOM-free filter (blank query, substring, accent, no match)
 *   - client-side filtering: seed, hide non-matching, empty state, restore on clear, group hiding
 *   - Enter dispatch: executeAction, openPageAction, href navigation, disabled / no-active no-op
 *   - Backspace in nested page fires backToRoot (and the no-op branches)
 *   - close doctrine: Escape + global shortcut fire close ONLY when controlled (data-lv-wire-close);
 *     uncontrolled => ZERO wire call (the wire-410 page-expired contract, BOTH branches)
 *   - focus trap: initial focus moves into the panel on connect
 *   - morph-safety: after a real morph one keystroke filters once / one shortcut fires once; a panel
 *     removed by a morph stops firing (disconnect tore the listeners down)
 */
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";

import { LievitRuntime } from "../runtime/runtime.js";
import { morph } from "../runtime/morph.js";
import { startStimulus, stopStimulus, flushStimulus } from "../runtime/stimulus/application.js";
import { commandFilter } from "../runtime/stimulus/controllers/lv-command-controller.js";

// ---------------------------------------------------------------------------
// Runtime stub (captures the wire actions the runtime POSTs)
// ---------------------------------------------------------------------------

function makeRuntime(): { runtime: LievitRuntime; calledActions: string[] } {
  const calledActions: string[] = [];
  const fetchImpl = vi.fn(async (_url: unknown, init?: RequestInit) => {
    const body = JSON.parse((init?.body as string) ?? "{}") as Record<string, unknown>;
    const calls = body._calls as string[] | undefined;
    if (calls) {
      calledActions.push(...calls);
    }
    return new Response("<div></div>", {
      status: 200,
      headers: { "Lievit-Snapshot": "s2" },
    });
  });
  const runtime = new LievitRuntime({ fetchImpl: fetchImpl as unknown as typeof fetch });
  return { runtime, calledActions };
}

// ---------------------------------------------------------------------------
// DOM builder (shaped exactly as command.jte emits when open=true)
// ---------------------------------------------------------------------------

type ItemDef = {
  label: string;
  id?: string;
  group?: string;
  disabled?: boolean;
  pageId?: string;
  href?: string;
};

interface BuildOpts {
  items?: ItemDef[];
  groups?: string[];
  page?: string;
  shortcut?: string;
  /** When present, the panel is wire-CONTROLLED (data-lv-wire-close). Omit for uncontrolled. */
  wireClose?: string;
  executeAction?: string;
  openPageAction?: string;
  backToRootAction?: string;
}

interface Mounted {
  componentRoot: HTMLElement;
  panel: HTMLElement;
  input: HTMLInputElement;
  listbox: HTMLElement;
  emptyEl: HTMLElement;
}

function buildOptionLi(item: ItemDef): HTMLElement {
  const li = document.createElement("li");
  li.id = `opt-${item.id ?? item.label}`;
  li.setAttribute("role", "option");
  li.setAttribute("data-slot", "option");
  li.setAttribute("data-id", item.id ?? item.label);
  li.setAttribute("aria-selected", "false");
  li.setAttribute("data-lievit-item", "");
  if (item.disabled === true) {
    li.setAttribute("aria-disabled", "true");
  }
  if (item.pageId != null && item.pageId !== "") {
    li.setAttribute("data-page-id", item.pageId);
  }
  if (item.href != null && item.href !== "") {
    li.setAttribute("data-href", item.href);
  }

  const inner = document.createElement("div");
  inner.setAttribute("data-slot", "option-inner");
  const labelSpan = document.createElement("span");
  // The controller reads the label from the non-aria-hidden span inside option-inner.
  labelSpan.textContent = item.label;
  inner.appendChild(labelSpan);
  li.appendChild(inner);
  return li;
}

function buildPanel(opts: BuildOpts): Mounted {
  document.body.innerHTML = "";
  const items = opts.items ?? [];
  const groups = opts.groups ?? [];

  const componentRoot = document.createElement("div");
  componentRoot.setAttribute("data-lievit-component", "com.example.Cmd");
  componentRoot.setAttribute("data-lievit-id", `cid-${Math.random().toString(36).slice(2)}`);
  componentRoot.setAttribute("data-lievit-snapshot", "s1");

  const panel = document.createElement("div");
  panel.setAttribute("data-slot", "panel");
  panel.setAttribute("data-controller", "lv-command");
  if (opts.wireClose != null) {
    panel.setAttribute("data-lv-wire-close", opts.wireClose);
  }
  panel.setAttribute("data-page", opts.page ?? "");
  panel.setAttribute("data-shortcut", opts.shortcut ?? "mod+k");
  if (opts.executeAction != null) {
    panel.setAttribute("data-execute-action", opts.executeAction);
  }
  if (opts.openPageAction != null) {
    panel.setAttribute("data-open-page-action", opts.openPageAction);
  }
  if (opts.backToRootAction != null) {
    panel.setAttribute("data-back-to-root-action", opts.backToRootAction);
  }

  // Search input (the data-action + target the controller binds against).
  const inputWrapper = document.createElement("div");
  inputWrapper.setAttribute("data-slot", "search-input");
  const input = document.createElement("input");
  input.id = "cmd-input";
  input.setAttribute("role", "combobox");
  input.setAttribute("aria-label", "Search commands");
  input.setAttribute("aria-controls", "cmd-listbox");
  input.setAttribute("aria-activedescendant", "");
  input.setAttribute("autocomplete", "off");
  input.setAttribute("data-lv-command-target", "input");
  input.setAttribute("data-action", "input->lv-command#filter keydown->lv-command#onInputKey");
  inputWrapper.appendChild(input);
  panel.appendChild(inputWrapper);

  // Listbox (collection-nav contract stays; the controller never touches it).
  const listbox = document.createElement("ul");
  listbox.id = "cmd-listbox";
  listbox.setAttribute("role", "listbox");
  listbox.setAttribute("aria-label", "Commands");
  listbox.setAttribute("data-slot", "listbox");
  listbox.setAttribute("data-lievit-collection", "");
  listbox.setAttribute("data-lievit-collection-orientation", "vertical");
  listbox.setAttribute("data-lievit-collection-activedescendant-target", "#cmd-input");

  if (groups.length > 0) {
    for (const groupName of groups) {
      const groupLi = document.createElement("li");
      groupLi.setAttribute("role", "presentation");
      groupLi.setAttribute("data-slot", "group");
      groupLi.setAttribute("data-group-name", groupName);

      const labelSpan = document.createElement("span");
      labelSpan.id = `grp-${groupName}-label`;
      labelSpan.setAttribute("data-slot", "group-label");
      labelSpan.textContent = groupName;
      groupLi.appendChild(labelSpan);

      const groupUl = document.createElement("ul");
      groupUl.setAttribute("role", "group");
      groupUl.setAttribute("aria-labelledby", labelSpan.id);
      for (const item of items.filter((it) => it.group === groupName)) {
        groupUl.appendChild(buildOptionLi(item));
      }
      groupLi.appendChild(groupUl);
      listbox.appendChild(groupLi);
    }
    for (const item of items.filter((it) => !it.group)) {
      listbox.appendChild(buildOptionLi(item));
    }
  } else {
    for (const item of items) {
      listbox.appendChild(buildOptionLi(item));
    }
  }

  // Empty state.
  const emptyLi = document.createElement("li");
  emptyLi.setAttribute("role", "presentation");
  emptyLi.setAttribute("data-slot", "empty");
  const emptyDiv = document.createElement("div");
  emptyDiv.setAttribute("role", "status");
  emptyDiv.setAttribute("aria-live", "polite");
  emptyDiv.textContent = "No commands found.";
  emptyLi.appendChild(emptyDiv);
  listbox.appendChild(emptyLi);

  panel.appendChild(listbox);
  componentRoot.appendChild(panel);
  document.body.appendChild(componentRoot);

  return { componentRoot, panel, input, listbox, emptyEl: emptyLi };
}

/** Build the DOM, start the real Stimulus app + runtime, and await the MutationObserver. */
async function mount(opts: BuildOpts): Promise<Mounted & { calledActions: string[] }> {
  const built = buildPanel(opts);
  const { runtime, calledActions } = makeRuntime();
  startStimulus({ runtime });
  await flushStimulus();
  return { ...built, calledActions };
}

/** Simulate the user typing into the search input (Stimulus filter action fires). */
function type(input: HTMLInputElement, q: string): void {
  input.value = q;
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

function key(target: EventTarget, init: KeyboardEventInit): void {
  target.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, ...init }));
}

/** Visible (not hidden) option labels. */
function visibleLabels(panel: HTMLElement): string[] {
  return Array.from(panel.querySelectorAll<HTMLElement>("[data-lievit-item]"))
    .filter((el) => !el.hidden)
    .map((el) => {
      const span = el.querySelector<HTMLElement>(
        "[data-slot='option-inner'] span:not([aria-hidden])",
      );
      return span?.textContent?.trim() ?? "";
    });
}

const settle = (): Promise<unknown> => new Promise((r) => setTimeout(r, 10));

beforeEach(() => {
  document.body.innerHTML = "";
});

afterEach(async () => {
  // Clear the DOM FIRST and let Stimulus's MutationObserver disconnect the controllers (tearing
  // down their document-scoped listeners: the shortcut chord + the FocusTrap), THEN stop the app.
  // The controller binds document listeners (like lv-sidebar), so a leaked one would fire into the
  // next test's shared wire bridge — clearing while the observer is live prevents that.
  document.body.innerHTML = "";
  await flushStimulus();
  stopStimulus();
});

// ---------------------------------------------------------------------------
// commandFilter (pure, DOM-free)
// ---------------------------------------------------------------------------

describe("commandFilter (pure, DOM-free)", () => {
  const labels = ["Dashboard", "New contact", "Città di Parma", "Settings"];

  it("a blank query shows every item", () => {
    expect(commandFilter(labels, "")).toEqual([true, true, true, true]);
    expect(commandFilter(labels, "   ")).toEqual([true, true, true, true]);
  });

  it("substring match anywhere in the label, case-insensitive", () => {
    expect(commandFilter(labels, "set")).toEqual([false, false, false, true]);
    expect(commandFilter(labels, "CONT")).toEqual([false, true, false, false]);
  });

  it("accent-insensitive: 'citta' matches 'Città'", () => {
    expect(commandFilter(labels, "citta")).toEqual([false, false, true, false]);
  });

  it("no match returns all false", () => {
    expect(commandFilter(labels, "zzz")).toEqual([false, false, false, false]);
  });
});

// ---------------------------------------------------------------------------
// Client-side filtering (real controller via the data-action wiring)
// ---------------------------------------------------------------------------

describe("lv-command: client-side filtering", () => {
  it("seeds with every item visible and the empty state hidden on connect", async () => {
    const { panel, emptyEl } = await mount({
      wireClose: "close",
      items: [{ label: "Dashboard" }, { label: "Settings" }, { label: "New contact" }],
    });
    expect(visibleLabels(panel)).toEqual(["Dashboard", "Settings", "New contact"]);
    expect(emptyEl.hidden).toBe(true);
  });

  it("typing a query hides non-matching items in place", async () => {
    const { panel, input } = await mount({
      wireClose: "close",
      items: [{ label: "Dashboard" }, { label: "Settings" }, { label: "New contact" }],
    });
    type(input, "set");
    expect(visibleLabels(panel)).toEqual(["Settings"]);
  });

  it("shows the empty state when nothing matches", async () => {
    const { panel, input, emptyEl } = await mount({
      wireClose: "close",
      items: [{ label: "Dashboard" }, { label: "Settings" }],
    });
    type(input, "zzz");
    expect(visibleLabels(panel)).toEqual([]);
    expect(emptyEl.hidden).toBe(false);
  });

  it("restores all items and hides the empty state when the query is cleared", async () => {
    const { panel, input, emptyEl } = await mount({
      wireClose: "close",
      items: [{ label: "Dashboard" }, { label: "Settings" }],
    });
    type(input, "zzz");
    type(input, "");
    expect(visibleLabels(panel)).toEqual(["Dashboard", "Settings"]);
    expect(emptyEl.hidden).toBe(true);
  });
});

describe("lv-command: group visibility", () => {
  it("hides a group container when all its items are filtered out", async () => {
    const { panel, input } = await mount({
      wireClose: "close",
      items: [
        { label: "Dashboard", group: "Navigation" },
        { label: "Settings", group: "Navigation" },
        { label: "New contact", group: "Actions" },
      ],
      groups: ["Navigation", "Actions"],
    });
    type(input, "contact");
    expect(panel.querySelector<HTMLElement>("[data-group-name='Navigation']")?.hidden).toBe(true);
    expect(panel.querySelector<HTMLElement>("[data-group-name='Actions']")?.hidden).toBe(false);
  });

  it("shows a group when at least one of its items matches", async () => {
    const { panel, input } = await mount({
      wireClose: "close",
      items: [
        { label: "Dashboard", group: "Navigation" },
        { label: "Settings", group: "Navigation" },
      ],
      groups: ["Navigation"],
    });
    type(input, "dash");
    expect(panel.querySelector<HTMLElement>("[data-group-name='Navigation']")?.hidden).toBe(false);
    expect(visibleLabels(panel)).toEqual(["Dashboard"]);
  });
});

// ---------------------------------------------------------------------------
// Enter dispatch
// ---------------------------------------------------------------------------

describe("lv-command: Enter dispatch", () => {
  it("Enter fires executeAction with the active item's data-id", async () => {
    const { input, calledActions } = await mount({
      wireClose: "close",
      items: [{ label: "Dashboard", id: "go-dashboard" }],
    });
    input.setAttribute("aria-activedescendant", "opt-go-dashboard");
    key(input, { key: "Enter" });
    await settle();
    expect(calledActions).toContain("executeCommand");
  });

  it("Enter fires openPageAction for an item with data-page-id", async () => {
    const { input, calledActions } = await mount({
      wireClose: "close",
      items: [{ label: "File commands", id: "file-page", pageId: "file" }],
    });
    input.setAttribute("aria-activedescendant", "opt-file-page");
    key(input, { key: "Enter" });
    await settle();
    expect(calledActions).toContain("openPage");
  });

  it("Enter on an href item navigates client-side and fires NO wire action", async () => {
    const { input, calledActions } = await mount({
      wireClose: "close",
      items: [{ label: "External", id: "ext", href: "#go" }],
    });
    input.setAttribute("aria-activedescendant", "opt-ext");
    key(input, { key: "Enter" });
    await settle();
    expect(calledActions).toEqual([]);
  });

  it("Enter on a disabled item is a no-op", async () => {
    const { input, calledActions } = await mount({
      wireClose: "close",
      items: [{ label: "Disabled", id: "disabled-cmd", disabled: true }],
    });
    input.setAttribute("aria-activedescendant", "opt-disabled-cmd");
    key(input, { key: "Enter" });
    await settle();
    expect(calledActions).toEqual([]);
  });

  it("Enter with no aria-activedescendant is a no-op", async () => {
    const { input, calledActions } = await mount({
      wireClose: "close",
      items: [{ label: "Dashboard" }],
    });
    input.setAttribute("aria-activedescendant", "");
    key(input, { key: "Enter" });
    await settle();
    expect(calledActions).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Backspace in a nested page
// ---------------------------------------------------------------------------

describe("lv-command: Backspace fires backToRoot in a nested page", () => {
  it("Backspace with an empty input in a nested page fires backToRootAction", async () => {
    const { input, calledActions } = await mount({
      wireClose: "close",
      items: [{ label: "New file" }],
      page: "File commands",
    });
    input.value = "";
    key(input, { key: "Backspace" });
    await settle();
    expect(calledActions).toContain("backToRoot");
  });

  it("Backspace with a non-empty input in a nested page is a no-op (normal text delete)", async () => {
    const { input, calledActions } = await mount({
      wireClose: "close",
      items: [{ label: "New file" }],
      page: "File commands",
    });
    input.value = "ne";
    key(input, { key: "Backspace" });
    await settle();
    expect(calledActions).toEqual([]);
  });

  it("Backspace at the root page (empty page) fires no action", async () => {
    const { input, calledActions } = await mount({
      wireClose: "close",
      items: [{ label: "Dashboard" }],
      page: "",
    });
    input.value = "";
    key(input, { key: "Backspace" });
    await settle();
    expect(calledActions).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Close doctrine: controlled fires / uncontrolled silent (Escape + shortcut)
// ---------------------------------------------------------------------------

describe("lv-command: close doctrine (the wire-410 contract, BOTH branches)", () => {
  it("CONTROLLED: Ctrl+K fires the close action exactly once", async () => {
    const { calledActions } = await mount({
      wireClose: "close",
      shortcut: "mod+k",
      items: [{ label: "Dashboard" }],
    });
    key(document, { key: "k", ctrlKey: true });
    await settle();
    expect(calledActions.filter((a) => a === "close")).toHaveLength(1);
  });

  it("CONTROLLED: a custom close action via data-lv-wire-close is the one fired", async () => {
    const { calledActions } = await mount({
      wireClose: "togglePalette",
      shortcut: "mod+k",
      items: [{ label: "Dashboard" }],
    });
    key(document, { key: "k", ctrlKey: true });
    await settle();
    expect(calledActions).toContain("togglePalette");
    expect(calledActions).not.toContain("close");
  });

  it("UNCONTROLLED: Ctrl+K fires NO wire call (no data-lv-wire-close)", async () => {
    const { calledActions } = await mount({
      shortcut: "mod+k",
      items: [{ label: "Dashboard" }],
    });
    key(document, { key: "k", ctrlKey: true });
    await settle();
    expect(calledActions).toHaveLength(0);
  });

  it("CONTROLLED: Escape fires the close action exactly once", async () => {
    const { calledActions } = await mount({
      wireClose: "close",
      items: [{ label: "Dashboard" }],
    });
    key(document, { key: "Escape" });
    await settle();
    expect(calledActions.filter((a) => a === "close")).toHaveLength(1);
  });

  it("UNCONTROLLED: Escape fires NO wire call (the 410 page-expired regression)", async () => {
    const { calledActions } = await mount({
      items: [{ label: "Dashboard" }],
    });
    key(document, { key: "Escape" });
    await settle();
    expect(calledActions).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Focus trap (shared FocusTrap)
// ---------------------------------------------------------------------------

describe("lv-command: focus trap", () => {
  it("moves initial focus into the panel (the search input) on connect", async () => {
    const { input } = await mount({
      wireClose: "close",
      items: [{ label: "Dashboard" }, { label: "Settings" }],
    });
    expect(document.activeElement).toBe(input);
  });
});

// ---------------------------------------------------------------------------
// Morph-safety (real lievit wire morph)
// ---------------------------------------------------------------------------

describe("lv-command: morph-safety", () => {
  it("after a real morph one keystroke filters once and one shortcut fires close once", async () => {
    const { componentRoot, calledActions } = await mount({
      wireClose: "close",
      shortcut: "mod+k",
      items: [{ label: "Dashboard" }, { label: "Settings" }],
    });

    // A real wire morph re-renders the subtree (idiomorph). Identical markup, so the controller
    // must not double-connect and the listeners must stay single.
    morph(componentRoot, componentRoot.outerHTML);
    await flushStimulus();

    const panel = componentRoot.querySelector<HTMLElement>("[data-slot='panel']")!;
    const input = componentRoot.querySelector<HTMLInputElement>("#cmd-input")!;
    type(input, "set");
    expect(visibleLabels(panel)).toEqual(["Settings"]);

    key(document, { key: "k", ctrlKey: true });
    await settle();
    expect(calledActions.filter((a) => a === "close")).toHaveLength(1);
  });

  it("a panel removed by a morph stops firing (disconnect tore the listeners down)", async () => {
    const { componentRoot, calledActions } = await mount({
      wireClose: "close",
      shortcut: "mod+k",
      items: [{ label: "Dashboard" }],
    });

    morph(
      componentRoot,
      `<div data-lievit-component="com.example.Cmd" data-lievit-snapshot="s2"><span>gone</span></div>`,
    );
    await flushStimulus();

    // The document-level shortcut listener was removed on disconnect: no wire call.
    key(document, { key: "k", ctrlKey: true });
    await settle();
    expect(calledActions).toHaveLength(0);
  });
});
