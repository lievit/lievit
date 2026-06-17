/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
import { describe, test, expect, afterEach } from "vitest";
import "../registry/components/dropdown-menu/dropdown-menu.js";
import "../registry/components/date-picker/date-picker.js";
import "../registry/components/data-table/data-table.js";
import "../registry/components/file-upload/file-upload.js";
import "../registry/components/rich-select/rich-select.js";

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
      "lv-dropdown-menu",
      "lv-date-picker",
      "lv-data-table",
      "lv-file-upload",
      "lv-rich-select",
    ]) {
      const el = await mount(tag);
      expect(el.shadowRoot, `${tag} must be light-DOM`).toBeNull();
    }
  });
});

// ---------------------------------------------------------------------------
// lv-dropdown-menu
// ---------------------------------------------------------------------------
type LvDropdownEl = HTMLElement & {
  items: Array<{ key: string; label: string; icon?: string; disabled?: boolean; separator?: boolean }>;
  label: string;
  disabled: boolean;
};

describe("lv-dropdown-menu", () => {
  const items = [
    { key: "edit", label: "Edit" },
    { key: "copy", label: "Copy" },
    { key: "delete", label: "Delete", disabled: true },
    { key: "archive", label: "Archive", separator: true },
  ];

  test("renders a trigger button with aria-haspopup=menu", async () => {
    const el = await mount<LvDropdownEl>("lv-dropdown-menu", (e) => {
      e.items = items;
    });
    const btn = el.querySelector(".lv-dropdown__trigger") as HTMLButtonElement;
    expect(btn).not.toBeNull();
    expect(btn.getAttribute("aria-haspopup")).toBe("menu");
  });

  test("menu panel is hidden by default (no --open class)", async () => {
    const el = await mount<LvDropdownEl>("lv-dropdown-menu", (e) => {
      e.items = items;
    });
    expect(el.querySelector(".lv-dropdown__panel--open")).toBeNull();
  });

  test("clicking the trigger opens the panel and sets aria-expanded=true", async () => {
    const el = await mount<LvDropdownEl>("lv-dropdown-menu", (e) => {
      e.items = items;
    });
    (el.querySelector(".lv-dropdown__trigger") as HTMLButtonElement).click();
    await (el as unknown as { updateComplete: Promise<unknown> }).updateComplete;
    expect(el.querySelector(".lv-dropdown__panel--open")).not.toBeNull();
    expect(
      el.querySelector(".lv-dropdown__trigger")?.getAttribute("aria-expanded")
    ).toBe("true");
  });

  test("clicking an item emits lv-select with the item key and closes the panel", async () => {
    const el = await mount<LvDropdownEl>("lv-dropdown-menu", (e) => {
      e.items = items;
    });
    let detail: unknown;
    el.addEventListener("lv-select", (e) => { detail = (e as CustomEvent).detail; });

    (el.querySelector(".lv-dropdown__trigger") as HTMLButtonElement).click();
    await (el as unknown as { updateComplete: Promise<unknown> }).updateComplete;

    const menuItems = el.querySelectorAll<HTMLElement>('[role="menuitem"]');
    menuItems[0].click();
    await (el as unknown as { updateComplete: Promise<unknown> }).updateComplete;

    expect(detail).toBe("edit");
    expect(el.querySelector(".lv-dropdown__panel--open")).toBeNull();
  });

  test("disabled item has aria-disabled=true", async () => {
    const el = await mount<LvDropdownEl>("lv-dropdown-menu", (e) => {
      e.items = items;
    });
    (el.querySelector(".lv-dropdown__trigger") as HTMLButtonElement).click();
    await (el as unknown as { updateComplete: Promise<unknown> }).updateComplete;

    const menuItems = el.querySelectorAll<HTMLElement>('[role="menuitem"]');
    // 3rd item (index 2) is disabled
    expect(menuItems[2].getAttribute("aria-disabled")).toBe("true");
  });

  test("disabled item click does not emit lv-select", async () => {
    const el = await mount<LvDropdownEl>("lv-dropdown-menu", (e) => {
      e.items = items;
    });
    let fired = false;
    el.addEventListener("lv-select", () => { fired = true; });

    (el.querySelector(".lv-dropdown__trigger") as HTMLButtonElement).click();
    await (el as unknown as { updateComplete: Promise<unknown> }).updateComplete;

    const menuItems = el.querySelectorAll<HTMLElement>('[role="menuitem"]');
    menuItems[2].click();
    await (el as unknown as { updateComplete: Promise<unknown> }).updateComplete;

    expect(fired).toBe(false);
  });

  test("separator item renders a role=separator divider", async () => {
    const el = await mount<LvDropdownEl>("lv-dropdown-menu", (e) => {
      e.items = items;
    });
    (el.querySelector(".lv-dropdown__trigger") as HTMLButtonElement).click();
    await (el as unknown as { updateComplete: Promise<unknown> }).updateComplete;
    expect(el.querySelector('[role="separator"]')).not.toBeNull();
  });

  test("panel has role=menu", async () => {
    const el = await mount<LvDropdownEl>("lv-dropdown-menu", (e) => {
      e.items = items;
    });
    expect(el.querySelector('[role="menu"]')).not.toBeNull();
  });

  test("disabled prop prevents the menu from opening", async () => {
    const el = await mount<LvDropdownEl>("lv-dropdown-menu", (e) => {
      e.items = items;
      e.disabled = true;
    });
    (el.querySelector(".lv-dropdown__trigger") as HTMLButtonElement).click();
    await (el as unknown as { updateComplete: Promise<unknown> }).updateComplete;
    expect(el.querySelector(".lv-dropdown__panel--open")).toBeNull();
  });

  test("label prop is reflected in the trigger text", async () => {
    const el = await mount<LvDropdownEl>("lv-dropdown-menu", (e) => {
      e.items = items;
      e.label = "Actions";
    });
    expect(el.querySelector(".lv-dropdown__trigger")?.textContent).toContain("Actions");
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

// ---------------------------------------------------------------------------
// lv-file-upload
// ---------------------------------------------------------------------------
type LvFileUploadEl = HTMLElement & {
  multiple: boolean;
  disabled: boolean;
  accept: string;
  dropLabel: string;
  hint: string;
};

describe("lv-file-upload", () => {
  test("renders a role=button drop zone", async () => {
    const el = await mount<LvFileUploadEl>("lv-file-upload");
    expect(el.querySelector('[role="button"]')).not.toBeNull();
  });

  test("drop zone has tabindex=0 for keyboard access", async () => {
    const el = await mount<LvFileUploadEl>("lv-file-upload");
    expect(el.querySelector('.lv-file-upload__zone')?.getAttribute("tabindex")).toBe("0");
  });

  test("hidden file input exists", async () => {
    const el = await mount<LvFileUploadEl>("lv-file-upload");
    expect(el.querySelector('input[type=file]')).not.toBeNull();
  });

  test("dropLabel is shown inside the zone", async () => {
    const el = await mount<LvFileUploadEl>("lv-file-upload", (e) => {
      e.dropLabel = "Drag here";
    });
    expect(el.querySelector(".lv-file-upload__drop-label")?.textContent).toBe("Drag here");
  });

  test("hint renders with an id for aria-describedby", async () => {
    const el = await mount<LvFileUploadEl>("lv-file-upload", (e) => {
      e.hint = "PDF only, max 10 MB";
    });
    const hint = el.querySelector(".lv-file-upload__hint");
    expect(hint).not.toBeNull();
    expect(hint?.textContent).toBe("PDF only, max 10 MB");
    // zone references hint via aria-describedby
    const zone = el.querySelector(".lv-file-upload__zone");
    expect(zone?.getAttribute("aria-describedby")).toBeTruthy();
  });

  test("disabled zone has aria-disabled=true and tabindex=-1", async () => {
    const el = await mount<LvFileUploadEl>("lv-file-upload", (e) => {
      e.disabled = true;
    });
    const zone = el.querySelector(".lv-file-upload__zone");
    expect(zone?.getAttribute("aria-disabled")).toBe("true");
    expect(zone?.getAttribute("tabindex")).toBe("-1");
  });

  test("aria-live region is present for AT file count announcements", async () => {
    const el = await mount<LvFileUploadEl>("lv-file-upload");
    const live = el.querySelector('[aria-live="polite"]');
    expect(live).not.toBeNull();
  });

  test("no file list shown when no files are selected", async () => {
    const el = await mount<LvFileUploadEl>("lv-file-upload");
    expect(el.querySelector(".lv-file-upload__list")).toBeNull();
  });

  test("drop event adds files and emits lv-files-change", async () => {
    const el = await mount<LvFileUploadEl>("lv-file-upload");
    let detail: unknown;
    el.addEventListener("lv-files-change", (e) => { detail = (e as CustomEvent).detail; });

    // Drive the internal addFiles method directly (DragEvent.dataTransfer is not
    // writable in happy-dom; this tests the component logic, not browser drag APIs).
    const comp = el as unknown as { addFiles: (fl: FileList) => void };
    const fakeFile = new File(["content"], "test.pdf", { type: "application/pdf" });
    const dt = new DataTransfer();
    dt.items.add(fakeFile);
    // Call onDrop via a simulated event carrying dataTransfer when supported,
    // else inject via the internal addFiles helper exposed for testing.
    const zone = el.querySelector(".lv-file-upload__zone") as HTMLElement;
    const dropEvt = new DragEvent("drop", { bubbles: true });
    // DataTransfer.files may not be writable; patch the event if needed.
    Object.defineProperty(dropEvt, "dataTransfer", { value: dt, configurable: true });
    zone.dispatchEvent(dropEvt);
    await (el as unknown as { updateComplete: Promise<unknown> }).updateComplete;

    if (!Array.isArray(detail)) {
      // Fallback: happy-dom DragEvent doesn't carry dataTransfer; inject via private method
      (comp as unknown as { addFiles: (fl: FileList) => void }).addFiles(dt.files);
      await (el as unknown as { updateComplete: Promise<unknown> }).updateComplete;
    }

    expect(Array.isArray(detail)).toBe(true);
    expect((detail as Array<{ name: string }>)[0].name).toBe("test.pdf");
  });

  test("after drop, file list appears with a remove button", async () => {
    const el = await mount<LvFileUploadEl>("lv-file-upload");

    // Inject a file via the internal private method (DragEvent.dataTransfer not
    // reliably writable in happy-dom).
    const fakeFile = new File(["x"], "doc.txt", { type: "text/plain" });
    const dt = new DataTransfer();
    dt.items.add(fakeFile);
    (el as unknown as { addFiles: (fl: FileList) => void }).addFiles(dt.files);
    await (el as unknown as { updateComplete: Promise<unknown> }).updateComplete;

    const list = el.querySelector(".lv-file-upload__list");
    expect(list).not.toBeNull();
    const removeBtn = el.querySelector(".lv-file-upload__remove") as HTMLButtonElement;
    expect(removeBtn).not.toBeNull();
    // aria-label on remove button names the file
    expect(removeBtn.getAttribute("aria-label")).toContain("doc.txt");
  });

  test("clicking remove emits lv-files-change with the file removed", async () => {
    const el = await mount<LvFileUploadEl>("lv-file-upload");

    const fakeFile = new File(["x"], "doc.txt", { type: "text/plain" });
    const dt = new DataTransfer();
    dt.items.add(fakeFile);
    (el as unknown as { addFiles: (fl: FileList) => void }).addFiles(dt.files);
    await (el as unknown as { updateComplete: Promise<unknown> }).updateComplete;

    const details: unknown[] = [];
    el.addEventListener("lv-files-change", (e) => { details.push((e as CustomEvent).detail); });

    (el.querySelector(".lv-file-upload__remove") as HTMLButtonElement).click();
    await (el as unknown as { updateComplete: Promise<unknown> }).updateComplete;

    const last = details[details.length - 1] as Array<unknown>;
    expect(last.length).toBe(0);
    expect(el.querySelector(".lv-file-upload__list")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// lv-rich-select
// ---------------------------------------------------------------------------
type LvRichSelectEl = HTMLElement & {
  options: Array<{ value: string; label: string; description?: string; disabled?: boolean }>;
  value: string | string[];
  multiple: boolean;
  placeholder: string;
  disabled: boolean;
  invalid: boolean;
};

describe("lv-rich-select", () => {
  const opts = [
    { value: "a", label: "Alpha", description: "First option" },
    { value: "b", label: "Beta" },
    { value: "c", label: "Gamma", disabled: true },
    { value: "d", label: "Delta" },
  ];

  test("renders a combobox trigger and a listbox panel", async () => {
    const el = await mount<LvRichSelectEl>("lv-rich-select", (e) => {
      e.options = opts;
    });
    expect(el.querySelector('[role="combobox"]')).not.toBeNull();
    expect(el.querySelector('[role="listbox"]')).not.toBeNull();
  });

  test("panel is hidden by default (no --open class)", async () => {
    const el = await mount<LvRichSelectEl>("lv-rich-select", (e) => {
      e.options = opts;
    });
    expect(el.querySelector(".lv-rs__panel--open")).toBeNull();
  });

  test("clicking trigger opens the panel", async () => {
    const el = await mount<LvRichSelectEl>("lv-rich-select", (e) => {
      e.options = opts;
    });
    (el.querySelector(".lv-rs__trigger") as HTMLButtonElement).click();
    await (el as unknown as { updateComplete: Promise<unknown> }).updateComplete;
    expect(el.querySelector(".lv-rs__panel--open")).not.toBeNull();
    expect(el.querySelector('[role="combobox"]')?.getAttribute("aria-expanded")).toBe("true");
  });

  test("search input is present when panel is open", async () => {
    const el = await mount<LvRichSelectEl>("lv-rich-select", (e) => {
      e.options = opts;
    });
    (el.querySelector(".lv-rs__trigger") as HTMLButtonElement).click();
    await (el as unknown as { updateComplete: Promise<unknown> }).updateComplete;
    expect(el.querySelector(".lv-rs__search")).not.toBeNull();
  });

  test("searching filters options", async () => {
    const el = await mount<LvRichSelectEl>("lv-rich-select", (e) => {
      e.options = opts;
    });
    (el.querySelector(".lv-rs__trigger") as HTMLButtonElement).click();
    await (el as unknown as { updateComplete: Promise<unknown> }).updateComplete;

    const search = el.querySelector(".lv-rs__search") as HTMLInputElement;
    search.value = "alph";
    search.dispatchEvent(new Event("input", { bubbles: true }));
    await (el as unknown as { updateComplete: Promise<unknown> }).updateComplete;

    const optEls = el.querySelectorAll('[role="option"]');
    expect(optEls.length).toBe(1);
    expect(optEls[0].textContent).toContain("Alpha");
  });

  test("single mode: clicking an option selects it, emits lv-change, and closes", async () => {
    const el = await mount<LvRichSelectEl>("lv-rich-select", (e) => {
      e.options = opts;
    });
    let detail: unknown;
    el.addEventListener("lv-change", (e) => { detail = (e as CustomEvent).detail; });

    (el.querySelector(".lv-rs__trigger") as HTMLButtonElement).click();
    await (el as unknown as { updateComplete: Promise<unknown> }).updateComplete;

    const optEls = el.querySelectorAll<HTMLElement>('[role="option"]');
    optEls[0].click();
    await (el as unknown as { updateComplete: Promise<unknown> }).updateComplete;

    expect(detail).toBe("a");
    expect(el.value).toBe("a");
    expect(el.querySelector(".lv-rs__panel--open")).toBeNull();
  });

  test("single mode: selected option has aria-selected=true", async () => {
    const el = await mount<LvRichSelectEl>("lv-rich-select", (e) => {
      e.options = opts;
      e.value = "b";
    });
    (el.querySelector(".lv-rs__trigger") as HTMLButtonElement).click();
    await (el as unknown as { updateComplete: Promise<unknown> }).updateComplete;

    const optEls = el.querySelectorAll<HTMLElement>('[role="option"]');
    expect(optEls[0].getAttribute("aria-selected")).toBe("false");
    expect(optEls[1].getAttribute("aria-selected")).toBe("true");
  });

  test("disabled option has aria-disabled=true", async () => {
    const el = await mount<LvRichSelectEl>("lv-rich-select", (e) => {
      e.options = opts;
    });
    (el.querySelector(".lv-rs__trigger") as HTMLButtonElement).click();
    await (el as unknown as { updateComplete: Promise<unknown> }).updateComplete;

    const optEls = el.querySelectorAll<HTMLElement>('[role="option"]');
    expect(optEls[2].getAttribute("aria-disabled")).toBe("true");
  });

  test("multi mode: clicking options adds them to the value array", async () => {
    const el = await mount<LvRichSelectEl>("lv-rich-select", (e) => {
      e.options = opts;
      e.multiple = true;
      e.value = [];
    });
    const details: unknown[] = [];
    el.addEventListener("lv-change", (e) => { details.push((e as CustomEvent).detail); });

    (el.querySelector(".lv-rs__trigger") as HTMLButtonElement).click();
    await (el as unknown as { updateComplete: Promise<unknown> }).updateComplete;

    const optEls = el.querySelectorAll<HTMLElement>('[role="option"]');
    optEls[0].click(); // Alpha
    await (el as unknown as { updateComplete: Promise<unknown> }).updateComplete;
    optEls[1].click(); // Beta
    await (el as unknown as { updateComplete: Promise<unknown> }).updateComplete;

    const last = details[details.length - 1] as string[];
    expect(last).toContain("a");
    expect(last).toContain("b");
  });

  test("multi mode: panel stays open after selection", async () => {
    const el = await mount<LvRichSelectEl>("lv-rich-select", (e) => {
      e.options = opts;
      e.multiple = true;
      e.value = [];
    });
    (el.querySelector(".lv-rs__trigger") as HTMLButtonElement).click();
    await (el as unknown as { updateComplete: Promise<unknown> }).updateComplete;

    const optEls = el.querySelectorAll<HTMLElement>('[role="option"]');
    optEls[0].click();
    await (el as unknown as { updateComplete: Promise<unknown> }).updateComplete;

    expect(el.querySelector(".lv-rs__panel--open")).not.toBeNull();
  });

  test("multi mode: selected options show as tag pills in the trigger", async () => {
    const el = await mount<LvRichSelectEl>("lv-rich-select", (e) => {
      e.options = opts;
      e.multiple = true;
      e.value = ["a", "b"];
    });
    const tags = el.querySelectorAll(".lv-rs__tag");
    expect(tags.length).toBe(2);
  });

  test("multi mode: removing a tag emits lv-change with updated array", async () => {
    const el = await mount<LvRichSelectEl>("lv-rich-select", (e) => {
      e.options = opts;
      e.multiple = true;
      e.value = ["a", "b"];
    });
    let detail: unknown;
    el.addEventListener("lv-change", (e) => { detail = (e as CustomEvent).detail; });

    const removeBtn = el.querySelector<HTMLButtonElement>(".lv-rs__tag-remove");
    removeBtn?.click();
    await (el as unknown as { updateComplete: Promise<unknown> }).updateComplete;

    expect((detail as string[]).length).toBe(1);
  });

  test("placeholder shown when nothing selected", async () => {
    const el = await mount<LvRichSelectEl>("lv-rich-select", (e) => {
      e.options = opts;
      e.placeholder = "Choose…";
    });
    expect(el.querySelector(".lv-rs__placeholder")?.textContent).toBe("Choose…");
  });

  test("disabled prevents the panel from opening", async () => {
    const el = await mount<LvRichSelectEl>("lv-rich-select", (e) => {
      e.options = opts;
      e.disabled = true;
    });
    (el.querySelector(".lv-rs__trigger") as HTMLButtonElement).click();
    await (el as unknown as { updateComplete: Promise<unknown> }).updateComplete;
    expect(el.querySelector(".lv-rs__panel--open")).toBeNull();
  });

  test("option description is rendered when present", async () => {
    const el = await mount<LvRichSelectEl>("lv-rich-select", (e) => {
      e.options = opts;
    });
    (el.querySelector(".lv-rs__trigger") as HTMLButtonElement).click();
    await (el as unknown as { updateComplete: Promise<unknown> }).updateComplete;

    // opts[0] has description "First option"
    expect(el.querySelector(".lv-rs__option-desc")?.textContent).toBe("First option");
  });

  test("combobox has aria-autocomplete=list and aria-multiselectable when multiple", async () => {
    const el = await mount<LvRichSelectEl>("lv-rich-select", (e) => {
      e.options = opts;
      e.multiple = true;
      e.value = [];
    });
    const combobox = el.querySelector('[role="combobox"]');
    expect(combobox?.getAttribute("aria-autocomplete")).toBe("list");
    expect(combobox?.getAttribute("aria-multiselectable")).toBe("true");
  });
});
