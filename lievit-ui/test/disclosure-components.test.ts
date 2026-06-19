/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
import { describe, test, expect, afterEach } from "vitest";
// collapsible was converted to a server-first WIRE component (ADR-0012, Wave 0); its Lit island
// is gone. Its behaviour now lives in registry/wire/collapsible (Java + JTE), tested in
// test/wire-collapsible.test.ts (registry resolution) + the lievit-kit IT (render + state). The
// toggle island became a server-first JTE partial (ADR-0012, Wave 1b), tested in
// test/jte-static-partials.test.ts; the toggle-group island stays until its own wave.
import "../registry/components/toggle-group/toggle-group.js";

async function mount<T extends HTMLElement>(tag: string, set?: (el: T) => void): Promise<T> {
  const el = document.createElement(tag) as T;
  set?.(el);
  document.body.appendChild(el);
  await (el as unknown as { updateComplete: Promise<unknown> }).updateComplete;
  return el;
}

async function settle(el: HTMLElement) {
  await (el as unknown as { updateComplete: Promise<unknown> }).updateComplete;
}

afterEach(() => {
  document.body.innerHTML = "";
});

// ---------------------------------------------------------------------------
// Light DOM check for all three disclosure/toggle primitives
// ---------------------------------------------------------------------------
describe("disclosure light DOM", () => {
  test("every disclosure primitive renders into the light DOM (no shadow root)", async () => {
    // lv-collapsible dropped (WIRE) + lv-toggle dropped (JTE partial), both per ADR-0012.
    for (const tag of ["lv-toggle-group"]) {
      const el = await mount(tag);
      expect(el.shadowRoot, `${tag} must be light-DOM`).toBeNull();
    }
  });
});

// ---------------------------------------------------------------------------
// lv-toggle-group
// ---------------------------------------------------------------------------
type LvToggleGroupEl = HTMLElement & {
  items: Array<{ value: string; label?: string; icon?: string; disabled?: boolean }>;
  type: "single" | "multiple";
  value: string | string[];
  disabled: boolean;
};

const items = [
  { value: "left", label: "Left" },
  { value: "center", label: "Center" },
  { value: "right", label: "Right", disabled: true },
];

describe("lv-toggle-group (single)", () => {
  test("single: group is radiogroup, items are radios with aria-checked", async () => {
    const el = await mount<LvToggleGroupEl>("lv-toggle-group", (e) => { e.items = items; });
    expect(el.querySelector('[role="radiogroup"]')).not.toBeNull();
    const radios = el.querySelectorAll('[role="radio"]');
    expect(radios.length).toBe(3);
    expect(radios[0].getAttribute("aria-checked")).toBe("false");
  });

  test("clicking an item selects it, emits lv-change(value), aria-checked flips", async () => {
    const el = await mount<LvToggleGroupEl>("lv-toggle-group", (e) => { e.items = items; });
    let detail: unknown;
    el.addEventListener("lv-change", (e) => { detail = (e as CustomEvent).detail; });
    (el.querySelector('[data-value="center"]') as HTMLButtonElement).click();
    await settle(el);
    expect(detail).toBe("center");
    expect(el.querySelector('[data-value="center"]')?.getAttribute("aria-checked")).toBe("true");
  });

  test("selecting a second item deselects the first (single)", async () => {
    const el = await mount<LvToggleGroupEl>("lv-toggle-group", (e) => {
      e.items = items;
      e.value = "left";
    });
    (el.querySelector('[data-value="center"]') as HTMLButtonElement).click();
    await settle(el);
    expect(el.querySelector('[data-value="left"]')?.getAttribute("aria-checked")).toBe("false");
    expect(el.querySelector('[data-value="center"]')?.getAttribute("aria-checked")).toBe("true");
  });

  test("clicking a selected item deselects to empty (Radix single behaviour)", async () => {
    const el = await mount<LvToggleGroupEl>("lv-toggle-group", (e) => {
      e.items = items;
      e.value = "left";
    });
    let detail: unknown;
    el.addEventListener("lv-change", (e) => { detail = (e as CustomEvent).detail; });
    (el.querySelector('[data-value="left"]') as HTMLButtonElement).click();
    await settle(el);
    expect(detail).toBe("");
  });

  test("disabled item cannot be selected", async () => {
    const el = await mount<LvToggleGroupEl>("lv-toggle-group", (e) => { e.items = items; });
    (el.querySelector('[data-value="right"]') as HTMLButtonElement).click();
    await settle(el);
    expect(el.querySelector('[data-value="right"]')?.getAttribute("aria-checked")).toBe("false");
  });
});

describe("lv-toggle-group (roving tabindex)", () => {
  test("exactly one item is tabbable; the rest are -1", async () => {
    const el = await mount<LvToggleGroupEl>("lv-toggle-group", (e) => { e.items = items; });
    const tabbable = Array.from(el.querySelectorAll("button")).filter(
      (b) => b.getAttribute("tabindex") === "0"
    );
    expect(tabbable.length).toBe(1);
    // first enabled item (left) is the roving anchor when nothing is selected
    expect((tabbable[0] as HTMLElement).getAttribute("data-value")).toBe("left");
  });

  test("the selected item becomes the roving anchor", async () => {
    const el = await mount<LvToggleGroupEl>("lv-toggle-group", (e) => {
      e.items = items;
      e.value = "center";
    });
    expect(el.querySelector('[data-value="center"]')?.getAttribute("tabindex")).toBe("0");
    expect(el.querySelector('[data-value="left"]')?.getAttribute("tabindex")).toBe("-1");
  });

  test("ArrowRight moves focus to the next enabled item (skips disabled, loops)", async () => {
    const el = await mount<LvToggleGroupEl>("lv-toggle-group", (e) => { e.items = items; });
    const left = el.querySelector('[data-value="left"]') as HTMLButtonElement;
    left.focus();
    left.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    await settle(el);
    expect(document.activeElement).toBe(el.querySelector('[data-value="center"]'));

    // from center, ArrowRight skips disabled "right" and loops to "left"
    const center = el.querySelector('[data-value="center"]') as HTMLButtonElement;
    center.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    await settle(el);
    expect(document.activeElement).toBe(left);
  });

  test("Home/End jump to first/last enabled item", async () => {
    const el = await mount<LvToggleGroupEl>("lv-toggle-group", (e) => { e.items = items; });
    const center = el.querySelector('[data-value="center"]') as HTMLButtonElement;
    center.focus();
    center.dispatchEvent(new KeyboardEvent("keydown", { key: "Home", bubbles: true }));
    await settle(el);
    expect(document.activeElement).toBe(el.querySelector('[data-value="left"]'));
    // End lands on last ENABLED item (right is disabled) -> center
    center.dispatchEvent(new KeyboardEvent("keydown", { key: "End", bubbles: true }));
    await settle(el);
    expect(document.activeElement).toBe(el.querySelector('[data-value="center"]'));
  });
});

describe("lv-toggle-group (multiple)", () => {
  const mitems = [
    { value: "bold", label: "B" },
    { value: "italic", label: "I" },
    { value: "underline", label: "U" },
  ];

  test("multiple: group is role=group, items are toggle buttons with aria-pressed", async () => {
    const el = await mount<LvToggleGroupEl>("lv-toggle-group", (e) => {
      e.items = mitems;
      e.type = "multiple";
    });
    expect(el.querySelector('[role="group"]')).not.toBeNull();
    expect(el.querySelector('[role="radio"]')).toBeNull();
    expect(el.querySelector('[data-value="bold"]')?.getAttribute("aria-pressed")).toBe("false");
  });

  test("multiple selections accumulate; lv-change carries the array", async () => {
    const el = await mount<LvToggleGroupEl>("lv-toggle-group", (e) => {
      e.items = mitems;
      e.type = "multiple";
    });
    let detail: unknown;
    el.addEventListener("lv-change", (e) => { detail = (e as CustomEvent).detail; });
    (el.querySelector('[data-value="bold"]') as HTMLButtonElement).click();
    await settle(el);
    (el.querySelector('[data-value="italic"]') as HTMLButtonElement).click();
    await settle(el);
    expect(detail).toEqual(["bold", "italic"]);
    expect(el.querySelector('[data-value="bold"]')?.getAttribute("aria-pressed")).toBe("true");
    expect(el.querySelector('[data-value="italic"]')?.getAttribute("aria-pressed")).toBe("true");
  });

  test("clicking a pressed item in multiple deselects just that one", async () => {
    const el = await mount<LvToggleGroupEl>("lv-toggle-group", (e) => {
      e.items = mitems;
      e.type = "multiple";
      e.value = ["bold", "italic"];
    });
    let detail: unknown;
    el.addEventListener("lv-change", (e) => { detail = (e as CustomEvent).detail; });
    (el.querySelector('[data-value="bold"]') as HTMLButtonElement).click();
    await settle(el);
    expect(detail).toEqual(["italic"]);
  });
});
