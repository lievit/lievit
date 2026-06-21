/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * Render-asserting checks for the shadcn Type-2 data-table FEATURE partials (issue #464):
 * data-table/{selection-cell,toolbar,column-visibility,selection-footer}.jte, plus the
 * checkbox-column spacing rule on the table primitive (table/{head,cell}.jte) and the data-table's
 * own head/cell. These add shadcn's data-table surface (row selection + filter/search + column
 * visibility) as SERVER-FIRST slots: the partials render the structure + the wire hook (l:model /
 * form action), the kit (or a plain controller) wires the round-trip. Sort + paginate + aria-sort
 * already exist (data-table.test.ts) and must NOT regress.
 *
 * As with the sibling suites, this Node harness has no JTE compiler, so the contract is pinned on the
 * partial SOURCE as text: the checkbox column (header select-all + per-row, composing the checkbox
 * partial), the select-all indeterminate tri-state, the selected-count region, the search affordance
 * slot, the column-visibility dropdown structure, the [&:has([role=checkbox])]:pr-0 rule, token-only
 * styling, JTE comment syntax, and NO inline <script> / on* handler. The real-compiler golden runs
 * out of band via `npm run test:jte-compile`.
 */
import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const jteDir = join(import.meta.dirname, "..", "registry", "jte");
const read = (rel: string) => readFileSync(join(jteDir, rel), "utf8");

const NEW_PARTIALS = [
  "data-table/selection-cell.jte",
  "data-table/toolbar.jte",
  "data-table/column-visibility.jte",
  "data-table/selection-footer.jte",
] as const;

describe("data-table Type-2 feature partials -- shared hygiene", () => {
  test.each(NEW_PARTIALS)("%s ships with a usage-doc comment (<%-- --%> syntax), no @* *@", (f) => {
    const src = read(f);
    expect(src, "missing <%-- --%> jte comment block").toContain("<%--");
    expect(src, "comment block must close").toContain("--%>");
    expect(src, "must NOT use the @* *@ comment syntax").not.toMatch(/@\*/);
    expect(src, "missing param declaration").toMatch(/@param /);
  });

  test.each(NEW_PARTIALS)("%s carries the Apache copyright header", (f) => {
    const src = read(f);
    expect(src).toContain("Copyright 2026 Francesco Bilotta");
    expect(src).toContain("Apache License");
  });

  test.each(NEW_PARTIALS)("%s has no inline <script> and ZERO inline on* handlers (strict CSP)", (f) => {
    const src = read(f);
    expect(src).not.toMatch(/<script/i);
    const inlineHandlers = src.match(/\son[a-z]+=/gi) ?? [];
    expect(inlineHandlers, `unexpected inline handlers: ${inlineHandlers.join(", ")}`).toEqual([]);
  });

  test.each(NEW_PARTIALS)("%s never reaches for Font Awesome / wa-icon / a Lit island", (f) => {
    const src = read(f).toLowerCase();
    expect(src).not.toMatch(/font-?awesome|wa-icon|fa-/);
    const markup = src.replace(/<%--[\s\S]*?--%>/g, "");
    expect(markup, "no Lit island markup may remain").not.toContain("<lv-data-table");
  });

  test.each(NEW_PARTIALS)("%s has no em-dash and no hardcoded hex colour (token-only)", (f) => {
    const src = read(f);
    expect(src, "house rule: no em-dash").not.toContain("—");
    expect(src).toMatch(/var\(--lv-/);
    const hex = src.replace(/<%--[\s\S]*?--%>/g, "").match(/#[0-9a-fA-F]{3,8}\b/);
    expect(hex, `hardcodes a colour: ${hex?.[0]}`).toBeNull();
  });
});

describe("data-table/selection-cell.jte -- the checkbox column (row selection)", () => {
  const src = read("data-table/selection-cell.jte");
  const markup = src.replace(/<%--[\s\S]*?--%>/g, "");

  test("declares the selection params (header, name, value, checked, indeterminate, model)", () => {
    expect(src).toMatch(/@param boolean header/);
    expect(src).toMatch(/@param String name/);
    expect(src).toMatch(/@param String value/);
    expect(src).toMatch(/@param boolean checked/);
    expect(src).toMatch(/@param boolean indeterminate/);
    expect(src).toMatch(/@param String model/);
  });

  test("renders a <th scope=col> header cell (select-all) AND a <td> row cell, branched on `header`", () => {
    expect(markup).toMatch(/@if\(header\)/);
    expect(markup).toMatch(/<th\b[\s\S]*?scope="col"/);
    expect(markup).toMatch(/<td\b/);
    expect(markup).toContain('data-slot="data-table-selection-head"');
    expect(markup).toContain('data-slot="data-table-selection-cell"');
  });

  test("composes the lievit checkbox partial in both cells (native checkbox, JS-off submit)", () => {
    const checkboxCalls = markup.match(/@template\.lievit\.checkbox\(/g) ?? [];
    expect(checkboxCalls.length, "header + row both compose the checkbox partial").toBe(2);
  });

  test("the select-all header passes indeterminate (the tri-state 'some rows selected')", () => {
    expect(markup).toMatch(/@template\.lievit\.checkbox\([^)]*indeterminate = indeterminate/);
  });

  test("forwards the l:model wire hook to the checkbox (server-first toggle seam)", () => {
    const checkboxCalls = markup.match(/@template\.lievit\.checkbox\([^)]*\)/g) ?? [];
    expect(checkboxCalls.length).toBeGreaterThan(0);
    for (const call of checkboxCalls) expect(call, `missing model in: ${call}`).toContain("model = model");
  });

  test("gives the checkbox an accessible name (Select all / Select row), no visible label fits", () => {
    expect(markup).toContain("Select all");
    expect(markup).toContain("Select row");
    expect(markup).toMatch(/ariaLabel = label/);
  });

  test("applies the shadcn checkbox-column spacing rule [&:has([role=checkbox])]:pr-0", () => {
    const occurrences = markup.match(/\[&:has\(\[role=checkbox\]\)\]:pr-0/g) ?? [];
    expect(occurrences.length, "both the head and the cell drop right padding").toBe(2);
  });

  test("does NOT toggle selection client-side (no JS, no events emitted)", () => {
    expect(src.toLowerCase()).not.toContain("addeventlistener");
    expect(src.toLowerCase()).not.toContain("queryselector");
  });
});

describe("data-table/selection-footer.jte -- the 'N of M row(s) selected' region", () => {
  const src = read("data-table/selection-footer.jte");
  const markup = src.replace(/<%--[\s\S]*?--%>/g, "");

  test("declares the count params (selected, total) + a bulk-action slot", () => {
    expect(src).toMatch(/@param int selected/);
    expect(src).toMatch(/@param int total/);
    expect(src).toMatch(/@param gg\.jte\.Content actions/);
  });

  test("renders the shadcn count line: '{selected} of {total} {noun}(s) selected.'", () => {
    expect(markup).toContain('data-slot="data-table-selection-info"');
    expect(markup).toMatch(/\$\{selected\} of \$\{total\} \$\{noun\}\(s\) selected\./);
  });

  test("the count is announced live (aria-live=polite) as the selection changes", () => {
    expect(markup).toMatch(/aria-live="polite"/);
  });

  test("the bulk-action slot renders only when there IS a selection (selected > 0)", () => {
    expect(markup).toMatch(/@if\(actions != null && selected > 0\)/);
    expect(markup).toContain('data-slot="data-table-selection-actions"');
  });
});

describe("data-table/toolbar.jte -- the search/filter + actions control row", () => {
  const src = read("data-table/toolbar.jte");
  const markup = src.replace(/<%--[\s\S]*?--%>/g, "");

  test("declares the slot params (search, end) -- both Content slots the caller owns", () => {
    expect(src).toMatch(/@param gg\.jte\.Content search/);
    expect(src).toMatch(/@param gg\.jte\.Content end/);
  });

  test("renders the search affordance slot on the left and an end slot pushed right (ml-auto)", () => {
    expect(markup).toContain('data-slot="data-table-toolbar"');
    expect(markup).toContain('data-slot="data-table-search"');
    expect(markup).toContain('data-slot="data-table-toolbar-end"');
    expect(markup).toContain("ml-auto");
    expect(markup).toContain("${search}");
    expect(markup).toContain("${end}");
  });

  test("the slots are conditional so an absent search/end renders nothing", () => {
    expect(markup).toMatch(/@if\(search != null\)/);
    expect(markup).toMatch(/@if\(end != null\)/);
  });
});

describe("data-table/column-visibility.jte -- the 'Columns' show/hide dropdown", () => {
  const src = read("data-table/column-visibility.jte");
  const markup = src.replace(/<%--[\s\S]*?--%>/g, "");

  test("declares the panel id + label + the items Content slot", () => {
    expect(src).toMatch(/@param String id/);
    expect(src).toMatch(/@param String label/);
    expect(src).toMatch(/@param gg\.jte\.Content content/);
  });

  test("composes the server-first dropdown-menu partial (native popover, zero JS)", () => {
    expect(markup).toMatch(/@template\.lievit\.dropdown-menu\(/);
    expect(markup).toContain('data-slot="data-table-column-visibility"');
    expect(markup).toContain("content = content");
  });

  test("the trigger is the 'Columns' label + a chevron-down affordance", () => {
    expect(markup).toContain("${label}");
    expect(markup).toMatch(/@template\.lievit\.icon\(name = "chevron-down"/);
  });

  test("defaults a unique panel id (the popovertarget); no client toggle code", () => {
    expect(src).toMatch(/@param String id = "lv-data-table-columns"/);
    expect(src.toLowerCase()).not.toContain("addeventlistener");
    expect(src.toLowerCase()).not.toContain("queryselector");
  });
});

describe("checkbox-column spacing rule on the table primitive + data-table (shadcn table.tsx)", () => {
  test("table/head.jte drops right padding when it holds a [role=checkbox]", () => {
    expect(read("table/head.jte")).toContain("[&:has([role=checkbox])]:pr-0");
  });
  test("table/cell.jte drops right padding when it holds a [role=checkbox]", () => {
    expect(read("table/cell.jte")).toContain("[&:has([role=checkbox])]:pr-0");
  });
  test("data-table.jte column head drops right padding when it holds a [role=checkbox]", () => {
    expect(read("data-table.jte")).toContain("[&:has([role=checkbox])]:pr-0");
  });
  test("data-table/cell.jte (both <td> and <th> branches) drops right padding for a checkbox column", () => {
    const occurrences = read("data-table/cell.jte").match(/\[&:has\(\[role=checkbox\]\)\]:pr-0/g) ?? [];
    expect(occurrences.length).toBe(2);
  });
});

describe("the row.jte data-state=selected tint stays the selection sink (no regression)", () => {
  test("data-table/row.jte still tints a selected row via data-state=selected (set by the checkbox column)", () => {
    const src = read("data-table/row.jte");
    expect(src).toMatch(/data-state="\$\{state\.isEmpty\(\) \? null : state\}"/);
    expect(src).toContain("data-[state=selected]:bg-[");
  });
});
