/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * Tests for the collection-nav shared enhancer. Asserts WAI-ARIA APG Listbox + Menu keyboard nav:
 * ArrowDown/Up moves active item, Home/End jump to ends, wrap wraps, disabled items are skipped,
 * typeahead jumps to matching item, Enter fires the select action, Escape fires the escape action,
 * and aria-activedescendant is kept in sync on the collection container.
 *
 * Substrate: happy-dom (real KeyboardEvents, real DOM, real LievitRuntime — no mocked $lievit).
 * Pattern: build DOM BEFORE runtime.start() so the directive scan fires on start().
 */
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";

import { LievitRuntime } from "../runtime/runtime.js";
import { installCollectionNav } from "../runtime/features/collection-nav.enhancer.js";

// ---------------------------------------------------------------------------
// Helpers
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

type ItemDef = { text: string; id?: string; disabled?: boolean };

/**
 * Build a component root with a collection inside it, mount it, then start a runtime with
 * installCollectionNav so the directive bind fires on the already-present DOM.
 */
function buildCollection(opts: {
  items: ItemDef[];
  orientation?: "vertical" | "horizontal" | "both";
  wrap?: boolean;
  selectAction?: string;
  escapeAction?: string;
}): {
  runtime: LievitRuntime;
  calledActions: string[];
  collRoot: HTMLElement;
  itemEls: HTMLElement[];
} {
  document.body.innerHTML = "";
  const calledActions: string[] = [];

  const componentRoot = document.createElement("div");
  componentRoot.setAttribute("data-lievit-component", "com.example.C");
  componentRoot.setAttribute("data-lievit-id", `cid-${Math.random().toString(36).slice(2)}`);
  componentRoot.setAttribute("data-lievit-snapshot", "s1");

  const collRoot = document.createElement("ul");
  collRoot.setAttribute("data-lievit-collection", "");
  collRoot.setAttribute("tabindex", "0");
  if (opts.orientation != null) {
    collRoot.setAttribute("data-lievit-collection-orientation", opts.orientation);
  }
  if (opts.wrap === true) {
    collRoot.setAttribute("data-lievit-collection-wrap", "true");
  }
  if (opts.selectAction != null) {
    collRoot.setAttribute("data-lievit-collection-select-action", opts.selectAction);
  }
  if (opts.escapeAction != null) {
    collRoot.setAttribute("data-lievit-collection-escape-action", opts.escapeAction);
  }

  const itemEls: HTMLElement[] = [];
  for (const item of opts.items) {
    const li = document.createElement("li");
    li.setAttribute("data-lievit-item", "");
    li.id = item.id ?? `item-${Math.random().toString(36).slice(2)}`;
    li.textContent = item.text;
    if (item.disabled === true) {
      li.setAttribute("aria-disabled", "true");
    }
    collRoot.appendChild(li);
    itemEls.push(li);
  }

  componentRoot.appendChild(collRoot);
  document.body.appendChild(componentRoot);

  const runtime = new LievitRuntime({ fetchImpl: makeFetchImpl(calledActions) });
  installCollectionNav(runtime);
  runtime.start();

  return { runtime, calledActions, collRoot, itemEls };
}

/**
 * Build a tablist (roving-tabindex mode). Items are real `<button>` elements so `.focus()` works
 * in happy-dom. The first non-disabled item starts with `tabindex="0"`; others get `tabindex="-1"`
 * (matching what tabs.jte renders server-side).
 *
 * Keys are dispatched on `collRoot` (the tablist root where the listener is registered). Because
 * keydown fires on the focused element and bubbles, dispatching directly on the root is equivalent
 * for the handler — and keeps the helper simple while testing keyboard-only paths.
 */
function buildRovingCollection(opts: {
  items: ItemDef[];
  orientation?: "horizontal" | "vertical" | "both";
  wrap?: boolean;
  selectAction?: string;
  escapeAction?: string;
  manualActivation?: boolean;
}): {
  runtime: LievitRuntime;
  calledActions: string[];
  collRoot: HTMLElement;
  itemEls: HTMLButtonElement[];
} {
  document.body.innerHTML = "";
  const calledActions: string[] = [];

  const componentRoot = document.createElement("div");
  componentRoot.setAttribute("data-lievit-component", "com.example.Tabs");
  componentRoot.setAttribute("data-lievit-id", `cid-${Math.random().toString(36).slice(2)}`);
  componentRoot.setAttribute("data-lievit-snapshot", "s1");

  const collRoot = document.createElement("div");
  collRoot.setAttribute("role", "tablist");
  collRoot.setAttribute("data-lievit-collection", "");
  collRoot.setAttribute("data-lievit-collection-roving-tabindex", "true");
  collRoot.setAttribute("data-lievit-collection-wrap", opts.wrap === false ? "false" : "true");
  collRoot.setAttribute("data-lievit-collection-orientation", opts.orientation ?? "horizontal");
  if (opts.selectAction != null) {
    collRoot.setAttribute("data-lievit-collection-select-action", opts.selectAction);
  }
  if (opts.escapeAction != null) {
    collRoot.setAttribute("data-lievit-collection-escape-action", opts.escapeAction);
  }
  if (opts.manualActivation === true) {
    collRoot.setAttribute("data-manual-activation", "true");
  }

  const itemEls: HTMLButtonElement[] = [];
  let firstEnabled = true;
  for (const item of opts.items) {
    const btn = document.createElement("button");
    btn.setAttribute("type", "button");
    btn.setAttribute("role", "tab");
    btn.setAttribute("data-lievit-item", "");
    btn.id = item.id ?? `tab-${Math.random().toString(36).slice(2)}`;
    btn.textContent = item.text;
    if (item.disabled === true) {
      // APG Tabs: aria-disabled only (not native disabled) so the button stays focusable.
      btn.setAttribute("aria-disabled", "true");
      btn.tabIndex = -1;
    } else {
      // First non-disabled item gets tabindex=0 (matches server-rendered initial state).
      btn.tabIndex = firstEnabled ? 0 : -1;
      firstEnabled = false;
    }
    collRoot.appendChild(btn);
    itemEls.push(btn);
  }

  componentRoot.appendChild(collRoot);
  document.body.appendChild(componentRoot);

  const runtime = new LievitRuntime({ fetchImpl: makeFetchImpl(calledActions) });
  installCollectionNav(runtime);
  runtime.start();

  return { runtime, calledActions, collRoot, itemEls };
}

/** Returns the tabindex of an item as a number. */
function tabIdx(el: HTMLElement): number {
  return el.tabIndex;
}

function key(el: Element, k: string, opts: KeyboardEventInit = {}): void {
  el.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true, ...opts }));
}

function activeId(root: Element): string | null {
  return root.getAttribute("aria-activedescendant");
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  document.body.innerHTML = "";
});

afterEach(() => {
  document.body.innerHTML = "";
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("collection-nav.enhancer — WAI-ARIA APG Listbox + Menu", () => {
  it("arrow_down_moves_active_item — ArrowDown advances the active item", () => {
    const { collRoot, itemEls } = buildCollection({
      items: [{ text: "Alpha" }, { text: "Beta" }, { text: "Gamma" }],
    });

    expect(activeId(collRoot)).toBeNull();
    key(collRoot, "ArrowDown");
    expect(activeId(collRoot)).toBe(itemEls[0].id);
    key(collRoot, "ArrowDown");
    expect(activeId(collRoot)).toBe(itemEls[1].id);
  });

  it("arrow_up_moves_active_item — ArrowUp retreats the active item", () => {
    const { collRoot, itemEls } = buildCollection({
      items: [{ text: "Alpha" }, { text: "Beta" }, { text: "Gamma" }],
    });

    key(collRoot, "ArrowDown"); // → 0
    key(collRoot, "ArrowDown"); // → 1
    key(collRoot, "ArrowDown"); // → 2
    expect(activeId(collRoot)).toBe(itemEls[2].id);

    key(collRoot, "ArrowUp");
    expect(activeId(collRoot)).toBe(itemEls[1].id);
  });

  it("home_jumps_to_first — Home moves to the first non-disabled item", () => {
    const { collRoot, itemEls } = buildCollection({
      items: [{ text: "Alpha" }, { text: "Beta" }, { text: "Gamma" }],
    });

    key(collRoot, "ArrowDown");
    key(collRoot, "ArrowDown");
    expect(activeId(collRoot)).toBe(itemEls[1].id);

    key(collRoot, "Home");
    expect(activeId(collRoot)).toBe(itemEls[0].id);
  });

  it("end_jumps_to_last — End moves to the last non-disabled item", () => {
    const { collRoot, itemEls } = buildCollection({
      items: [{ text: "Alpha" }, { text: "Beta" }, { text: "Gamma" }],
    });

    key(collRoot, "End");
    expect(activeId(collRoot)).toBe(itemEls[itemEls.length - 1].id);
  });

  it("wraps_when_enabled — ArrowDown at the last item wraps to first when wrap=true", () => {
    const { collRoot, itemEls } = buildCollection({
      items: [{ text: "Alpha" }, { text: "Beta" }, { text: "Gamma" }],
      wrap: true,
    });

    key(collRoot, "End"); // → last
    expect(activeId(collRoot)).toBe(itemEls[itemEls.length - 1].id);

    key(collRoot, "ArrowDown"); // wraps → first
    expect(activeId(collRoot)).toBe(itemEls[0].id);
  });

  it("skips_disabled_items — ArrowDown skips items with aria-disabled=true", () => {
    const { collRoot, itemEls } = buildCollection({
      items: [
        { text: "Alpha" },
        { text: "Beta", disabled: true },
        { text: "Gamma" },
      ],
    });

    key(collRoot, "ArrowDown"); // → Alpha (first enabled)
    expect(activeId(collRoot)).toBe(itemEls[0].id);

    key(collRoot, "ArrowDown"); // → Gamma (Beta disabled)
    expect(activeId(collRoot)).toBe(itemEls[2].id);
  });

  it("typeahead_jumps_to_matching_item — printable char jumps to next matching item by text", () => {
    const { collRoot, itemEls } = buildCollection({
      items: [
        { text: "Apple" },
        { text: "Banana" },
        { text: "Blueberry" },
        { text: "Cherry" },
      ],
    });

    // Type "b" → Banana (first item starting with b, no current active).
    key(collRoot, "b");
    expect(activeId(collRoot)).toBe(itemEls[1].id);

    // Type "b" again → Blueberry (next after Banana starting with b).
    key(collRoot, "b");
    expect(activeId(collRoot)).toBe(itemEls[2].id);
  });

  it("enter_fires_select_action — Enter fires the select wire action on the active item", async () => {
    const { collRoot, calledActions } = buildCollection({
      items: [{ text: "Alpha" }, { text: "Beta" }],
      selectAction: "select",
    });

    key(collRoot, "ArrowDown"); // → Alpha
    key(collRoot, "Enter");

    await new Promise<void>((r) => setTimeout(r, 20));
    expect(calledActions).toContain("select");
  });

  it("escape_fires_escape_action — Escape fires the escape wire action on the root", async () => {
    const { collRoot, calledActions } = buildCollection({
      items: [{ text: "Alpha" }],
      escapeAction: "close",
    });

    key(collRoot, "Escape");

    await new Promise<void>((r) => setTimeout(r, 20));
    expect(calledActions).toContain("close");
  });

  it("activedescendant_set_on_container — aria-activedescendant tracks active item on the collection root", () => {
    const { collRoot, itemEls } = buildCollection({
      items: [{ text: "Alpha" }, { text: "Beta" }],
    });

    key(collRoot, "ArrowDown");
    expect(collRoot.getAttribute("aria-activedescendant")).toBe(itemEls[0].id);

    key(collRoot, "ArrowDown");
    expect(collRoot.getAttribute("aria-activedescendant")).toBe(itemEls[1].id);
  });
});

// ---------------------------------------------------------------------------
// Roving-tabindex model (APG Tabs)
// ---------------------------------------------------------------------------

describe("collection-nav.enhancer — WAI-ARIA APG Tabs (roving-tabindex mode)", () => {
  it("arrow_right_moves_focus_and_tabindex — ArrowRight moves DOM focus + tabindex=0 to the next tab", () => {
    const { collRoot, itemEls } = buildRovingCollection({
      items: [{ text: "Tab 1" }, { text: "Tab 2" }, { text: "Tab 3" }],
      selectAction: "activate",
    });

    // Initial state: first item is tabindex=0.
    expect(tabIdx(itemEls[0])).toBe(0);
    expect(tabIdx(itemEls[1])).toBe(-1);
    expect(tabIdx(itemEls[2])).toBe(-1);

    key(collRoot, "ArrowRight");

    expect(tabIdx(itemEls[0])).toBe(-1);
    expect(tabIdx(itemEls[1])).toBe(0);
    expect(tabIdx(itemEls[2])).toBe(-1);
    expect(document.activeElement).toBe(itemEls[1]);
  });

  it("arrow_left_moves_focus_backwards — ArrowLeft retreats DOM focus to the previous tab", () => {
    const { collRoot, itemEls } = buildRovingCollection({
      items: [{ text: "Tab 1" }, { text: "Tab 2" }, { text: "Tab 3" }],
    });

    // Move to Tab 2 first.
    key(collRoot, "ArrowRight"); // → Tab 2
    expect(document.activeElement).toBe(itemEls[1]);

    key(collRoot, "ArrowLeft"); // → Tab 1
    expect(tabIdx(itemEls[0])).toBe(0);
    expect(tabIdx(itemEls[1])).toBe(-1);
    expect(document.activeElement).toBe(itemEls[0]);
  });

  it("home_moves_focus_to_first — Home moves DOM focus + tabindex=0 to the first tab", () => {
    const { collRoot, itemEls } = buildRovingCollection({
      items: [{ text: "Tab 1" }, { text: "Tab 2" }, { text: "Tab 3" }],
    });

    key(collRoot, "ArrowRight"); // → Tab 2
    key(collRoot, "ArrowRight"); // → Tab 3
    expect(document.activeElement).toBe(itemEls[2]);

    key(collRoot, "Home");
    expect(tabIdx(itemEls[0])).toBe(0);
    expect(tabIdx(itemEls[1])).toBe(-1);
    expect(tabIdx(itemEls[2])).toBe(-1);
    expect(document.activeElement).toBe(itemEls[0]);
  });

  it("end_moves_focus_to_last — End moves DOM focus + tabindex=0 to the last tab", () => {
    const { collRoot, itemEls } = buildRovingCollection({
      items: [{ text: "Tab 1" }, { text: "Tab 2" }, { text: "Tab 3" }],
    });

    key(collRoot, "End");
    expect(tabIdx(itemEls[itemEls.length - 1])).toBe(0);
    expect(tabIdx(itemEls[0])).toBe(-1);
    expect(document.activeElement).toBe(itemEls[itemEls.length - 1]);
  });

  it("wraps_at_last_item — ArrowRight at last tab wraps to first (wrap=true, APG Tabs default)", () => {
    const { collRoot, itemEls } = buildRovingCollection({
      items: [{ text: "Tab 1" }, { text: "Tab 2" }, { text: "Tab 3" }],
      wrap: true,
    });

    key(collRoot, "End"); // → Tab 3
    expect(document.activeElement).toBe(itemEls[2]);

    key(collRoot, "ArrowRight"); // wraps → Tab 1
    expect(tabIdx(itemEls[0])).toBe(0);
    expect(document.activeElement).toBe(itemEls[0]);
  });

  it("wraps_at_first_item — ArrowLeft at first tab wraps to last", () => {
    const { collRoot, itemEls } = buildRovingCollection({
      items: [{ text: "Tab 1" }, { text: "Tab 2" }, { text: "Tab 3" }],
      wrap: true,
    });

    // Initial state: Tab 1 is focused.
    key(collRoot, "ArrowLeft"); // wraps → Tab 3
    expect(tabIdx(itemEls[itemEls.length - 1])).toBe(0);
    expect(document.activeElement).toBe(itemEls[itemEls.length - 1]);
  });

  it("skips_disabled_items — ArrowRight skips items with aria-disabled=true", () => {
    const { collRoot, itemEls } = buildRovingCollection({
      items: [
        { text: "Tab 1" },
        { text: "Tab 2", disabled: true },
        { text: "Tab 3" },
      ],
    });

    // Tab 1 is focused; ArrowRight skips disabled Tab 2 and lands on Tab 3.
    key(collRoot, "ArrowRight");
    expect(tabIdx(itemEls[0])).toBe(-1);
    expect(tabIdx(itemEls[2])).toBe(0);
    expect(document.activeElement).toBe(itemEls[2]);
  });

  it("automatic_activation_fires_action_on_arrow — ArrowRight calls selectAction immediately (no data-manual-activation)", async () => {
    const { collRoot, calledActions, itemEls } = buildRovingCollection({
      items: [{ text: "Tab 1" }, { text: "Tab 2" }, { text: "Tab 3" }],
      selectAction: "activate",
    });

    key(collRoot, "ArrowRight"); // → Tab 2, automatic activation fires
    // Assert focus synchronously (before morph fires asynchronously and may tear down the DOM).
    expect(document.activeElement).toBe(itemEls[1]);

    await new Promise<void>((r) => setTimeout(r, 20));
    expect(calledActions).toContain("activate");
  });

  it("manual_activation_arrow_does_not_fire_action — ArrowRight moves focus but does NOT call selectAction when data-manual-activation=true", async () => {
    const { collRoot, calledActions, itemEls } = buildRovingCollection({
      items: [{ text: "Tab 1" }, { text: "Tab 2" }, { text: "Tab 3" }],
      selectAction: "activate",
      manualActivation: true,
    });

    key(collRoot, "ArrowRight"); // focus moves but action is NOT fired
    await new Promise<void>((r) => setTimeout(r, 20));

    expect(calledActions).not.toContain("activate");
    expect(document.activeElement).toBe(itemEls[1]);
  });

  it("manual_activation_enter_fires_action — Enter activates the focused tab in manual-activation mode", async () => {
    const { collRoot, calledActions, itemEls } = buildRovingCollection({
      items: [{ text: "Tab 1" }, { text: "Tab 2" }],
      selectAction: "activate",
      manualActivation: true,
    });

    key(collRoot, "ArrowRight"); // focus → Tab 2, no action yet
    // Focus must have moved synchronously before Enter is pressed.
    expect(document.activeElement).toBe(itemEls[1]);
    key(collRoot, "Enter");      // now activates

    await new Promise<void>((r) => setTimeout(r, 20));
    expect(calledActions).toContain("activate");
  });

  it("manual_activation_space_fires_action — Space activates the focused tab in manual-activation mode", async () => {
    const { collRoot, calledActions } = buildRovingCollection({
      items: [{ text: "Tab 1" }, { text: "Tab 2" }],
      selectAction: "activate",
      manualActivation: true,
    });

    key(collRoot, "ArrowRight"); // focus → Tab 2
    key(collRoot, " ");          // Space activates

    await new Promise<void>((r) => setTimeout(r, 20));
    expect(calledActions).toContain("activate");
  });

  it("automatic_activation_enter_is_no_op — Enter in automatic-activation mode does not double-fire", async () => {
    const { collRoot, calledActions } = buildRovingCollection({
      items: [{ text: "Tab 1" }, { text: "Tab 2" }],
      selectAction: "activate",
      // No manualActivation → automatic
    });

    key(collRoot, "ArrowRight"); // → Tab 2, fires activate once
    await new Promise<void>((r) => setTimeout(r, 20));

    const countAfterArrow = calledActions.filter((a) => a === "activate").length;
    key(collRoot, "Enter"); // should NOT fire again in automatic mode
    await new Promise<void>((r) => setTimeout(r, 20));

    expect(calledActions.filter((a) => a === "activate").length).toBe(countAfterArrow);
  });

  it("roving_does_not_set_aria_activedescendant — roving mode must NOT touch aria-activedescendant", () => {
    const { collRoot } = buildRovingCollection({
      items: [{ text: "Tab 1" }, { text: "Tab 2" }],
    });

    key(collRoot, "ArrowRight");
    // The aria-activedescendant model must not bleed into roving mode.
    expect(collRoot.hasAttribute("aria-activedescendant")).toBe(false);
  });

  it("activedescendant_mode_untouched — existing tests still pass (aria-activedescendant root stays virtual-focus only)", () => {
    // Sanity guard: a plain data-lievit-collection root (no roving attr) still uses the
    // aria-activedescendant model and does NOT move DOM focus.
    const { collRoot, itemEls } = buildCollection({
      items: [{ text: "Alpha" }, { text: "Beta" }],
    });

    const focusBefore = document.activeElement;
    key(collRoot, "ArrowDown");
    expect(collRoot.getAttribute("aria-activedescendant")).toBe(itemEls[0].id);
    // DOM focus must NOT have moved away from the original focused element.
    expect(document.activeElement).toBe(focusBefore);
  });

  it("vertical_roving_responds_to_arrow_up_down — vertical tablist uses ArrowDown/Up not ArrowRight/Left", () => {
    const { collRoot, itemEls } = buildRovingCollection({
      items: [{ text: "Tab A" }, { text: "Tab B" }, { text: "Tab C" }],
      orientation: "vertical",
    });

    key(collRoot, "ArrowDown"); // → Tab B
    expect(document.activeElement).toBe(itemEls[1]);

    key(collRoot, "ArrowUp"); // → Tab A
    expect(document.activeElement).toBe(itemEls[0]);

    // Horizontal arrow keys must NOT move focus in vertical mode.
    key(collRoot, "ArrowRight");
    expect(document.activeElement).toBe(itemEls[0]); // unchanged
  });
});
