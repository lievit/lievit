/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
import { describe, test, expect, afterEach } from "vitest";
import "../registry/components/calendar/calendar.js";

interface CalendarEl extends HTMLElement {
  value: string;
  mode: "single" | "range";
  min: string;
  max: string;
  disabled: boolean;
  weekStart: number;
  locale: string;
  isDisabled: ((iso: string) => boolean) | null;
  updateComplete: Promise<unknown>;
}

async function mount(set?: (el: CalendarEl) => void): Promise<CalendarEl> {
  const el = document.createElement("lv-calendar") as CalendarEl;
  set?.(el);
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

function days(el: CalendarEl): HTMLButtonElement[] {
  return Array.from(el.querySelectorAll<HTMLButtonElement>(".lv-calendar__day"));
}
function day(el: CalendarEl, iso: string): HTMLButtonElement | null {
  return el.querySelector<HTMLButtonElement>(`[data-date="${iso}"]`);
}
function press(el: CalendarEl, key: string) {
  el.querySelector('[role="grid"]')!.dispatchEvent(
    new KeyboardEvent("keydown", { key, bubbles: true })
  );
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("lv-calendar light DOM + structure", () => {
  test("renders into the light DOM (no shadow root)", async () => {
    const el = await mount();
    expect(el.shadowRoot).toBeNull();
  });

  test("renders a role=grid with role=gridcell day cells", async () => {
    const el = await mount((e) => (e.value = "2026-06-15"));
    expect(el.querySelector('[role="grid"]')).not.toBeNull();
    expect(el.querySelectorAll('[role="gridcell"]').length).toBeGreaterThan(27);
  });

  test("shows the month/year label for the value's month", async () => {
    const el = await mount((e) => (e.value = "2026-06-15"));
    expect(el.querySelector(".lv-calendar__label")?.textContent?.trim()).toBe("June 2026");
  });

  test("emits Lucide chevron nav icons, not Font Awesome", async () => {
    const el = await mount();
    const svgs = el.querySelectorAll(".lv-calendar__nav svg");
    expect(svgs.length).toBe(2);
    expect(el.querySelector(".fa, [class*='wa-']")).toBeNull();
  });
});

describe("lv-calendar selection", () => {
  test("marks the selected day with the selected class and aria-selected on its cell", async () => {
    const el = await mount((e) => (e.value = "2026-06-15"));
    const btn = day(el, "2026-06-15")!;
    expect(btn.classList.contains("lv-calendar__day--selected")).toBe(true);
    expect(btn.closest('[role="gridcell"]')?.getAttribute("aria-selected")).toBe("true");
  });

  test("clicking a day emits lv-change with the ISO date", async () => {
    const el = await mount((e) => (e.value = "2026-06-15"));
    let detail: string | null = null;
    el.addEventListener("lv-change", (e) => (detail = (e as CustomEvent).detail));
    day(el, "2026-06-20")!.click();
    expect(detail).toBe("2026-06-20");
    expect(el.value).toBe("2026-06-20");
  });

  test("range mode builds a start,end pair ordered ascending", async () => {
    const el = await mount((e) => {
      e.mode = "range";
      e.value = "2026-06-10";
    });
    day(el, "2026-06-05")!.click();
    await el.updateComplete;
    expect(el.value).toBe("2026-06-05,2026-06-10");
    expect(el.querySelector(".lv-calendar__day--in-range")).not.toBeNull();
  });
});

describe("lv-calendar month navigation", () => {
  test("next/prev month buttons change the visible month", async () => {
    const el = await mount((e) => (e.value = "2026-06-15"));
    el.querySelector<HTMLButtonElement>(".lv-calendar__nav--next")!.click();
    await el.updateComplete;
    expect(el.querySelector(".lv-calendar__label")?.textContent?.trim()).toBe("July 2026");
    el.querySelector<HTMLButtonElement>(".lv-calendar__nav--prev")!.click();
    el.querySelector<HTMLButtonElement>(".lv-calendar__nav--prev")!.click();
    await el.updateComplete;
    expect(el.querySelector(".lv-calendar__label")?.textContent?.trim()).toBe("May 2026");
  });

  test("nav buttons carry the prev/next month classes", async () => {
    const el = await mount();
    expect(el.querySelector(".lv-calendar__nav--prev")).not.toBeNull();
    expect(el.querySelector(".lv-calendar__nav--next")).not.toBeNull();
  });
});

describe("lv-calendar keyboard navigation", () => {
  test("ArrowRight moves focus one day forward", async () => {
    const el = await mount((e) => (e.value = "2026-06-15"));
    press(el, "ArrowRight");
    await el.updateComplete;
    expect(day(el, "2026-06-16")!.getAttribute("tabindex")).toBe("0");
  });

  test("ArrowDown moves focus one week forward", async () => {
    const el = await mount((e) => (e.value = "2026-06-15"));
    press(el, "ArrowDown");
    await el.updateComplete;
    expect(day(el, "2026-06-22")!.getAttribute("tabindex")).toBe("0");
  });

  test("PageDown moves to the next month", async () => {
    const el = await mount((e) => (e.value = "2026-06-15"));
    press(el, "PageDown");
    await el.updateComplete;
    expect(el.querySelector(".lv-calendar__label")?.textContent?.trim()).toBe("July 2026");
  });

  test("Enter selects the focused day", async () => {
    const el = await mount((e) => (e.value = "2026-06-15"));
    let detail: string | null = null;
    el.addEventListener("lv-change", (e) => (detail = (e as CustomEvent).detail));
    press(el, "ArrowRight");
    await el.updateComplete;
    press(el, "Enter");
    expect(detail).toBe("2026-06-16");
  });

  test("exactly one day is in the tab order (roving tabindex)", async () => {
    const el = await mount((e) => (e.value = "2026-06-15"));
    const tabbable = days(el).filter((d) => d.getAttribute("tabindex") === "0");
    expect(tabbable.length).toBe(1);
  });
});

describe("lv-calendar bounds + disabled", () => {
  test("days before min are disabled and not selectable", async () => {
    const el = await mount((e) => {
      e.value = "2026-06-15";
      e.min = "2026-06-10";
    });
    expect(day(el, "2026-06-05")!.disabled).toBe(true);
    let fired = false;
    el.addEventListener("lv-change", () => (fired = true));
    day(el, "2026-06-05")!.click();
    expect(fired).toBe(false);
  });

  test("isDisabled predicate disables matching days", async () => {
    const el = await mount((e) => {
      e.value = "2026-06-15";
      e.isDisabled = (iso) => iso === "2026-06-20";
    });
    expect(day(el, "2026-06-20")!.disabled).toBe(true);
    expect(day(el, "2026-06-21")!.disabled).toBe(false);
  });

  test("disabled calendar disables the nav buttons", async () => {
    const el = await mount((e) => (e.disabled = true));
    expect(el.querySelector<HTMLButtonElement>(".lv-calendar__nav--next")!.disabled).toBe(true);
  });
});

describe("lv-calendar locale + week start", () => {
  test("weekStart=0 puts Sunday first in the header", async () => {
    const el = await mount((e) => {
      e.value = "2026-06-15";
      e.weekStart = 0;
      e.locale = "en-US";
    });
    const first = el.querySelector(".lv-calendar__day-header span")?.textContent?.trim();
    expect(first).toBe("Sun");
  });

  test("weekStart=1 (default) puts Monday first", async () => {
    const el = await mount((e) => {
      e.value = "2026-06-15";
      e.locale = "en-US";
    });
    const first = el.querySelector(".lv-calendar__day-header span")?.textContent?.trim();
    expect(first).toBe("Mon");
  });

  test("today cell carries aria-current=date", async () => {
    const todayISO = new Date().toISOString().slice(0, 10);
    const el = await mount();
    const cell = day(el, todayISO);
    // today is in the default view (anchored on today), so it must exist + be marked
    expect(cell?.getAttribute("aria-current")).toBe("date");
  });
});
