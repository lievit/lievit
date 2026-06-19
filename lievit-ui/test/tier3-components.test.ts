/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
import { describe, test, expect, afterEach } from "vitest";
// dropdown-menu is now a server-first registry:jte partial (ADR-0012, Wave 3); the Lit island is
// gone. Its server-first contract is pinned in popover.test.ts (registry shape + the native-popover
// seam) — this file keeps only the still-island tier-3 primitives (date-picker, data-table).
import "../registry/components/date-picker/date-picker.js";
import "../registry/components/data-table/data-table.js";

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
      "lv-data-table",
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

// ---------------------------------------------------------------------------
// lv-data-table
// ---------------------------------------------------------------------------
type LvDataTableEl = HTMLElement & {
  columns: Array<{ key: string; label: string; sortable?: boolean; align?: string }>;
  rows: Record<string, unknown>[];
  pageSize: number;
  label: string;
};

describe("lv-data-table", () => {
  const columns = [
    { key: "name", label: "Name" },
    { key: "age", label: "Age", sortable: true },
    { key: "city", label: "City", sortable: false },
  ];
  const rows = [
    { name: "Alice", age: 30, city: "Rome" },
    { name: "Bob", age: 25, city: "Milan" },
    { name: "Carol", age: 35, city: "Turin" },
  ];

  test("renders a table with role=grid", async () => {
    const el = await mount<LvDataTableEl>("lv-data-table", (e) => {
      e.columns = columns;
      e.rows = rows;
    });
    expect(el.querySelector('[role="grid"]')).not.toBeNull();
  });

  test("column headers have role=columnheader", async () => {
    const el = await mount<LvDataTableEl>("lv-data-table", (e) => {
      e.columns = columns;
      e.rows = rows;
    });
    const headers = el.querySelectorAll('[role="columnheader"]');
    expect(headers.length).toBe(columns.length);
  });

  test("sortable column header carries aria-sort=none initially", async () => {
    const el = await mount<LvDataTableEl>("lv-data-table", (e) => {
      e.columns = columns;
      e.rows = rows;
    });
    const headers = el.querySelectorAll('[role="columnheader"]');
    // columns[0] (name) has default sortable=true; aria-sort="none"
    expect(headers[0].getAttribute("aria-sort")).toBe("none");
  });

  test("non-sortable column header has no aria-sort", async () => {
    const el = await mount<LvDataTableEl>("lv-data-table", (e) => {
      e.columns = columns;
      e.rows = rows;
    });
    const headers = el.querySelectorAll('[role="columnheader"]');
    // columns[2] (city) is sortable=false
    expect(headers[2].getAttribute("aria-sort") ?? "").toBe("");
  });

  test("clicking a sortable header emits lv-sort with key and direction", async () => {
    const el = await mount<LvDataTableEl>("lv-data-table", (e) => {
      e.columns = columns;
      e.rows = rows;
    });
    let detail: unknown;
    el.addEventListener("lv-sort", (e) => { detail = (e as CustomEvent).detail; });

    const headers = el.querySelectorAll<HTMLElement>('[role="columnheader"]');
    headers[0].click(); // "name" column
    await (el as unknown as { updateComplete: Promise<unknown> }).updateComplete;

    expect((detail as { key: string }).key).toBe("name");
    expect((detail as { direction: string }).direction).toBe("asc");
  });

  test("clicking same header twice flips direction to desc", async () => {
    const el = await mount<LvDataTableEl>("lv-data-table", (e) => {
      e.columns = columns;
      e.rows = rows;
    });
    const details: unknown[] = [];
    el.addEventListener("lv-sort", (e) => { details.push((e as CustomEvent).detail); });

    const header = el.querySelectorAll<HTMLElement>('[role="columnheader"]')[0];
    header.click();
    await (el as unknown as { updateComplete: Promise<unknown> }).updateComplete;
    header.click();
    await (el as unknown as { updateComplete: Promise<unknown> }).updateComplete;

    expect((details[1] as { direction: string }).direction).toBe("desc");
  });

  test("after ascending sort on name, aria-sort on name header = ascending", async () => {
    const el = await mount<LvDataTableEl>("lv-data-table", (e) => {
      e.columns = columns;
      e.rows = rows;
    });
    const header = el.querySelectorAll<HTMLElement>('[role="columnheader"]')[0];
    header.click();
    await (el as unknown as { updateComplete: Promise<unknown> }).updateComplete;

    expect(header.getAttribute("aria-sort")).toBe("ascending");
  });

  test("renders all rows in the table body", async () => {
    const el = await mount<LvDataTableEl>("lv-data-table", (e) => {
      e.columns = columns;
      e.rows = rows;
    });
    const bodyRows = el.querySelectorAll("tbody tr");
    expect(bodyRows.length).toBe(rows.length);
  });

  test("empty rows shows a 'No data' cell", async () => {
    const el = await mount<LvDataTableEl>("lv-data-table", (e) => {
      e.columns = columns;
      e.rows = [];
    });
    expect(el.querySelector(".lv-table-empty")).not.toBeNull();
  });

  test("pagination appears when pageSize < row count", async () => {
    const el = await mount<LvDataTableEl>("lv-data-table", (e) => {
      e.columns = columns;
      e.rows = rows;
      e.pageSize = 2;
    });
    expect(el.querySelector(".lv-table-pagination")).not.toBeNull();
  });

  test("pagination shows correct number of page buttons", async () => {
    const el = await mount<LvDataTableEl>("lv-data-table", (e) => {
      e.columns = columns;
      e.rows = rows; // 3 rows, pageSize 2 → 2 pages
      e.pageSize = 2;
    });
    // page buttons: prev + page 1 + page 2 + next = 4 buttons
    const btns = el.querySelectorAll(".lv-table-pagination__btn");
    expect(btns.length).toBe(4); // prev, p1, p2, next
  });

  test("clicking page 2 emits lv-page with page=2", async () => {
    const el = await mount<LvDataTableEl>("lv-data-table", (e) => {
      e.columns = columns;
      e.rows = rows;
      e.pageSize = 2;
    });
    let detail: unknown;
    el.addEventListener("lv-page", (e) => { detail = (e as CustomEvent).detail; });

    // page buttons: [prev][1][2][next] — click "2"
    const pageBtns = el.querySelectorAll<HTMLButtonElement>(".lv-table-pagination__btn");
    pageBtns[2].click(); // index 2 = page 2
    await (el as unknown as { updateComplete: Promise<unknown> }).updateComplete;

    expect((detail as { page: number }).page).toBe(2);
  });

  test("pagination hidden when pageSize=0 (show all)", async () => {
    const el = await mount<LvDataTableEl>("lv-data-table", (e) => {
      e.columns = columns;
      e.rows = rows;
      e.pageSize = 0;
    });
    expect(el.querySelector(".lv-table-pagination")).toBeNull();
  });

  test("aria-label on the table is reflected from the label prop", async () => {
    const el = await mount<LvDataTableEl>("lv-data-table", (e) => {
      e.columns = columns;
      e.rows = rows;
      e.label = "User list";
    });
    expect(el.querySelector('[role="grid"]')?.getAttribute("aria-label")).toBe("User list");
  });
});
