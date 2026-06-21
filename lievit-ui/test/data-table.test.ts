/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * Render-asserting checks for the server-first data-table partial family (ADR-0012, Wave 4):
 * data-table.jte + data-table/{row,cell}.jte. The client-side sortable/paginated <lv-data-table>
 * Lit island was removed; the stateful server-sorted/paginated table is OWNED by lievit-kit's admin
 * list (ListingListComponent wire + AdminListView/ListRequest), and lievit-ui ships the
 * presentational primitive that engine composes as a JTE partial.
 *
 * Like the other static-partial suites, this Node harness has no JTE compiler, so the load-bearing
 * contract is pinned on the partial SOURCE as text: real <table>/<thead>/<tbody>, <th scope="col">,
 * the server-sort affordance as a real <a href> carrying aria-sort, the pagination partial wired in,
 * the empty-state row, the rows Content slot, token-only styling, JTE comment syntax, and NO inline
 * <script> / on* handler / Lit island. The real-compiler golden runs out of band via
 * `npm run test:jte-compile` (gg.jte 3.2.4 precompileAll).
 */
import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const jteDir = join(import.meta.dirname, "..", "registry", "jte");
const read = (rel: string) => readFileSync(join(jteDir, rel), "utf8");

const FAMILY = ["data-table.jte", "data-table/row.jte", "data-table/cell.jte"] as const;

describe("data-table family -- shared hygiene", () => {
  test.each(FAMILY)("%s ships with a usage-doc comment (<%-- --%> syntax), no @* *@", (f) => {
    const src = read(f);
    expect(src, "missing <%-- --%> jte comment block").toContain("<%--");
    expect(src, "comment block must close").toContain("--%>");
    expect(src, "must NOT use the @* *@ comment syntax").not.toMatch(/@\*/);
    expect(src, "missing param declaration").toMatch(/@param /);
  });

  test.each(FAMILY)("%s has no inline <script> and ZERO inline on* handlers (strict CSP)", (f) => {
    const src = read(f);
    expect(src).not.toMatch(/<script/i);
    const inlineHandlers = src.match(/\son[a-z]+=/gi) ?? [];
    expect(inlineHandlers, `unexpected inline handlers: ${inlineHandlers.join(", ")}`).toEqual([]);
  });

  test.each(FAMILY)("%s never reaches for Font Awesome / wa-icon / a Lit island", (f) => {
    const src = read(f).toLowerCase();
    expect(src).not.toMatch(/font-?awesome|wa-icon|fa-/);
    // strip the doc comment (it names the dropped island as the superseded tier); the MARKUP
    // must not render a <lv-data-table> island.
    const markup = src.replace(/<%--[\s\S]*?--%>/g, "");
    expect(markup, "no Lit island markup may remain").not.toContain("<lv-data-table");
  });

  test.each(FAMILY)("%s has no em-dash and no hardcoded hex colour (token-only)", (f) => {
    const src = read(f);
    expect(src, "house rule: no em-dash").not.toContain("—");
    // ignore the SHAPE/A11y prose; assert the markup carries --lv-* tokens and no raw hex.
    expect(src).toMatch(/var\(--lv-/);
    const hex = src.replace(/<%--[\s\S]*?--%>/g, "").match(/#[0-9a-fA-F]{3,8}\b/);
    expect(hex, `hardcodes a colour: ${hex?.[0]}`).toBeNull();
  });
});

describe("data-table.jte -- server-first table contract", () => {
  const src = read("data-table.jte");
  const markup = src.replace(/<%--[\s\S]*?--%>/g, "");

  test("declares the server-fact params (headers, sortUrls, sortStates, rows, pagination)", () => {
    expect(src).toMatch(/@param java\.util\.List<String> headers/);
    expect(src).toMatch(/@param java\.util\.List<String> sortUrls/);
    expect(src).toMatch(/@param java\.util\.List<String> sortStates/);
    expect(src).toMatch(/@param gg\.jte\.Content rows/);
    expect(src).toMatch(/@param int page/);
    expect(src).toMatch(/@param int totalPages/);
    expect(src).toMatch(/@param String pageHrefPattern/);
    expect(src).toMatch(/@param int rowCount/);
  });

  test("renders a real <table>/<thead>/<tbody> with <th scope=col> column headers", () => {
    expect(markup).toMatch(/<table\b/);
    expect(markup).toMatch(/<thead\b/);
    expect(markup).toMatch(/<tbody\b/);
    expect(markup).toMatch(/<th\b[\s\S]*?scope="col"/);
  });

  test("shadcn fidelity: the column header baseline is the 36px h-9 token (--lv-space-9)", () => {
    // issue #463 ④ -- the shadcn-faithful compact baseline (h-9), not the old 40px space-10.
    expect(markup).toContain("h-[var(--lv-space-9)]");
    expect(markup).not.toContain("h-[var(--lv-space-10)]");
  });

  test("each column header carries aria-sort (the WAI-ARIA sortable-table signal)", () => {
    expect(markup).toContain("aria-sort=");
    // the active sort maps to ascending/descending; unsorted columns to none.
    expect(markup).toContain("ascending");
    expect(markup).toContain("descending");
    expect(markup).toContain('"none"');
  });

  test("the sort affordance is a real <a href> (re-sorts SERVER-side, works with JS off)", () => {
    expect(markup).toMatch(/<a\s[\s\S]*?href="\$\{url\}"/);
    expect(markup).toContain('data-slot="data-table-sort"');
    // a visible, aria-hidden indicator glyph driven by the active state.
    expect(markup).toMatch(/@template\.lievit\.icon\(name = "chevron-up"/);
    expect(markup).toMatch(/@template\.lievit\.icon\(name = "chevron-down"/);
    expect(markup).toMatch(/@template\.lievit\.icon\(name = "chevrons-up-down"/);
  });

  test("does NOT sort or paginate client-side (no client sort, no events emitted)", () => {
    expect(src).not.toContain("lv-sort");
    expect(src).not.toContain("lv-page");
    expect(src.toLowerCase()).not.toContain("addeventlistener");
    expect(src.toLowerCase()).not.toContain("queryselector");
  });

  test("pagination renders via the pagination partial with the server href pattern", () => {
    expect(markup).toMatch(
      /@template\.lievit\.pagination\(current = page, total = totalPages, hrefPattern = pageHrefPattern\)/
    );
  });

  test("renders the empty state row spanning all columns when rowCount == 0", () => {
    expect(markup).toMatch(/@if\(rowCount == 0\)/);
    expect(markup).toMatch(/colspan="\$\{colCount\}"/);
    expect(markup).toContain('data-slot="data-table-empty"');
    expect(markup).toContain("${emptyText}");
  });

  test("renders the rows Content slot when there are rows (data down, caller owns cells)", () => {
    expect(markup).toContain("${rows}");
  });

  test("an optional caption is the accessible name; aria-label is the fallback", () => {
    expect(markup).toMatch(/<caption\b/);
    expect(markup).toMatch(/aria-label="\$\{caption == null \? ariaLabel : null\}"/);
  });
});

describe("data-table/row.jte + cell.jte -- the composable parts", () => {
  test("row renders a <tr> with selection + id hooks and the cell slot", () => {
    const src = read("data-table/row.jte");
    expect(src).toMatch(/<tr\b/);
    expect(src).toContain('data-slot="data-table-row"');
    expect(src).toContain("data-row-id=");
    expect(src).toMatch(/data-state="\$\{state\.isEmpty\(\) \? null : state\}"/);
    expect(src).toContain("${content}");
  });

  test("cell renders a <td> by default and a <th scope=row> as a row header, with alignment", () => {
    const src = read("data-table/cell.jte");
    expect(src).toMatch(/<td\b/);
    expect(src).toMatch(/<th\b[\s\S]*?scope="row"/);
    expect(src).toMatch(/@param boolean header/);
    expect(src).toMatch(/@param String align/);
    expect(src).toContain("text-right");
    expect(src).toContain("text-center");
    expect(src).toContain("${content}");
  });
});
