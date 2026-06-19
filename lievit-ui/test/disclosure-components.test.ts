/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
import { describe, test, expect, afterEach } from "vitest";
import "../registry/components/collapsible/collapsible.js";
import "../registry/components/toggle/toggle.js";
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
    for (const tag of ["lv-collapsible", "lv-toggle", "lv-toggle-group"]) {
      const el = await mount(tag);
      expect(el.shadowRoot, `${tag} must be light-DOM`).toBeNull();
    }
  });
});

// ---------------------------------------------------------------------------
// lv-collapsible
// ---------------------------------------------------------------------------
type LvCollapsibleEl = HTMLElement & { label: string; open: boolean; disabled: boolean };

describe("lv-collapsible", () => {
  test("trigger is a button carrying aria-expanded + aria-controls", async () => {
    const el = await mount<LvCollapsibleEl>("lv-collapsible", (e) => {
      e.label = "Details";
    });
    const trigger = el.querySelector(".lv-collapsible__trigger") as HTMLButtonElement;
    expect(trigger.tagName).toBe("BUTTON");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    const controls = trigger.getAttribute("aria-controls");
    expect(controls).toBeTruthy();
    expect((el.querySelector(`#${controls}`) as HTMLElement)?.getAttribute("role")).toBe("region");
  });

  test("collapsed: the content region is hidden (removed from a11y tree + tab order)", async () => {
    const el = await mount<LvCollapsibleEl>("lv-collapsible", (e) => {
      e.label = "Details";
    });
    const region = el.querySelector(".lv-collapsible__panel") as HTMLElement;
    expect(region.hasAttribute("hidden")).toBe(true);
  });

  test("clicking the trigger expands it: aria-expanded=true, region visible, emits lv-change(true)", async () => {
    const el = await mount<LvCollapsibleEl>("lv-collapsible", (e) => {
      e.label = "Details";
    });
    let detail: unknown;
    el.addEventListener("lv-change", (e) => { detail = (e as CustomEvent).detail; });
    (el.querySelector(".lv-collapsible__trigger") as HTMLButtonElement).click();
    await settle(el);
    expect(detail).toBe(true);
    expect(el.querySelector(".lv-collapsible__trigger")?.getAttribute("aria-expanded")).toBe("true");
    expect((el.querySelector(".lv-collapsible__panel") as HTMLElement).hasAttribute("hidden")).toBe(false);
    expect(el.querySelector(".lv-collapsible__region--open")).not.toBeNull();
  });

  test("clicking again collapses it and emits lv-change(false)", async () => {
    const el = await mount<LvCollapsibleEl>("lv-collapsible", (e) => {
      e.open = true;
      e.label = "Details";
    });
    let detail: unknown;
    el.addEventListener("lv-change", (e) => { detail = (e as CustomEvent).detail; });
    (el.querySelector(".lv-collapsible__trigger") as HTMLButtonElement).click();
    await settle(el);
    expect(detail).toBe(false);
    expect((el.querySelector(".lv-collapsible__panel") as HTMLElement).hasAttribute("hidden")).toBe(true);
  });

  test("region is labelled by the trigger", async () => {
    const el = await mount<LvCollapsibleEl>("lv-collapsible", (e) => { e.label = "Details"; });
    const trigger = el.querySelector(".lv-collapsible__trigger") as HTMLElement;
    const region = el.querySelector(".lv-collapsible__panel") as HTMLElement;
    expect(region.getAttribute("aria-labelledby")).toBe(trigger.id);
  });

  test("disabled prevents toggling", async () => {
    const el = await mount<LvCollapsibleEl>("lv-collapsible", (e) => {
      e.label = "Details";
      e.disabled = true;
    });
    (el.querySelector(".lv-collapsible__trigger") as HTMLButtonElement).click();
    await settle(el);
    expect(el.open).toBe(false);
  });

  test("renders a Lucide chevron svg (not Font Awesome)", async () => {
    const el = await mount<LvCollapsibleEl>("lv-collapsible", (e) => { e.label = "Details"; });
    expect(el.querySelector(".lv-collapsible__icon svg")).not.toBeNull();
    expect(el.querySelector("i.fa, i.fas, wa-icon")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// lv-toggle
// ---------------------------------------------------------------------------
type LvToggleEl = HTMLElement & {
  pressed: boolean;
  disabled: boolean;
  variant: string;
  size: string;
  icon: string;
  value: string;
};

describe("lv-toggle", () => {
  test("renders a native button with aria-pressed", async () => {
    const el = await mount<LvToggleEl>("lv-toggle");
    const btn = el.querySelector("button") as HTMLButtonElement;
    expect(btn).not.toBeNull();
    expect(btn.getAttribute("aria-pressed")).toBe("false");
  });

  test("pressed maps to aria-pressed=true", async () => {
    const el = await mount<LvToggleEl>("lv-toggle", (e) => { e.pressed = true; });
    expect(el.querySelector("button")?.getAttribute("aria-pressed")).toBe("true");
  });

  test("click toggles pressed and emits lv-change with { pressed, value }", async () => {
    const el = await mount<LvToggleEl>("lv-toggle", (e) => { e.value = "bold"; });
    let detail: { pressed: boolean; value: string } | undefined;
    el.addEventListener("lv-change", (e) => { detail = (e as CustomEvent).detail; });
    (el.querySelector("button") as HTMLButtonElement).click();
    await settle(el);
    expect(el.pressed).toBe(true);
    expect(detail).toEqual({ pressed: true, value: "bold" });
  });

  test("a second click toggles back off", async () => {
    const el = await mount<LvToggleEl>("lv-toggle", (e) => { e.pressed = true; });
    (el.querySelector("button") as HTMLButtonElement).click();
    await settle(el);
    expect(el.pressed).toBe(false);
    expect(el.querySelector("button")?.getAttribute("aria-pressed")).toBe("false");
  });

  test("disabled prevents toggling", async () => {
    const el = await mount<LvToggleEl>("lv-toggle", (e) => { e.disabled = true; });
    (el.querySelector("button") as HTMLButtonElement).click();
    await settle(el);
    expect(el.pressed).toBe(false);
  });

  test("variant and size map to token classes", async () => {
    const el = await mount<LvToggleEl>("lv-toggle", (e) => {
      e.variant = "outline";
      e.size = "lg";
    });
    const btn = el.querySelector("button") as HTMLButtonElement;
    expect(btn.classList.contains("lv-toggle--outline")).toBe(true);
    expect(btn.classList.contains("lv-toggle--lg")).toBe(true);
  });

  test("icon renders a Lucide svg, never Font Awesome", async () => {
    const el = await mount<LvToggleEl>("lv-toggle", (e) => { e.icon = "bell"; });
    expect(el.querySelector(".lv-toggle__icon svg")).not.toBeNull();
    expect(el.querySelector("i.fa, wa-icon")).toBeNull();
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
