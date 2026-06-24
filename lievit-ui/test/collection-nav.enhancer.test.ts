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
