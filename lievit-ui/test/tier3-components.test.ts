/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
import { describe, test, expect, afterEach } from "vitest";
// dropdown-menu is now a server-first registry:jte partial (ADR-0012, Wave 3); the Lit island is
// gone. Its server-first contract is pinned in popover.test.ts (registry shape + the native-popover
// seam). date-picker is now a native-<input type=date> registry:jte partial (ADR-0012, Wave 4);
// its Lit island is gone too and its server-first contract is pinned in static-partials-w4.test.ts.
// This file keeps only the still-island tier-3 primitive (data-table).
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
      "lv-data-table",
    ]) {
      const el = await mount(tag);
      expect(el.shadowRoot, `${tag} must be light-DOM`).toBeNull();
    }
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
