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

  // ---------------------------------------------------------------------------
  // ADDITIVE: roving-tabindex typeahead
  // ---------------------------------------------------------------------------

  it("roving_typeahead_focuses_matching_item — printable char focuses next item whose text starts with it", () => {
    const { collRoot, itemEls } = buildRovingCollection({
      items: [
        { text: "Apple" },
        { text: "Banana" },
        { text: "Cherry" },
      ],
      orientation: "horizontal",
    });

    // Initial focused = Apple (tabindex=0). Type "b" → Banana.
    key(collRoot, "b");
    expect(document.activeElement).toBe(itemEls[1]);
    expect(itemEls[1].tabIndex).toBe(0);
    expect(itemEls[0].tabIndex).toBe(-1);
  });

  it("roving_typeahead_repeated_char_cycles — repeated same char cycles among matching items", () => {
    const { collRoot, itemEls } = buildRovingCollection({
      items: [
        { text: "Apple" },
        { text: "Apricot" },
        { text: "Avocado" },
        { text: "Banana" },
      ],
      orientation: "horizontal",
    });

    // "a" → Apricot (next after Apple which is initial focused)
    key(collRoot, "a");
    expect(document.activeElement).toBe(itemEls[1]);

    // "a" again → Avocado (next after Apricot starting with a)
    key(collRoot, "a");
    expect(document.activeElement).toBe(itemEls[2]);

    // "a" again → wraps back to Apple
    key(collRoot, "a");
    expect(document.activeElement).toBe(itemEls[0]);
  });

  it("roving_typeahead_skips_disabled — disabled items are excluded from typeahead matching", () => {
    const { collRoot, itemEls } = buildRovingCollection({
      items: [
        { text: "Alpha" },
        { text: "Beta", disabled: true },
        { text: "Bravo" },
      ],
      orientation: "horizontal",
    });

    // "b" should skip disabled Beta and land on Bravo.
    key(collRoot, "b");
    expect(document.activeElement).toBe(itemEls[2]);
  });

  it("roving_typeahead_no_match_leaves_focus_unchanged — no match: focus stays where it was", () => {
    const { collRoot, itemEls } = buildRovingCollection({
      items: [{ text: "Apple" }, { text: "Banana" }],
      orientation: "horizontal",
    });

    // Explicitly move focus to Apple (tabindex=0) before testing.
    itemEls[0].focus();
    expect(document.activeElement).toBe(itemEls[0]);

    // "z" has no match; focus should stay on Apple.
    key(collRoot, "z");
    expect(document.activeElement).toBe(itemEls[0]);
    // tabindex=0 also remains on Apple (no change).
    expect(itemEls[0].tabIndex).toBe(0);
  });

  it("roving_typeahead_does_not_set_aria_activedescendant — typeahead in roving mode must NOT touch aria-activedescendant", () => {
    const { collRoot } = buildRovingCollection({
      items: [{ text: "Apple" }, { text: "Banana" }],
      orientation: "horizontal",
    });

    key(collRoot, "b");
    expect(collRoot.hasAttribute("aria-activedescendant")).toBe(false);
  });

  it("activedescendant_typeahead_unaffected — typeahead still works in aria-activedescendant mode after roving addition", () => {
    // Guard: existing typeahead in activedescendant mode is untouched.
    const { collRoot, itemEls } = buildCollection({
      items: [
        { text: "Foo" },
        { text: "Bar" },
        { text: "Baz" },
      ],
    });

    key(collRoot, "b");
    expect(activeId(collRoot)).toBe(itemEls[1].id);

    key(collRoot, "b"); // repeated → Baz
    expect(activeId(collRoot)).toBe(itemEls[2].id);
  });

  // ---------------------------------------------------------------------------
  // ADDITIVE: submenu ArrowRight/Left (roving-tabindex, vertical orientation)
  // ---------------------------------------------------------------------------

  it("arrow_right_dispatches_submenu_open_event — ArrowRight on submenu parent fires lv:collection-submenu-open", () => {
    // Build a vertical menu (roving, manual-activation) with one item that has aria-haspopup="menu".
    document.body.innerHTML = "";

    const componentRoot = document.createElement("div");
    componentRoot.setAttribute("data-lievit-component", "com.example.Menu");
    componentRoot.setAttribute("data-lievit-id", "cid-submenu");
    componentRoot.setAttribute("data-lievit-snapshot", "s1");

    const collRoot = document.createElement("div");
    collRoot.setAttribute("role", "menu");
    collRoot.setAttribute("data-lievit-collection", "");
    collRoot.setAttribute("data-lievit-collection-roving-tabindex", "true");
    collRoot.setAttribute("data-lievit-collection-orientation", "vertical");
    collRoot.setAttribute("data-lievit-collection-wrap", "true");
    collRoot.setAttribute("data-manual-activation", "true");

    // Plain item (no submenu).
    const item0 = document.createElement("button");
    item0.setAttribute("type", "button");
    item0.setAttribute("data-lievit-item", "");
    item0.id = "item-plain";
    item0.textContent = "Plain";
    item0.tabIndex = 0; // initially focused
    collRoot.appendChild(item0);

    // Submenu parent item.
    const item1 = document.createElement("button");
    item1.setAttribute("type", "button");
    item1.setAttribute("data-lievit-item", "");
    item1.setAttribute("aria-haspopup", "menu");
    item1.setAttribute("aria-expanded", "false");
    item1.setAttribute("aria-controls", "child-panel");
    item1.id = "item-submenu";
    item1.textContent = "Has submenu";
    item1.tabIndex = -1;
    collRoot.appendChild(item1);

    componentRoot.appendChild(collRoot);
    document.body.appendChild(componentRoot);

    const runtime = new LievitRuntime({ fetchImpl: vi.fn(async () =>
      new Response("<div></div>", { status: 200, headers: { "Lievit-Snapshot": "s2" } })
    ) as unknown as typeof fetch });
    installCollectionNav(runtime);
    runtime.start();

    // Move focus to the submenu parent item.
    key(collRoot, "ArrowDown"); // focus moves to item1
    expect(document.activeElement).toBe(item1);

    // Listen for the custom event.
    let submenuOpenFired = false;
    let submenuOpenTarget: EventTarget | null = null;
    collRoot.addEventListener("lv:collection-submenu-open", (e) => {
      submenuOpenFired = true;
      submenuOpenTarget = e.target;
    });

    // ArrowRight should dispatch the event on item1 (the submenu parent).
    key(collRoot, "ArrowRight");
    expect(submenuOpenFired).toBe(true);
    expect(submenuOpenTarget).toBe(item1);
  });

  it("arrow_right_on_non_submenu_item_is_noop — ArrowRight on a plain item does NOT dispatch the event", () => {
    document.body.innerHTML = "";

    const componentRoot = document.createElement("div");
    componentRoot.setAttribute("data-lievit-component", "com.example.Menu");
    componentRoot.setAttribute("data-lievit-id", "cid-noop");
    componentRoot.setAttribute("data-lievit-snapshot", "s1");

    const collRoot = document.createElement("div");
    collRoot.setAttribute("data-lievit-collection", "");
    collRoot.setAttribute("data-lievit-collection-roving-tabindex", "true");
    collRoot.setAttribute("data-lievit-collection-orientation", "vertical");
    collRoot.setAttribute("data-lievit-collection-wrap", "true");
    collRoot.setAttribute("data-manual-activation", "true");

    const item0 = document.createElement("button");
    item0.setAttribute("type", "button");
    item0.setAttribute("data-lievit-item", "");
    item0.textContent = "No submenu";
    item0.tabIndex = 0;
    collRoot.appendChild(item0);

    componentRoot.appendChild(collRoot);
    document.body.appendChild(componentRoot);

    const runtime = new LievitRuntime({ fetchImpl: vi.fn(async () =>
      new Response("<div></div>", { status: 200, headers: { "Lievit-Snapshot": "s2" } })
    ) as unknown as typeof fetch });
    installCollectionNav(runtime);
    runtime.start();

    let submenuOpenFired = false;
    collRoot.addEventListener("lv:collection-submenu-open", () => { submenuOpenFired = true; });

    // item0 has no aria-haspopup="menu"; ArrowRight should be a no-op.
    key(collRoot, "ArrowRight");
    expect(submenuOpenFired).toBe(false);
  });

  it("arrow_left_fires_escape_action_in_vertical_menu — ArrowLeft in a vertical roving menu fires the escape action", async () => {
    const { collRoot, calledActions } = buildRovingCollection({
      items: [{ text: "Item A" }, { text: "Item B" }],
      orientation: "vertical",
      escapeAction: "close",
      manualActivation: true,
    });

    key(collRoot, "ArrowLeft");

    await new Promise<void>((r) => setTimeout(r, 20));
    expect(calledActions).toContain("close");
  });

  it("arrow_left_in_horizontal_menu_is_navigation_not_submenu_close — ArrowLeft moves focus in horizontal menus, does NOT fire escape", async () => {
    const { collRoot, calledActions, itemEls } = buildRovingCollection({
      items: [{ text: "Tab 1" }, { text: "Tab 2" }, { text: "Tab 3" }],
      orientation: "horizontal",
      escapeAction: "close",
    });

    // Move to Tab 2, then ArrowLeft → Tab 1 (navigation, not submenu close).
    key(collRoot, "ArrowRight"); // → Tab 2
    expect(document.activeElement).toBe(itemEls[1]);

    key(collRoot, "ArrowLeft"); // → Tab 1 (navigation)
    expect(document.activeElement).toBe(itemEls[0]);

    await new Promise<void>((r) => setTimeout(r, 20));
    // escapeAction must NOT have fired; ArrowLeft was navigation.
    expect(calledActions.filter((a) => a === "close")).toHaveLength(0);
  });

  it("arrow_right_in_horizontal_menu_is_navigation_not_submenu_open — ArrowRight navigates in horizontal menus without firing submenu event", () => {
    document.body.innerHTML = "";

    const componentRoot = document.createElement("div");
    componentRoot.setAttribute("data-lievit-component", "com.example.HMenu");
    componentRoot.setAttribute("data-lievit-id", "cid-hmenu");
    componentRoot.setAttribute("data-lievit-snapshot", "s1");

    const collRoot = document.createElement("div");
    collRoot.setAttribute("data-lievit-collection", "");
    collRoot.setAttribute("data-lievit-collection-roving-tabindex", "true");
    collRoot.setAttribute("data-lievit-collection-orientation", "horizontal");
    collRoot.setAttribute("data-lievit-collection-wrap", "true");
    collRoot.setAttribute("data-manual-activation", "true");

    const items: HTMLButtonElement[] = [];
    for (let i = 0; i < 2; i++) {
      const btn = document.createElement("button");
      btn.setAttribute("type", "button");
      btn.setAttribute("data-lievit-item", "");
      btn.setAttribute("aria-haspopup", "menu"); // has submenu attr, but orientation is horizontal
      btn.textContent = `Item ${i}`;
      btn.tabIndex = i === 0 ? 0 : -1;
      collRoot.appendChild(btn);
      items.push(btn);
    }

    componentRoot.appendChild(collRoot);
    document.body.appendChild(componentRoot);

    const runtime = new LievitRuntime({ fetchImpl: vi.fn(async () =>
      new Response("<div></div>", { status: 200, headers: { "Lievit-Snapshot": "s2" } })
    ) as unknown as typeof fetch });
    installCollectionNav(runtime);
    runtime.start();

    let submenuOpenFired = false;
    collRoot.addEventListener("lv:collection-submenu-open", () => { submenuOpenFired = true; });

    // ArrowRight on a horizontal menu navigates, does NOT dispatch submenu-open.
    key(collRoot, "ArrowRight");
    expect(document.activeElement).toBe(items[1]); // navigation happened
    expect(submenuOpenFired).toBe(false); // no submenu event
  });

  // ---------------------------------------------------------------------------
  // ADDITIVE: horizontal-bar ArrowDown opens submenu (menubar pattern)
  // ---------------------------------------------------------------------------

  it("arrow_down_horizontal_submenu_parent_dispatches_open_event — ArrowDown in horizontal roving mode fires lv:collection-submenu-open on a top-level item with aria-haspopup='menu'", () => {
    // A horizontal menubar: two top-level triggers, both with aria-haspopup="menu".
    document.body.innerHTML = "";

    const componentRoot = document.createElement("div");
    componentRoot.setAttribute("data-lievit-component", "com.example.Menubar");
    componentRoot.setAttribute("data-lievit-id", "cid-menubar");
    componentRoot.setAttribute("data-lievit-snapshot", "s1");

    const collRoot = document.createElement("nav");
    collRoot.setAttribute("role", "menubar");
    collRoot.setAttribute("data-lievit-collection", "");
    collRoot.setAttribute("data-lievit-collection-roving-tabindex", "true");
    collRoot.setAttribute("data-lievit-collection-orientation", "horizontal");
    collRoot.setAttribute("data-lievit-collection-wrap", "true");
    collRoot.setAttribute("data-manual-activation", "true");

    const trigger0 = document.createElement("button");
    trigger0.setAttribute("type", "button");
    trigger0.setAttribute("role", "menuitem");
    trigger0.setAttribute("data-lievit-item", "");
    trigger0.setAttribute("aria-haspopup", "menu");
    trigger0.setAttribute("aria-expanded", "false");
    trigger0.setAttribute("aria-controls", "file-panel");
    trigger0.id = "trigger-file";
    trigger0.textContent = "File";
    trigger0.tabIndex = 0; // roving seed
    collRoot.appendChild(trigger0);

    const trigger1 = document.createElement("button");
    trigger1.setAttribute("type", "button");
    trigger1.setAttribute("role", "menuitem");
    trigger1.setAttribute("data-lievit-item", "");
    trigger1.setAttribute("aria-haspopup", "menu");
    trigger1.setAttribute("aria-expanded", "false");
    trigger1.setAttribute("aria-controls", "edit-panel");
    trigger1.id = "trigger-edit";
    trigger1.textContent = "Edit";
    trigger1.tabIndex = -1;
    collRoot.appendChild(trigger1);

    componentRoot.appendChild(collRoot);
    document.body.appendChild(componentRoot);

    const runtime = new LievitRuntime({ fetchImpl: vi.fn(async () =>
      new Response("<div></div>", { status: 200, headers: { "Lievit-Snapshot": "s2" } })
    ) as unknown as typeof fetch });
    installCollectionNav(runtime);
    runtime.start();

    // Listen for the submenu-open event on the bar container.
    let firedTarget: EventTarget | null = null;
    collRoot.addEventListener("lv:collection-submenu-open", (e) => {
      firedTarget = e.target;
    });

    // trigger0 has tabindex=0 (focused). ArrowDown should dispatch the event on trigger0.
    key(collRoot, "ArrowDown");
    expect(firedTarget).toBe(trigger0);
  });

  it("arrow_down_horizontal_non_submenu_parent_is_noop — ArrowDown in horizontal roving mode does NOT dispatch the event when focused item has no aria-haspopup='menu'", () => {
    document.body.innerHTML = "";

    const componentRoot = document.createElement("div");
    componentRoot.setAttribute("data-lievit-component", "com.example.HBar");
    componentRoot.setAttribute("data-lievit-id", "cid-hbar");
    componentRoot.setAttribute("data-lievit-snapshot", "s1");

    const collRoot = document.createElement("div");
    collRoot.setAttribute("data-lievit-collection", "");
    collRoot.setAttribute("data-lievit-collection-roving-tabindex", "true");
    collRoot.setAttribute("data-lievit-collection-orientation", "horizontal");
    collRoot.setAttribute("data-lievit-collection-wrap", "true");

    // Plain item: no aria-haspopup.
    const item0 = document.createElement("button");
    item0.setAttribute("type", "button");
    item0.setAttribute("data-lievit-item", "");
    item0.textContent = "Plain";
    item0.tabIndex = 0;
    collRoot.appendChild(item0);

    componentRoot.appendChild(collRoot);
    document.body.appendChild(componentRoot);

    const runtime = new LievitRuntime({ fetchImpl: vi.fn(async () =>
      new Response("<div></div>", { status: 200, headers: { "Lievit-Snapshot": "s2" } })
    ) as unknown as typeof fetch });
    installCollectionNav(runtime);
    runtime.start();

    let submenuOpenFired = false;
    collRoot.addEventListener("lv:collection-submenu-open", () => { submenuOpenFired = true; });

    // ArrowDown on a plain item (no aria-haspopup): no event, no navigation (key falls through).
    key(collRoot, "ArrowDown");
    expect(submenuOpenFired).toBe(false);
  });

  it("arrow_down_vertical_menu_is_navigation_not_submenu — ArrowDown in VERTICAL roving mode navigates (is NOT intercepted for submenu)", () => {
    // In vertical menus ArrowDown is the navigation key; it must NOT trigger submenu-open
    // even on an item with aria-haspopup="menu".
    const { collRoot, itemEls } = buildRovingCollection({
      items: [
        { text: "Item A" },
        { text: "Item B" },
      ],
      orientation: "vertical",
      manualActivation: true,
    });
    // Give item0 aria-haspopup so we can assert the guard works.
    itemEls[0].setAttribute("aria-haspopup", "menu");

    let submenuOpenFired = false;
    collRoot.addEventListener("lv:collection-submenu-open", () => { submenuOpenFired = true; });

    // ArrowDown in vertical mode must navigate, not dispatch submenu-open.
    key(collRoot, "ArrowDown");
    expect(document.activeElement).toBe(itemEls[1]); // navigation happened
    expect(submenuOpenFired).toBe(false); // no submenu event
  });
});

// ---------------------------------------------------------------------------
// Nav mode (APG Disclosure Navigation — data-lievit-collection-mode="nav")
// ---------------------------------------------------------------------------

/**
 * Build a nav-mode collection. All items start with tabindex="0" (disclosure navigation pattern).
 */
function buildNavCollection(opts: {
  items: ItemDef[];
  orientation?: "vertical" | "horizontal" | "both";
  wrap?: boolean;
  escapeAction?: string;
}): {
  runtime: LievitRuntime;
  calledActions: string[];
  collRoot: HTMLElement;
  itemEls: HTMLButtonElement[];
} {
  document.body.innerHTML = "";
  const calledActions: string[] = [];

  const componentRoot = document.createElement("div");
  componentRoot.setAttribute("data-lievit-component", "com.example.Nav");
  componentRoot.setAttribute("data-lievit-id", `cid-${Math.random().toString(36).slice(2)}`);
  componentRoot.setAttribute("data-lievit-snapshot", "s1");

  const collRoot = document.createElement("nav");
  collRoot.setAttribute("data-lievit-collection", "");
  collRoot.setAttribute("data-lievit-collection-mode", "nav");
  if (opts.orientation != null) {
    collRoot.setAttribute("data-lievit-collection-orientation", opts.orientation);
  }
  if (opts.wrap === true) {
    collRoot.setAttribute("data-lievit-collection-wrap", "true");
  }
  if (opts.escapeAction != null) {
    collRoot.setAttribute("data-lievit-collection-escape-action", opts.escapeAction);
  }

  const itemEls: HTMLButtonElement[] = [];
  for (const item of opts.items) {
    const btn = document.createElement("button");
    btn.setAttribute("type", "button");
    btn.setAttribute("data-lievit-item", "");
    btn.id = item.id ?? `nav-${Math.random().toString(36).slice(2)}`;
    btn.textContent = item.text;
    // All items start tabindex="0" (disclosure navigation: no roving tabindex management).
    btn.tabIndex = 0;
    if (item.disabled === true) {
      btn.setAttribute("aria-disabled", "true");
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

describe("collection-nav.enhancer — nav mode (APG Disclosure Navigation)", () => {
  it("nav_mode_arrow_down_moves_focus — ArrowDown moves DOM focus in vertical nav mode", () => {
    const { collRoot, itemEls } = buildNavCollection({
      items: [{ text: "Home" }, { text: "Products" }, { text: "About" }],
      orientation: "vertical",
    });

    // Give focus to the first item.
    itemEls[0].focus();
    expect(document.activeElement).toBe(itemEls[0]);

    key(collRoot, "ArrowDown");
    expect(document.activeElement).toBe(itemEls[1]);
  });

  it("nav_mode_arrow_up_moves_focus_backwards — ArrowUp moves DOM focus backwards in vertical nav mode", () => {
    const { collRoot, itemEls } = buildNavCollection({
      items: [{ text: "Home" }, { text: "Products" }, { text: "About" }],
      orientation: "vertical",
    });

    itemEls[2].focus();
    key(collRoot, "ArrowUp");
    expect(document.activeElement).toBe(itemEls[1]);
  });

  it("nav_mode_tabindex_never_mutated — nav mode NEVER writes tabindex=-1 on any item", () => {
    const { collRoot, itemEls } = buildNavCollection({
      items: [{ text: "A" }, { text: "B" }, { text: "C" }],
      orientation: "vertical",
    });

    itemEls[0].focus();
    // Press several arrow keys — tabindex must remain 0 on all items.
    key(collRoot, "ArrowDown");
    key(collRoot, "ArrowDown");
    key(collRoot, "ArrowUp");

    for (const item of itemEls) {
      expect(item.tabIndex).toBe(0);
    }
  });

  it("nav_mode_no_aria_activedescendant — nav mode never writes aria-activedescendant", () => {
    const { collRoot, itemEls } = buildNavCollection({
      items: [{ text: "A" }, { text: "B" }],
      orientation: "vertical",
    });

    itemEls[0].focus();
    key(collRoot, "ArrowDown");
    expect(collRoot.hasAttribute("aria-activedescendant")).toBe(false);
  });

  it("nav_mode_home_moves_to_first — Home focuses the first non-disabled item", () => {
    const { collRoot, itemEls } = buildNavCollection({
      items: [{ text: "Home" }, { text: "Products" }, { text: "About" }],
      orientation: "vertical",
    });

    itemEls[2].focus();
    key(collRoot, "Home");
    expect(document.activeElement).toBe(itemEls[0]);
  });

  it("nav_mode_end_moves_to_last — End focuses the last non-disabled item", () => {
    const { collRoot, itemEls } = buildNavCollection({
      items: [{ text: "Home" }, { text: "Products" }, { text: "About" }],
      orientation: "vertical",
    });

    itemEls[0].focus();
    key(collRoot, "End");
    expect(document.activeElement).toBe(itemEls[2]);
  });

  it("nav_mode_skips_disabled_items — ArrowDown skips disabled items", () => {
    const { collRoot, itemEls } = buildNavCollection({
      items: [{ text: "Home" }, { text: "Hidden", disabled: true }, { text: "About" }],
      orientation: "vertical",
    });

    itemEls[0].focus();
    key(collRoot, "ArrowDown");
    expect(document.activeElement).toBe(itemEls[2]);
  });

  it("nav_mode_horizontal_arrow_right_moves_focus — ArrowRight moves DOM focus in horizontal nav mode", () => {
    const { collRoot, itemEls } = buildNavCollection({
      items: [{ text: "Home" }, { text: "Products" }, { text: "Docs" }],
      orientation: "horizontal",
    });

    itemEls[0].focus();
    key(collRoot, "ArrowRight");
    expect(document.activeElement).toBe(itemEls[1]);
  });

  it("nav_mode_typeahead_moves_focus — printable char moves focus to next matching item by text", () => {
    const { collRoot, itemEls } = buildNavCollection({
      items: [{ text: "Home" }, { text: "Products" }, { text: "Pricing" }, { text: "About" }],
      orientation: "horizontal",
    });

    // Focus on Home, type "p" → Products.
    itemEls[0].focus();
    key(collRoot, "p");
    expect(document.activeElement).toBe(itemEls[1]);

    // Type "p" again → Pricing (repeated char cycles).
    key(collRoot, "p");
    expect(document.activeElement).toBe(itemEls[2]);
  });

  it("nav_mode_typeahead_tabindex_unchanged — typeahead in nav mode does NOT mutate tabindex", () => {
    const { collRoot, itemEls } = buildNavCollection({
      items: [{ text: "Alpha" }, { text: "Beta" }],
      orientation: "horizontal",
    });

    itemEls[0].focus();
    key(collRoot, "b");
    expect(document.activeElement).toBe(itemEls[1]);

    // Tabindex remains 0 on all items.
    for (const item of itemEls) {
      expect(item.tabIndex).toBe(0);
    }
  });

  it("nav_mode_escape_fires_escape_action — Escape fires the escape action in nav mode", async () => {
    const { collRoot, calledActions } = buildNavCollection({
      items: [{ text: "Home" }],
      orientation: "vertical",
      escapeAction: "closeNav",
    });

    key(collRoot, "Escape");

    await new Promise<void>((r) => setTimeout(r, 20));
    expect(calledActions).toContain("closeNav");
  });

  it("nav_mode_does_not_bleed_into_roving_mode — a separate roving-tabindex collection (built with buildRovingCollection) still manages tabindex correctly", () => {
    // Prove that the nav-mode guard does not interfere with a standard roving-tabindex collection.
    // Each collection is fully independent (separate DOM root, separate runtime); the guard is
    // purely attribute-driven. We verify: after a nav-mode session, starting a fresh roving
    // collection still manages tabindex as expected.
    document.body.innerHTML = "";

    const { collRoot: rovingRoot, itemEls: rovingItems } = buildRovingCollection({
      items: [{ text: "Tab 1" }, { text: "Tab 2" }, { text: "Tab 3" }],
      orientation: "horizontal",
    });

    // Initial state: first item has tabindex=0, others -1.
    expect(rovingItems[0].tabIndex).toBe(0);
    expect(rovingItems[1].tabIndex).toBe(-1);

    key(rovingRoot, "ArrowRight");

    // Roving model still works: tabindex moved to the second item.
    expect(rovingItems[0].tabIndex).toBe(-1);
    expect(rovingItems[1].tabIndex).toBe(0);
  });

  it("nav_mode_collection_leaves_tabindex_alone — a nav-mode collection in the same DOM does NOT touch tabindex=0 on any item after arrow navigation", () => {
    // Extra guard: run nav-mode key presses and confirm tabindex stays 0 on ALL items.
    const { collRoot: navRoot, itemEls: navItems } = buildNavCollection({
      items: [{ text: "Home" }, { text: "Products" }, { text: "About" }],
      orientation: "horizontal",
    });

    navItems[0].focus();
    key(navRoot, "ArrowRight");
    key(navRoot, "ArrowRight");
    key(navRoot, "ArrowLeft");

    for (const item of navItems) {
      expect(item.tabIndex).toBe(0);
    }
  });
});
