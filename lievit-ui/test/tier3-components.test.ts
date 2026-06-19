/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
import { describe, test, expect, afterEach } from "vitest";
// dropdown-menu is now a server-first registry:jte partial (ADR-0012, Wave 3); the Lit island is
// gone. Its server-first contract is pinned in popover.test.ts (registry shape + the native-popover
// seam) — this file keeps only the still-island tier-3 primitive (date-picker). data-table is now a
// server-first registry:jte partial (ADR-0012, Wave 4); the Lit island is gone. Its server-first
// contract is pinned in data-table.test.ts (render-asserting partial source + the registry shape).
import "../registry/components/date-picker/date-picker.js";

async function mount<T extends HTMLElement>(tag: string, set?: (el: T) => void): Promise<T> {
  const el = document.createElement(tag) as T;
  set?.(el);
  document.body.appendChild(el);
  await (el as unknown as { updateComplete: Promise<unknown> }).updateComplete;
  return el;
}

afterEach(() => {
  document.body.innerHTML = "";
});

// ---------------------------------------------------------------------------
// Light DOM check for all tier-3 primitives
// ---------------------------------------------------------------------------
describe("tier-3 light DOM", () => {
  test("every tier-3 primitive renders into the light DOM (no shadow root to pierce)", async () => {
    for (const tag of [
      "lv-date-picker",
    ]) {
      const el = await mount(tag);
      expect(el.shadowRoot, `${tag} must be light-DOM`).toBeNull();
    }
  });
});

// ---------------------------------------------------------------------------
// lv-date-picker
// ---------------------------------------------------------------------------
type LvDatePickerEl = HTMLElement & {
  value: string;
  disabled: boolean;
  invalid: boolean;
  placeholder: string;
};

describe("lv-date-picker", () => {
  test("renders a text input and a calendar toggle button", async () => {
    const el = await mount<LvDatePickerEl>("lv-date-picker");
    expect(el.querySelector("input[type=text]")).not.toBeNull();
    expect(el.querySelector(".lv-dp__toggle")).not.toBeNull();
  });

  test("calendar panel is hidden by default", async () => {
    const el = await mount<LvDatePickerEl>("lv-date-picker");
    expect(el.querySelector(".lv-dp__panel--open")).toBeNull();
  });

  test("clicking the toggle opens the panel with role=dialog", async () => {
    const el = await mount<LvDatePickerEl>("lv-date-picker");
    (el.querySelector(".lv-dp__toggle") as HTMLButtonElement).click();
    await (el as unknown as { updateComplete: Promise<unknown> }).updateComplete;
    const panel = el.querySelector(".lv-dp__panel--open");
    expect(panel).not.toBeNull();
    expect(panel?.getAttribute("role")).toBe("dialog");
    expect(panel?.getAttribute("aria-modal")).toBe("true");
  });

  test("calendar renders a role=grid with columnheader cells", async () => {
    const el = await mount<LvDatePickerEl>("lv-date-picker");
    (el.querySelector(".lv-dp__toggle") as HTMLButtonElement).click();
    await (el as unknown as { updateComplete: Promise<unknown> }).updateComplete;
    expect(el.querySelector('[role="grid"]')).not.toBeNull();
    expect(el.querySelector('[role="columnheader"]')).not.toBeNull();
  });

  test("day buttons have role=gridcell containers and aria-label", async () => {
    const el = await mount<LvDatePickerEl>("lv-date-picker");
    (el.querySelector(".lv-dp__toggle") as HTMLButtonElement).click();
    await (el as unknown as { updateComplete: Promise<unknown> }).updateComplete;
    const dayBtns = el.querySelectorAll<HTMLElement>(".lv-dp__day");
    expect(dayBtns.length).toBeGreaterThan(0);
    // first day button has an aria-label describing the full date
    expect(dayBtns[0].getAttribute("aria-label")).toBeTruthy();
  });

  test("clicking a day selects it, emits lv-change, and closes the panel", async () => {
    const el = await mount<LvDatePickerEl>("lv-date-picker");
    let detail: unknown;
    el.addEventListener("lv-change", (e) => { detail = (e as CustomEvent).detail; });

    (el.querySelector(".lv-dp__toggle") as HTMLButtonElement).click();
    await (el as unknown as { updateComplete: Promise<unknown> }).updateComplete;

    const dayBtns = el.querySelectorAll<HTMLButtonElement>(".lv-dp__day");
    const firstBtn = dayBtns[0];
    const expectedDate = firstBtn.dataset.date as string;
    firstBtn.click();
    await (el as unknown as { updateComplete: Promise<unknown> }).updateComplete;

    expect(detail).toBe(expectedDate);
    expect(el.value).toBe(expectedDate);
    expect(el.querySelector(".lv-dp__panel--open")).toBeNull();
  });

  test("selected day gets aria-selected=true", async () => {
    const el = await mount<LvDatePickerEl>("lv-date-picker");

    // open and select first day
    (el.querySelector(".lv-dp__toggle") as HTMLButtonElement).click();
    await (el as unknown as { updateComplete: Promise<unknown> }).updateComplete;
    const firstBtn = el.querySelectorAll<HTMLButtonElement>(".lv-dp__day")[0];
    const dateKey = firstBtn.dataset.date!;
    firstBtn.click();
    await (el as unknown as { updateComplete: Promise<unknown> }).updateComplete;

    // reopen to verify aria-selected
    (el.querySelector(".lv-dp__toggle") as HTMLButtonElement).click();
    await (el as unknown as { updateComplete: Promise<unknown> }).updateComplete;
    const selectedBtn = el.querySelector<HTMLButtonElement>(`[data-date="${dateKey}"]`);
    expect(selectedBtn?.getAttribute("aria-selected")).toBe("true");
  });

  test("toggle button has aria-haspopup=dialog", async () => {
    const el = await mount<LvDatePickerEl>("lv-date-picker");
    expect(el.querySelector(".lv-dp__toggle")?.getAttribute("aria-haspopup")).toBe("dialog");
  });

  test("disabled prevents the panel from opening", async () => {
    const el = await mount<LvDatePickerEl>("lv-date-picker", (e) => {
      e.disabled = true;
    });
    (el.querySelector(".lv-dp__toggle") as HTMLButtonElement).click();
    await (el as unknown as { updateComplete: Promise<unknown> }).updateComplete;
    expect(el.querySelector(".lv-dp__panel--open")).toBeNull();
  });

  test("invalid sets aria-invalid on the input", async () => {
    const el = await mount<LvDatePickerEl>("lv-date-picker", (e) => {
      e.invalid = true;
    });
    expect(
      (el.querySelector("input") as HTMLInputElement).getAttribute("aria-invalid")
    ).toBe("true");
  });

  test("prev/next month nav buttons are present when panel is open", async () => {
    const el = await mount<LvDatePickerEl>("lv-date-picker");
    (el.querySelector(".lv-dp__toggle") as HTMLButtonElement).click();
    await (el as unknown as { updateComplete: Promise<unknown> }).updateComplete;
    const navBtns = el.querySelectorAll(".lv-dp__nav");
    expect(navBtns.length).toBe(2);
  });
});
