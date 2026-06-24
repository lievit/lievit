/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * Tests for the v-next command palette (registry/jte/command.jte + command.enhancer.ts).
 * The palette is a CONTROLLED/UNCONTROLLED overlay rendered by the caller's Wire component.
 *
 * Coverage:
 *   - commandFilter: pure, DOM-free filter (blank query, substring, accent, no match)
 *   - activatePanel: filtering visible items, group hiding, empty state toggle
 *   - Enter dispatch: executeAction, openPageAction, href navigation
 *   - Backspace in nested page fires backToRootAction
 *   - Global shortcut (Ctrl+K) fires close while panel is in DOM
 *   - Idempotency of activatePanel
 *   - installCommandEnhancer: wires panels via onComponentInit + cleans up on afterCall
 *
 * Substrate: happy-dom (real LievitRuntime, real DOM, no mocked $lievit).
 * Pattern: build DOM, then start runtime so onComponentInit fires on the already-present panel.
 */
import { afterEach, describe, it, expect, vi } from "vitest";

import { LievitRuntime } from "../runtime/runtime.js";
import {
  commandFilter,
  activatePanel,
  installCommandEnhancer,
} from "../registry/jte/command.enhancer.js";

// ---------------------------------------------------------------------------
// DOM helpers
// ---------------------------------------------------------------------------

type ItemDef = {
  label: string;
  id?: string;
  group?: string;
  disabled?: boolean;
  pageId?: string;
  href?: string;
  intent?: string;
};

/**
 * Build a DOM shaped like command.jte renders (open=true, flat or grouped).
 * Mounts the panel inside a component root so the runtime can find it.
 */
function buildPanel(opts: {
  items?: ItemDef[];
  groups?: string[];
  page?: string;
  shortcut?: string;
  escapeAction?: string;
  executeAction?: string;
  openPageAction?: string;
  backToRootAction?: string;
  /** When true, wrap in a lievit component root and return both. */
  withComponentRoot?: boolean;
}): {
  componentRoot: HTMLElement;
  panel: HTMLElement;
  input: HTMLInputElement;
  listbox: HTMLElement;
  emptyEl: HTMLElement;
} {
  document.body.innerHTML = "";
  const items = opts.items ?? [];
  const groups = opts.groups ?? [];

  const componentRoot = document.createElement("div");
  componentRoot.setAttribute("data-lievit-component", "com.example.Cmd");
  componentRoot.setAttribute("data-lievit-id", `cid-${Math.random().toString(36).slice(2)}`);
  componentRoot.setAttribute("data-lievit-snapshot", "s1");

  const panel = document.createElement("div");
  panel.setAttribute("data-slot", "panel");
  panel.setAttribute("data-lievit-command", "");
  panel.setAttribute("data-lievit-focus-trap", "");
  panel.setAttribute("data-lievit-escape-action", opts.escapeAction ?? "close");
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

  // Search input.
  const inputWrapper = document.createElement("div");
  inputWrapper.setAttribute("data-slot", "search-input");
  const input = document.createElement("input");
  input.id = "cmd-input";
  input.setAttribute("role", "combobox");
  input.setAttribute("aria-label", "Search commands");
  input.setAttribute("aria-controls", "cmd-listbox");
  input.setAttribute("aria-haspopup", "listbox");
  input.setAttribute("aria-autocomplete", "list");
  input.setAttribute("aria-expanded", "true");
  input.setAttribute("aria-activedescendant", "");
  input.setAttribute("autocomplete", "off");
  inputWrapper.appendChild(input);
  panel.appendChild(inputWrapper);

  // Listbox.
  const listbox = document.createElement("ul");
  listbox.id = "cmd-listbox";
  listbox.setAttribute("role", "listbox");
  listbox.setAttribute("aria-label", "Commands");
  listbox.setAttribute("data-slot", "listbox");
  listbox.setAttribute("data-lievit-collection", "");
  listbox.setAttribute("data-lievit-collection-orientation", "vertical");
  listbox.setAttribute("data-lievit-collection-activedescendant-target", "#cmd-input");

  if (groups.length > 0) {
    // Grouped rendering.
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
    // Ungrouped items after the groups.
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
    li.dataset["pageId"] = item.pageId;
  }
  if (item.href != null && item.href !== "") {
    li.setAttribute("data-href", item.href);
    li.dataset["href"] = item.href;
  }
  li.dataset["id"] = item.id ?? item.label;

  const inner = document.createElement("div");
  inner.setAttribute("data-slot", "option-inner");
  const labelSpan = document.createElement("span");
  // The enhancer reads the label from the non-aria-hidden span inside option-inner.
  labelSpan.textContent = item.label;
  inner.appendChild(labelSpan);
  li.appendChild(inner);
  return li;
}

function makeFetchImpl(actions: string[]): typeof fetch {
  return vi.fn(async (_url: unknown, init?: RequestInit) => {
    const body = JSON.parse((init?.body as string) ?? "{}") as Record<string, unknown>;
    const calls = body._calls as string[] | undefined;
    if (calls != null) {
      actions.push(...calls);
    }
    return new Response("<div></div>", {
      status: 200,
      headers: { "Lievit-Snapshot": "s2" },
    });
  }) as unknown as typeof fetch;
}

/** Simulate the user typing into the search input. */
function type(input: HTMLInputElement, q: string): void {
  input.value = q;
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

/** Visible option labels (not hidden). */
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

// ---------------------------------------------------------------------------
// Teardown
// ---------------------------------------------------------------------------

afterEach(() => {
  document.body.innerHTML = "";
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
// activatePanel: filtering + empty state
// ---------------------------------------------------------------------------

describe("activatePanel: client-side filtering", () => {
  it("seeds with every item visible and empty state hidden", () => {
    const actions: string[] = [];
    const runtime = new LievitRuntime({ fetchImpl: makeFetchImpl(actions) });
    const { panel, emptyEl } = buildPanel({
      items: [
        { label: "Dashboard" },
        { label: "Settings" },
        { label: "New contact" },
      ],
    });
    activatePanel(panel, runtime);
    expect(visibleLabels(panel)).toEqual(["Dashboard", "Settings", "New contact"]);
    expect(emptyEl.hidden).toBe(true);
  });

  it("typing a query hides non-matching items in-place", () => {
    const actions: string[] = [];
    const runtime = new LievitRuntime({ fetchImpl: makeFetchImpl(actions) });
    const { panel, input } = buildPanel({
      items: [{ label: "Dashboard" }, { label: "Settings" }, { label: "New contact" }],
    });
    activatePanel(panel, runtime);
    type(input, "set");
    expect(visibleLabels(panel)).toEqual(["Settings"]);
  });

  it("shows empty state when nothing matches", () => {
    const actions: string[] = [];
    const runtime = new LievitRuntime({ fetchImpl: makeFetchImpl(actions) });
    const { panel, input, emptyEl } = buildPanel({
      items: [{ label: "Dashboard" }, { label: "Settings" }],
    });
    activatePanel(panel, runtime);
    type(input, "zzz");
    expect(visibleLabels(panel)).toEqual([]);
    expect(emptyEl.hidden).toBe(false);
  });

  it("restores all items and hides empty state when query is cleared", () => {
    const actions: string[] = [];
    const runtime = new LievitRuntime({ fetchImpl: makeFetchImpl(actions) });
    const { panel, input, emptyEl } = buildPanel({
      items: [{ label: "Dashboard" }, { label: "Settings" }],
    });
    activatePanel(panel, runtime);
    type(input, "zzz");
    type(input, "");
    expect(visibleLabels(panel)).toEqual(["Dashboard", "Settings"]);
    expect(emptyEl.hidden).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// activatePanel: group hiding
// ---------------------------------------------------------------------------

describe("activatePanel: group visibility", () => {
  it("hides a group container when all its items are filtered out", () => {
    const actions: string[] = [];
    const runtime = new LievitRuntime({ fetchImpl: makeFetchImpl(actions) });
    const { panel, input } = buildPanel({
      items: [
        { label: "Dashboard", group: "Navigation" },
        { label: "Settings", group: "Navigation" },
        { label: "New contact", group: "Actions" },
      ],
      groups: ["Navigation", "Actions"],
    });
    activatePanel(panel, runtime);
    type(input, "contact");
    const navGroup = panel.querySelector<HTMLElement>("[data-group-name='Navigation']");
    const actGroup = panel.querySelector<HTMLElement>("[data-group-name='Actions']");
    expect(navGroup?.hidden).toBe(true);
    expect(actGroup?.hidden).toBe(false);
  });

  it("shows a group when at least one of its items matches", () => {
    const actions: string[] = [];
    const runtime = new LievitRuntime({ fetchImpl: makeFetchImpl(actions) });
    const { panel, input } = buildPanel({
      items: [
        { label: "Dashboard", group: "Navigation" },
        { label: "Settings", group: "Navigation" },
      ],
      groups: ["Navigation"],
    });
    activatePanel(panel, runtime);
    type(input, "dash");
    const navGroup = panel.querySelector<HTMLElement>("[data-group-name='Navigation']");
    expect(navGroup?.hidden).toBe(false);
    expect(visibleLabels(panel)).toEqual(["Dashboard"]);
  });
});

// ---------------------------------------------------------------------------
// activatePanel: Enter dispatch
// ---------------------------------------------------------------------------

describe("activatePanel: Enter dispatch", () => {
  it("Enter fires executeAction with the active item's data-id", async () => {
    const actions: string[] = [];
    const runtime = new LievitRuntime({ fetchImpl: makeFetchImpl(actions) });
    runtime.start();
    const { panel, input } = buildPanel({
      items: [{ label: "Dashboard", id: "go-dashboard" }],
    });
    activatePanel(panel, runtime);

    // Simulate collection-nav setting aria-activedescendant on the input.
    input.setAttribute("aria-activedescendant", "opt-go-dashboard");
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));

    await vi.waitFor(() => expect(actions.length).toBeGreaterThan(0));
    expect(actions).toContain("executeCommand");
  });

  it("Enter fires openPageAction for an item with data-page-id", async () => {
    const actions: string[] = [];
    const runtime = new LievitRuntime({ fetchImpl: makeFetchImpl(actions) });
    runtime.start();
    const { panel, input } = buildPanel({
      items: [{ label: "File commands", id: "file-page", pageId: "file" }],
    });
    activatePanel(panel, runtime);

    input.setAttribute("aria-activedescendant", "opt-file-page");
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));

    await vi.waitFor(() => expect(actions.length).toBeGreaterThan(0));
    expect(actions).toContain("openPage");
  });

  it("Enter on a disabled item is a no-op", () => {
    const actions: string[] = [];
    const runtime = new LievitRuntime({ fetchImpl: makeFetchImpl(actions) });
    runtime.start();
    const { panel, input } = buildPanel({
      items: [{ label: "Disabled", id: "disabled-cmd", disabled: true }],
    });
    activatePanel(panel, runtime);

    input.setAttribute("aria-activedescendant", "opt-disabled-cmd");
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(actions).toEqual([]);
  });

  it("Enter with no aria-activedescendant is a no-op", () => {
    const actions: string[] = [];
    const runtime = new LievitRuntime({ fetchImpl: makeFetchImpl(actions) });
    runtime.start();
    const { panel, input } = buildPanel({ items: [{ label: "Dashboard" }] });
    activatePanel(panel, runtime);

    input.setAttribute("aria-activedescendant", "");
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(actions).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// activatePanel: Backspace in nested page
// ---------------------------------------------------------------------------

describe("activatePanel: Backspace fires backToRoot in nested page", () => {
  it("Backspace with empty input in a nested page fires backToRootAction", async () => {
    const actions: string[] = [];
    const runtime = new LievitRuntime({ fetchImpl: makeFetchImpl(actions) });
    runtime.start();
    const { panel, input } = buildPanel({
      items: [{ label: "New file" }],
      page: "File commands",
    });
    activatePanel(panel, runtime);

    input.value = "";
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Backspace", bubbles: true }));

    await vi.waitFor(() => expect(actions.length).toBeGreaterThan(0));
    expect(actions).toContain("backToRoot");
  });

  it("Backspace with non-empty input in a nested page is a no-op (normal text delete)", () => {
    const actions: string[] = [];
    const runtime = new LievitRuntime({ fetchImpl: makeFetchImpl(actions) });
    runtime.start();
    const { panel, input } = buildPanel({
      items: [{ label: "New file" }],
      page: "File commands",
    });
    activatePanel(panel, runtime);

    input.value = "ne";
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Backspace", bubbles: true }));
    expect(actions).toEqual([]);
  });

  it("Backspace at root page (empty page) does not fire any action", () => {
    const actions: string[] = [];
    const runtime = new LievitRuntime({ fetchImpl: makeFetchImpl(actions) });
    runtime.start();
    const { panel, input } = buildPanel({ items: [{ label: "Dashboard" }], page: "" });
    activatePanel(panel, runtime);

    input.value = "";
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Backspace", bubbles: true }));
    expect(actions).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// activatePanel: global shortcut (Ctrl+K closes while panel is open)
// ---------------------------------------------------------------------------

describe("activatePanel: global shortcut fires close", () => {
  it("Ctrl+K while panel is in DOM fires closeAction", async () => {
    const actions: string[] = [];
    const runtime = new LievitRuntime({ fetchImpl: makeFetchImpl(actions) });
    runtime.start();
    const { panel } = buildPanel({
      items: [{ label: "Dashboard" }],
      shortcut: "mod+k",
      escapeAction: "close",
    });
    activatePanel(panel, runtime);

    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true }),
    );

    await vi.waitFor(() => expect(actions.length).toBeGreaterThan(0));
    expect(actions).toContain("close");
  });
});

// ---------------------------------------------------------------------------
// activatePanel: idempotency
// ---------------------------------------------------------------------------

describe("activatePanel: idempotency", () => {
  it("calling activatePanel twice does not double-bind the filter", () => {
    const actions: string[] = [];
    const runtime = new LievitRuntime({ fetchImpl: makeFetchImpl(actions) });
    const { panel, input } = buildPanel({
      items: [{ label: "Dashboard" }, { label: "Settings" }],
    });
    activatePanel(panel, runtime);
    activatePanel(panel, runtime); // second call: no-op
    type(input, "set");
    // Single filter pass: exactly Settings visible.
    expect(visibleLabels(panel)).toEqual(["Settings"]);
  });
});

// ---------------------------------------------------------------------------
// installCommandEnhancer: lifecycle integration
// ---------------------------------------------------------------------------

describe("installCommandEnhancer: runtime lifecycle", () => {
  it("activates panels on onComponentInit", () => {
    const actions: string[] = [];
    const runtime = new LievitRuntime({ fetchImpl: makeFetchImpl(actions) });
    installCommandEnhancer(runtime);
    const { panel, input } = buildPanel({
      items: [{ label: "Dashboard" }, { label: "Settings" }],
    });
    runtime.start(); // fires onComponentInit on the already-present panel
    type(input, "set");
    expect(visibleLabels(panel)).toEqual(["Settings"]);
  });

  it("panel absent from DOM after afterCall stops receiving events", async () => {
    const actions: string[] = [];
    const runtime = new LievitRuntime({ fetchImpl: makeFetchImpl(actions) });
    installCommandEnhancer(runtime);
    const { panel } = buildPanel({
      items: [{ label: "Dashboard" }],
    });
    runtime.start();
    // Panel carries ACTIVE_ATTR while in DOM.
    expect(panel.hasAttribute("data-lievit-rt-command-active")).toBe(true);

    // Remove panel from DOM: simulate morph removing it.
    panel.remove();

    // Trigger afterCall on the lifecycle bus (simulate a morph completing).
    // We do this by firing a fake successful response via calling an action.
    // afterCall prunes stale panels.
    // Verify the panel is marked inactive after the afterCall prune.
    // (We trigger it indirectly by checking the Map cleanup path fires when body.contains=false.)
    // Direct test: after panel.remove(), panel no longer has ACTIVE_ATTR after next afterCall.
    // We can use runtime internals only via the public API: fire a callAction which triggers afterCall.
    // Use a wrapper to check the cleanup logic directly.
    // Since the panel is no longer in the body, the next afterCall prunes it.
    // We'll check this by verifying the panel lost ACTIVE_ATTR.
    // Trigger afterCall by calling a wire action (the fetch mock returns a morph response).
    const componentRoot = document.querySelector<HTMLElement>("[data-lievit-component]");
    if (componentRoot != null) {
      // The component root is still in the DOM (just the panel removed).
      // Call a dummy action to trigger the afterCall lifecycle.
      await runtime.callAction(componentRoot, "noop", {});
    }
    expect(panel.hasAttribute("data-lievit-rt-command-active")).toBe(false);
  });
});
