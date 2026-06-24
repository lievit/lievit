<!--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").
-->
# Spec — table / data-table

- **tier**: PARTIAL (base markup, column config, static rows) + HTMX (sort, paginate, filter server-swaps) + optional ENH (`table-select.enhancer.ts`, the irreducible bulk-checkbox client behaviour)
- **build sequence**: S0  (every component ships — no MMP cut, `03`)
- **status (current)**: COVERED (re-forge of `registry/jte/` kit Table family — server sort/paginate/filter already in use by gest)
- **credits** (maintainer note, not a legal record — `02` is "no literal code-copy", output is original):
    - a11y: WAI-ARIA APG Table (`https://www.w3.org/WAI/ARIA/apg/patterns/table/`) + sortable-table
      example (`https://www.w3.org/WAI/ARIA/apg/patterns/table/examples/sortable-table/`).
      Keyboard interaction: "not applicable" per APG — sortable column headers use native `<button>`
      inside `<th scope="col">`, browser supplies Enter/Space for free. No custom enhancer for
      keyboard; the platform gives it. Bulk-select checkbox column is the ONLY irreducible client
      bit (indeterminate state + select-all toggle), handled by `table-select.enhancer.ts`.
    - inventory: Ant Design Table as inventory reference (column config, sort, paginate, filter,
      row actions, bulk-select, expandable rows, fixed columns, virtual scroll stub; virtual rows
      for 10k+ rows lives in `data-grid`, NOT here)
    - styling: ORIGINAL generation over `--lv-*` (OKLCH) tokens; look inspired by Tailwind UI (NO code copied)

## 1. What it is

A server-rendered data table: structured rows of domain data with typed column definitions,
optional server-side sort / pagination / filter via HTMX swaps, optional bulk-select column,
and optional per-row action cells.
The data and the column set are SERVER facts — PARTIAL (or WIRE when sort/filter state must
survive a server round-trip) is the right tier.
Server-first works trivially: the server knows the rows, the columns, the current sort
direction, and the page; HTMX swaps only the `<tbody>` + pagination region on a sort or
page change, preserving scroll position and not re-rendering the full page.
The one irreducible client bit — maintaining the indeterminate state of the select-all
checkbox as individual row checkboxes are toggled — is the optional `table-select.enhancer.ts`
(typed vanilla TS, CSP-clean, fires a wire action or a form submit on bulk-confirm).
This component is the STATIC display + HTMX-swappable result table.
The separately-specced `data-grid` covers the client-virtualized / inline-editable case.

## 2. API — params / props

### 2.a JTE `@param` surface (the table PARTIAL)

| param | type | default | meaning |
|---|---|---|---|
| `columns` | `List<ColumnDef>` | — | **REQUIRED.** Ordered column definitions (see `ColumnDef` below). Drives `<thead>` + cell rendering order. |
| `rows` | `List<RowData>` | — | **REQUIRED.** Typed row records; each cell value is read by its column's `valueKey` or `cellTemplate`. |
| `caption` | `String` | `null` | Visible or visually-hidden `<caption>` text; provides the accessible name for the table (preferred over `ariaLabel` when the caption is visible). |
| `ariaLabel` | `String` | `null` | `aria-label` on `<table>` when no visible caption exists. One of `caption` or `ariaLabel` is **REQUIRED** for an accessible name. |
| `ariaDescribedBy` | `String` | `null` | `aria-describedby` pointing to an external description element id (e.g. a summary paragraph above the table). |
| `size` | `String` | `"md"` | `sm \| md \| lg` — controls cell vertical padding (compact/default/spacious). NOT height-based (tables are not toolbar controls). |
| `bordered` | `boolean` | `false` | Renders outer border + inner cell borders (grid lines). |
| `striped` | `boolean` | `false` | Alternating row background via `:nth-child(even)` + `--lv-color-muted`. |
| `hoverable` | `boolean` | `true` | `:hover` row highlight via `--lv-color-accent`. |
| `stickyHeader` | `boolean` | `false` | `position: sticky; top: 0` on `<thead>` (needs a scroll-area wrapper from the caller). |
| `loading` | `boolean` | `false` | Overlays a spinner + `aria-busy="true"` on the table region; used while an HTMX swap is in flight (the HTMX extension sets this via `htmx:beforeRequest` / `htmx:afterRequest`). |
| `empty` | `gg.jte.Content` | `null` | Slot rendered inside a full-width `<tr>` when `rows` is empty; defaults to the `empty` partial. |
| `selectable` | `boolean` | `false` | Prepends a checkbox column for bulk selection. Requires `table-select.enhancer.ts`. |
| `selectActionSlot` | `gg.jte.Content` | `null` | Toolbar rendered above the table when `selectable=true`; shown / hidden by the enhancer as rows are checked. Contains the bulk-action buttons. |
| `rowId` | `String` | `"id"` | The `RowData` field used as each row's stable identity (written into `data-row-id` for the enhancer + for HTMX row-level swaps). |
| `sortParam` | `String` | `"sort"` | HTMX query-param name for the active sort column id. |
| `directionParam` | `String` | `"dir"` | HTMX query-param name for sort direction (`asc \| desc`). |
| `sortBy` | `String` | `null` | The currently active sort column id (read from server state; sets `aria-sort` on the matching `<th>`). |
| `sortDir` | `String` | `"asc"` | Current sort direction: `asc \| desc`. |
| `htmxTarget` | `String` | `"#table-region"` | The CSS selector of the element HTMX replaces on sort/paginate (the `<div id="table-region">` wrapper). |
| `htmxEndpoint` | `String` | `null` | The URL HTMX posts sort/page/filter changes to. When null, sortable headers render as plain display (no HTMX wiring). |
| `htmxSwap` | `String` | `"innerHTML"` | HTMX `hx-swap` strategy for the region (default: replace the inner HTML, keeping the wrapper div). |
| `cssClass` | `String` | `""` | Extra utility classes on the `<table>` element. |
| `attrs` | `String` | `""` | **TRUSTED raw** (`$unsafe`) — STATIC author-typed attribute strings only (e.g. `data-controller="…"`). |
| `dataAttrs` | `Map<String,String>` | `{}` | **SAFE escaped** dynamic `data-*` on the `<table>` element (each value via `Escape.htmlAttribute`). |

### 2.b `ColumnDef` record (typed, passed by the controller)

| field | type | default | meaning |
|---|---|---|---|
| `id` | `String` | — | Unique column identifier; used as `data-col-id` + the sort param value. |
| `header` | `String` | — | Column header label text (rendered in `<th>`). |
| `valueKey` | `String` | `null` | `RowData` field name to render as plain text. Mutually exclusive with `cellTemplate`. |
| `cellTemplate` | `gg.jte.Content` | `null` | Custom cell slot; receives the row. Use for action cells, badges, links. Mutually exclusive with `valueKey`. |
| `sortable` | `boolean` | `false` | Wraps the header label in a `<button>` that fires the HTMX sort swap. Sets `aria-sort` from `sortBy`/`sortDir`. |
| `scope` | `String` | `"col"` | HTML `scope` attribute value on the `<th>`: `col \| colgroup \| row \| rowgroup`. |
| `width` | `String` | `null` | Inline `width` style on the `<col>` element (e.g. `"120px"`, `"15%"`). |
| `align` | `String` | `"start"` | Cell text alignment: `start \| center \| end`. Maps to `text-align` via utility class. |
| `numeric` | `boolean` | `false` | Right-aligns + applies `tabular-nums` font variant (shortcut for numeric data columns). |
| `rowHeader` | `boolean` | `false` | Renders cells in this column as `<th scope="row">` instead of `<td>` (for row-header columns like names/IDs). |
| `hidden` | `boolean` | `false` | Renders the column's `<col>` with `visibility: collapse` (still in DOM for screen-reader/colspan math; hidden visually). |

### 2.c Pagination params (separate PARTIAL or inline in the table footer)

The pagination region is rendered by the existing `pagination` PARTIAL, composed below the table.
The table partial passes through these to the pagination partial when present:

| param | type | default | meaning |
|---|---|---|---|
| `page` | `int` | `1` | Current page number (1-based). |
| `pageSize` | `int` | `20` | Rows per page. |
| `totalRows` | `long` | `-1` | Total row count across all pages (`-1` = unknown, renders simple prev/next). |
| `pageSizeOptions` | `List<Integer>` | `[10, 20, 50, 100]` | Options for the per-page selector (rendered as `native-select`). |
| `showPagination` | `boolean` | `true` | Renders the footer pagination region when `totalRows > pageSize`. |

### 2.d Enhancer attributes (`data-*` written by the JTE template, read by `table-select.enhancer.ts`)

| attribute | placed on | meaning |
|---|---|---|
| `data-lievit-enhancer="table-select"` | `<table>` root | mounts the enhancer |
| `data-row-id="<escaped id>"` | each `<tr>` in `<tbody>` | stable row identity for the selection set |
| `data-select-all` | the select-all `<th>` checkbox `<input>` | marks the header checkbox for indeterminate / all logic |
| `data-select-row` | each row `<td>` checkbox `<input>` | marks per-row checkboxes |
| `data-bulk-action-bar` | the `selectActionSlot` container `<div>` | shown/hidden by the enhancer |

## 3. Variants / sizes / states

### Variants (display intent)

The table has no `variant` param in the shared intent vocabulary sense (it is not an action/status control).
Visual variants are expressed as boolean flags:

| flag | what it does | token |
|---|---|---|
| `bordered=true` | outer + inner cell borders | `--lv-color-border` |
| `striped=true` | even-row tint | `--lv-color-muted` at 40% opacity |
| `hoverable=true` (default) | row hover highlight | `--lv-color-accent` |
| `stickyHeader=true` | `<thead>` sticks to viewport top | position: sticky, `--lv-color-bg` background, `--lv-shadow-sm` separator |

These are combinable (e.g. bordered + striped is a common data-dense layout).

### Sizes (vertical density, NOT height-based — tables are not toolbar controls)

| size | cell `padding-y` token | use case |
|---|---|---|
| `sm` | `--lv-space-2` | compact / information-dense displays |
| `md` (default) | `--lv-space-3` | standard admin table |
| `lg` | `--lv-space-4` | spacious / touch-friendly rows |

Horizontal cell padding is fixed at `--lv-space-4` across sizes.
Column header `<th>` matches the row `padding-y` of the chosen size.

### States

| state | how expressed | ARIA |
|---|---|---|
| Loading | `loading=true` → spinner overlay + `aria-busy="true"` on the table wrapper | `aria-busy="true"` |
| Empty | `rows` is empty → full-width row with `empty` slot content | `role="row"` + `aria-colspan` = column count |
| Sorted ascending | `sortBy=<colId> sortDir="asc"` → `aria-sort="ascending"` on matching `<th>` | `aria-sort="ascending"` |
| Sorted descending | `sortBy=<colId> sortDir="desc"` → `aria-sort="descending"` on matching `<th>` | `aria-sort="descending"` |
| Unsorted (sortable col) | no `sortBy` or different col → `aria-sort="none"` on sortable headers | `aria-sort="none"` |
| Row selected | checkbox checked → `aria-selected="true"` on the `<tr>` | `aria-selected="true"` |
| Select-all indeterminate | some but not all rows selected → `indeterminate` DOM property on the header checkbox | platform (`indeterminate` is JS-only; the enhancer sets it) |
| Column hidden | `hidden=true` on `ColumnDef` → `<col visibility: collapse>` | column headers stay in the a11y tree (screen readers benefit from knowing the column exists) |

## 4. The a11y contract (the heart — non-negotiable, fully specified)

- **WAI-ARIA pattern**: APG Table (static tabular data with sortable columns).
  Source: `https://www.w3.org/WAI/ARIA/apg/patterns/table/`
  Sortable example: `https://www.w3.org/WAI/ARIA/apg/patterns/table/examples/sortable-table/`
  The APG is explicit: "Keyboard interaction: Not applicable" for the table pattern.
  Sortable headers use native `<button>` inside `<th scope="col">`; the browser supplies
  Enter and Space for free. There are no custom keyboard behaviors beyond what the platform provides.

### Roles + ARIA (what the JTE template emits)

| element | role | required aria-* / attributes | notes |
|---|---|---|---|
| `<table>` | implicit `table` | `aria-label` or `aria-labelledby` (one REQUIRED); optional `aria-describedby`; `aria-rowcount` when paginated (total rows across all pages); `aria-busy` when loading | Use native `<table>` — never a `<div role="table">` |
| `<caption>` | implicit `caption` | — | Preferred accessible name mechanism when the caption is visible; `class="sr-only"` allowed for visually-hidden captions |
| `<thead>` | implicit `rowgroup` | — | |
| `<tbody>` | implicit `rowgroup` | — | HTMX swaps this element (+ the pagination region) on sort/page/filter |
| `<tfoot>` | implicit `rowgroup` | — | Used for the pagination footer when `showPagination=true` |
| `<tr>` (header row) | implicit `row` | — | |
| `<th scope="col">` | implicit `columnheader` | `scope="col"` (HTML attribute, not ARIA); `aria-sort="ascending \| descending \| none"` on sortable columns | `aria-sort` goes on `<th>`, NOT on the inner `<button>` |
| `<th scope="colgroup">` | implicit `columnheader` | `scope="colgroup"` | For spanning group headers |
| `<th scope="row">` | implicit `rowheader` | `scope="row"` | When `ColumnDef.rowHeader=true` |
| `<td>` | implicit `cell` | `aria-rowindex` when paginated (1-based row index within the full dataset) | |
| sort `<button>` inside `<th>` | implicit `button` | — | The button carries the label (column name); sort direction is communicated via `aria-sort` on the parent `<th>`, NOT via the button label |
| sort direction icon `<span>` | — | `aria-hidden="true"` | Visual-only ▲/▼ glyph; screen readers read `aria-sort` on `<th>`, not the glyph |
| select-all `<input type="checkbox">` in `<th>` | implicit `checkbox` | `aria-label="Select all rows"` | Label is explicit because the checkbox has no adjacent visible text in the header cell |
| per-row `<input type="checkbox">` in `<td>` | implicit `checkbox` | `aria-label="Select row <N>"` or `aria-labelledby` → the row's rowheader cell | Must have an accessible name tied to the row identity |
| `<tr>` (body row) | implicit `row` | `aria-selected="true \| false"` when `selectable=true`; `data-row-id="<escaped>"` | |
| empty-state `<tr>` | implicit `row` | `aria-colspan` not a valid ARIA attr; the `<td colspan="N">` is sufficient | Screen readers announce the single cell spanning all columns |
| loading overlay | `role="status"` or `aria-live="polite"` region | `aria-label="Loading"` | Placed OUTSIDE the `<table>` (inside the `<div id="table-region">` wrapper) so screen readers do not read it as a table cell |

### Keyboard map

The APG explicitly states keyboard interaction is "Not applicable" for the `table` role.
All keyboard interaction is supplied by the platform (native HTML elements).

| key | does | who |
|---|---|---|
| Tab | moves focus to the next focusable element in DOM order: sort `<button>` headers → row checkboxes → action cell buttons/links | platform |
| Shift+Tab | reverse tab order | platform |
| Enter / Space (on a sort button) | activates the HTMX sort swap: cycles direction (`none → asc → desc → asc …`) | platform (native `<button>`) — HTMX fires on click |
| Enter / Space (on a row checkbox) | toggles the row selection; the enhancer updates select-all indeterminate state | platform (native `<input type="checkbox">`) |
| Enter / Space (on select-all checkbox) | selects / deselects all visible rows; the enhancer syncs individual row checkboxes | platform → enhancer sets `indeterminate` |
| Enter / Space (on action cell button/link) | triggers the per-row action (wire action via `l:click` or `<a href>` navigation) | platform |

No arrow-key navigation across cells. That belongs to the `data-grid` (APG `role="grid"`) component.
Users navigate a table by Tab / Shift+Tab only; this is the correct APG table model.

### Focus management

- No focus trap, no roving tabindex, no custom focus management: the table is a STATIC STRUCTURE.
- Focus order follows DOM order: left-to-right, top-to-bottom through focusable elements.
- HTMX swaps replace `<tbody>` content; the browser restores focus to the body on a swap.
  The controller MUST return the swap fragment with the same sort-button `id` attributes so the
  browser can find the previously-focused element after the DOM patch (focus preservation via id
  stability, the same principle the lievit bespoke morph uses for wire components).
- The loading overlay must NOT steal focus when it appears/disappears.

### Screen-reader expectations

- Screen readers announce the table's accessible name (caption or `aria-label`) before reading cells.
- When `aria-rowcount` is set (paginated), screen readers announce "row N of M" per row.
- When a column header has `aria-sort="ascending"`, most screen readers announce "Column Name, sorted
  ascending" when the user's focus reaches that header (or its sort button).
- Changing sort direction triggers a DOM swap; the focus stays on (or near) the sort button in the
  new `<thead>`, giving the user immediate feedback through the updated `aria-sort` value.
- The select-all checkbox indeterminate state is set via the DOM `indeterminate` property (not an
  ARIA attribute); screen readers announce it as "mixed" on NVDA/VoiceOver/JAWS when set correctly.
- When rows become selected, `aria-selected="true"` on each `<tr>` allows screen readers in browse
  mode to report which rows are selected when the user revisits them.

### Live region

A `role="status" aria-live="polite"` announcer (the shared announcer partial) is injected into the
`<div id="table-region">` wrapper (outside `<table>`) and announces:
- the row count after a sort or filter swap ("Showing 42 rows, sorted by Name ascending")
- "Loading" while a swap is in flight (when `loading=true`)

## 5. Tokens

### Consumed tokens

| token | used for |
|---|---|
| `--lv-color-bg` | table background; sticky header background |
| `--lv-color-fg` | cell text |
| `--lv-color-muted` | striped even-row tint; empty-state text; column header text (subdued) |
| `--lv-color-border` | bordered table cell borders; sticky header bottom separator; `<hr>`-style section dividers |
| `--lv-color-accent` | row hover highlight background |
| `--lv-color-accent-fg` | row hover highlight text (only if contrast requires; default: `--lv-color-fg`) |
| `--lv-color-primary` | sort button active state (underline / icon colour when column is sorted) |
| `--lv-color-primary-fg` | — |
| `--lv-color-overlay` | loading backdrop (low-opacity tint over the table region) |
| `--lv-space-2` | `sm` cell padding-y |
| `--lv-space-3` | `md` cell padding-y (default) |
| `--lv-space-4` | `lg` cell padding-y; fixed horizontal cell padding |
| `--lv-space-8` | minimum row height guard (so an empty cell row is not zero-height) |
| `--lv-text-sm` | `sm` size cell font |
| `--lv-text-base` | `md`/`lg` size cell font |
| `--lv-text-xs` | column header label font |
| `--lv-font-sans` | all text |
| `--lv-font-mono` | `numeric=true` column cells (tabular-nums, monospace for alignment) |
| `--lv-ring` | focus-visible ring on sort buttons + checkboxes |
| `--lv-radius-sm` | sort button focus ring radius |
| `--lv-shadow-sm` | sticky header bottom shadow separator |
| `--lv-z-sticky` | sticky header z-index above scrolling body rows |
| `--lv-motion-duration` | HTMX swap fade-in on the new `<tbody>` (CSS animation, no JS) |

### NET-NEW tokens proposed

| token | format | light | dark | justification |
|---|---|---|---|---|
| `--lv-color-table-header-bg` | `oklch(L C H)` | `oklch(0.97 0.005 264)` (near-white cool) | `oklch(0.20 0.010 264)` (near-black cool) | Column header background needs a distinct but subtle tint separate from `--lv-color-muted` (which is text). Used only for `<thead>`. Additive — no existing token matches. |
| `--lv-color-row-selected-bg` | `oklch(L C H)` | `oklch(0.93 0.025 264)` (light primary tint) | `oklch(0.22 0.025 264)` (dark primary tint) | Selected row background. Distinct from `--lv-color-accent` (hover) so hover+selected is visually distinguishable. Additive. |
| `--lv-color-row-selected-border` | `oklch(L C H)` | `oklch(0.65 0.08 264)` (primary-hue mid) | `oklch(0.55 0.08 264)` | Left-border accent on selected rows (the Tailwind UI stripe pattern). Additive. |

All three go into BOTH the `:root` block and the `.dark, [data-theme="dark"]` re-point block in
`registry/tokens/lievit-tokens.css`.

## 6. Wire / island integration

### Server-rendered JTE structure

The template is a PARTIAL (not a WIRE component), composed like this:

```
<div id="table-region"           ← HTMX target, aria-live="polite" wrapper
     aria-busy="${loading}"
     data-lievit-enhancer="table-select"   ← only when selectable=true
     data-slot="table-region">
  <!-- shared announcer partial (role=status) -->
  @template.lievit.announcer()

  <!-- optional bulk-action bar, shown/hidden by enhancer -->
  !{if selectActionSlot != null}
    <div data-bulk-action-bar class="hidden …">${selectActionSlot}</div>
  !{/if}

  <div class="overflow-x-auto …">       ← scroll wrapper (caller provides scroll-area if stickyHeader)
    <table aria-label="${ariaLabel}"      ← or aria-labelledby if caption present
           aria-rowcount="${totalRows}"   ← omit when totalRows=-1
           aria-busy="${loading}"
           data-slot="table"
           data-size="${size}"
           ${attrs}>
      <caption class="${caption == null ? 'sr-only' : ''}">${caption ?? ariaLabel}</caption>

      <colgroup>
        !{if selectable}<col style="width: --lv-space-10"/>!{/if}
        !{for col : columns}
          <col !{if col.width != null}style="width: ${col.width}"!{/if}
               !{if col.hidden}style="visibility: collapse"!{/if}/>
        !{/for}
      </colgroup>

      <thead>
        <tr>
          !{if selectable}
          <th scope="col" class="…">
            <input type="checkbox"
                   data-select-all
                   aria-label="Select all rows"
                   class="…"/>
          </th>
          !{/if}
          !{for col : columns}
            !{if col.hidden}<th scope="${col.scope}" class="sr-only">…!{else}
            <th scope="${col.scope}"
                aria-sort="${col.sortable ? (col.id.equals(sortBy) ? (sortDir.equals('asc') ? 'ascending' : 'descending') : 'none') : null}"
                class="…">
              !{if col.sortable && htmxEndpoint != null}
                <button type="button"
                        hx-get="${htmxEndpoint}"
                        hx-target="${htmxTarget}"
                        hx-swap="${htmxSwap}"
                        hx-vals='{"${sortParam}":"${col.id}","${directionParam}":"${nextDir(col)}"}'
                        hx-include="[name='page'],[name='pageSize']"
                        class="…">
                  ${col.header}
                  <span aria-hidden="true" class="…">${sortIcon(col)}</span>
                </button>
              !{else}
                ${col.header}
              !{/if}
            </th>
            !{/if}
          !{/for}
        </tr>
      </thead>

      <tbody>
        !{if rows.isEmpty()}
          <tr><td colspan="${columns.size() + (selectable ? 1 : 0)}" class="…">
            !{if empty != null}${empty}!{else}@template.lievit.empty()!{/if}
          </td></tr>
        !{else}
          !{for row : rows}
            !{var rowIndex = rows.indexOf(row) + 1 + (page - 1) * pageSize}
            <tr aria-selected="${selectable ? 'false' : null}"
                aria-rowindex="${totalRows > 0 ? rowIndex : null}"
                data-row-id="${Escape.htmlAttribute(row.id())}"
                class="…">
              !{if selectable}
              <td class="…">
                <input type="checkbox"
                       data-select-row
                       aria-label="Select row ${rowIndex}"
                       class="…"/>
              </td>
              !{/if}
              !{for col : columns}
                !{if col.rowHeader}
                  <th scope="row" class="…">${row.value(col.valueKey)}</th>
                !{else}
                  <td class="text-${col.align} !{if col.numeric}font-mono tabular-nums!{/if} …">
                    !{if col.cellTemplate != null}${col.cellTemplate}!{else}${row.value(col.valueKey)}!{/if}
                  </td>
                !{/if}
              !{/for}
            </tr>
          !{/for}
        !{/if}
      </tbody>

      !{if showPagination && (totalRows > pageSize || page > 1)}
      <tfoot>
        <tr><td colspan="${columns.size() + (selectable ? 1 : 0)}" class="…">
          @template.lievit.pagination(page=page, pageSize=pageSize, totalRows=totalRows,
                                       pageSizeOptions=pageSizeOptions,
                                       htmxEndpoint=htmxEndpoint, htmxTarget=htmxTarget)
        </td></tr>
      </tfoot>
      !{/if}
    </table>
  </div>
</div>
```

The `nextDir()` and `sortIcon()` helpers are `!{var …}` local computed strings inside the template
(not methods on a Java class — PARTIAL convention; no inline `<script>`).

### HTMX swap round-trip (sort / paginate / filter)

1. User activates a sort button (Enter/Space/click) or pagination link.
2. The `<button>` carries `hx-get`, `hx-target`, `hx-swap`, `hx-vals`, `hx-include`.
3. HTMX fires a GET to `htmxEndpoint` with the sort/page/filter params appended.
4. The controller reads the params, re-queries, re-renders the SAME `@template.lievit.table(…)`
   partial with the updated `rows`, `sortBy`, `sortDir`, `page` values, and returns the HTML
   fragment (just the `<div id="table-region">` inner HTML, not the full page).
5. HTMX replaces the target; the `<tbody>`, pagination footer, and announcer update atomically.
6. The `role="status"` announcer (inside the fragment) announces the new row count + sort state.
7. No lievit wire protocol involved: this is a plain HTMX GET swap, CSP-clean.

### `table-select.enhancer.ts` responsibilities (the typed-TS enhancer)

Only mounted when `selectable=true`. Registered via the directive/lifecycle registry (ADR-0019);
bound to `data-lievit-enhancer="table-select"` on the table wrapper.

**What it does (irreducible client bits — no server round-trip warranted):**

- Sets the select-all checkbox's DOM `indeterminate = (someChecked && !allChecked)` whenever any
  row checkbox changes. This is JS-only (no ARIA attribute equivalent); the platform announces
  "mixed" to screen readers.
- On select-all checked: checks all `data-select-row` checkboxes + sets `aria-selected="true"` on
  their parent `<tr>`.
- On select-all unchecked: unchecks all row checkboxes + sets `aria-selected="false"` on `<tr>`.
- On any row checkbox toggle: updates `aria-selected` on the `<tr>`; recomputes indeterminate on
  select-all; shows/hides `data-bulk-action-bar` (visible when `selectedCount > 0`).
- On HTMX swap (`htmx:afterSwap` event): re-reads the new `<tbody>` checkboxes and resets the
  indeterminate state (the server-returned fragment has all checkboxes unchecked; the enhancer
  recomputes).

**What it does NOT do:**

- It does NOT submit the bulk action. The `data-bulk-action-bar` slot contains a `<form>` or
  button(s) wired by the caller (`l:click` wire action or a standard form POST). The enhancer only
  populates a hidden `<input name="selectedIds">` with the current selection set as a
  comma-separated string before the form submits (or the wire fires).
- It does NOT virtualize rows. Virtual scroll is `data-grid`.
- It does NOT manage filter inputs. Filter controls live outside the table; they fire their own
  HTMX requests to the same `htmxEndpoint`.

**CSP compliance**: no `eval`, no `Function()`, no inline handlers. Reads `dataset.*`, sets DOM
properties, listens to `change` / `htmx:afterSwap`. Fully strict-CSP-safe.

**The typed-TS enhancer fires no wire actions of its own.** It is a pure DOM-state coordinator.
The server round-trip is HTMX (sort/page/filter), not a lievit wire call. This component is the
canonical HTMX pattern example, not a WIRE component.

## 7. Acceptance tests

All tests run on a REAL substrate, not mocked (the client-island-fidelity lesson).

### Render tests (jsdom + real JTE compiler)

- **`TablePartialRenderTest` / basic render**: a table with 3 columns and 2 rows renders a `<table>`,
  a `<caption>` (or the `aria-label` when caption=null), `<thead>` with 3 `<th>` elements each with
  `scope="col"`, and a `<tbody>` with 2 `<tr>` elements each with 3 `<td>` elements. Assert each
  cell contains the expected text from the row data.
- **`TablePartialRenderTest` / accessible name**: a table with `caption="Users"` renders
  `<caption>Users</caption>` visible (not `sr-only`); a table with `ariaLabel="Users"` and no
  caption renders `<caption class="sr-only">Users</caption>` AND `aria-label="Users"` on `<table>`.
  A table with NEITHER fails the axe-core assertion (asserted as a negative test).
- **`TablePartialRenderTest` / sortable column**: `sortBy="name" sortDir="asc"` renders `aria-sort=
  "ascending"` on the Name `<th>`, `aria-sort="none"` on other sortable `<th>` elements, and no
  `aria-sort` on non-sortable `<th>` elements. The sort `<button>` exists inside the sorted header.
  The sort icon `<span>` has `aria-hidden="true"`.
- **`TablePartialRenderTest` / row header column**: a column with `rowHeader=true` renders `<th
  scope="row">` in body rows, not `<td>`.
- **`TablePartialRenderTest` / empty state**: when `rows` is empty, the `<tbody>` contains a single
  `<tr>` with one `<td colspan="N">` containing the `empty` slot content (or the default `empty`
  partial). Assert `colspan` equals the total column count (including the select checkbox column
  when `selectable=true`).
- **`TablePartialRenderTest` / loading state**: `loading=true` sets `aria-busy="true"` on both the
  `<table>` and the `<div id="table-region">` wrapper. The loading announcer region is present with
  `role="status"`.
- **`TablePartialRenderTest` / pagination footer**: when `showPagination=true` and `totalRows > pageSize`,
  a `<tfoot>` is rendered containing the `pagination` partial. When `totalRows <= pageSize`, no
  `<tfoot>` is rendered.
- **`TablePartialRenderTest` / aria-rowcount and aria-rowindex**: when `totalRows=100` and `page=2
  pageSize=10`, `aria-rowcount="100"` is on `<table>`, and the first `<tr>` in `<tbody>` has
  `aria-rowindex="11"` (not 1). When `totalRows=-1`, neither attribute is rendered.
- **`TablePartialRenderTest` / selectable column**: `selectable=true` renders a leading `<th>` with the
  select-all checkbox (`data-select-all`, `aria-label="Select all rows"`), and each body `<tr>` has
  a leading `<td>` with a checkbox (`data-select-row`). Each body `<tr>` has `aria-selected="false"`.
- **`TablePartialRenderTest` / sizes**: `size="sm"` emits `data-size="sm"` on `<table>`; `size="md"`
  emits `data-size="md"`. Each renders the correct padding-y token class.
- **`TablePartialRenderTest` / bordered + striped**: `bordered=true` emits `data-bordered`; `striped=true`
  emits `data-striped`. (The actual CSS is driven by these data attributes + Tailwind utilities.)
- **`TablePartialRenderTest` / numeric column**: a column with `numeric=true` renders `<td>` elements
  with the `font-mono tabular-nums` utility classes.
- **`TablePartialRenderTest` / hidden column**: a column with `hidden=true` renders its `<col>` with
  `visibility: collapse` AND its `<th>`/`<td>` content is in the DOM (not removed — for colspan/
  a11y math to work correctly).
- **`TablePartialRenderTest` / col width**: a column with `width="120px"` renders `<col style="width:
  120px">` in the `<colgroup>`.
- **`TablePartialRenderTest` / JTE compiles + renders**: covered by the `test/jte-compile` real-compiler
  gate (zero compilation errors; precompiled templates work as in prod).

### Axe-core assertions

- **`TableA11yTest` / table accessible-name rule**: `axe-core` reports zero violations of rule
  `table-duplicate-name` and `table-fake-caption` on the rendered DOM.
- **`TableA11yTest` / column-header scope**: zero violations of `scope-attr-valid` (every `<th>` has
  a valid `scope` value).
- **`TableA11yTest` / sortable table**: rendered with `sortBy` active — zero violations; `aria-sort`
  values are valid.
- **`TableA11yTest` / selectable table (checkboxes)**: rendered with `selectable=true` — zero violations
  of `label` and `duplicate-id` rules. Each checkbox has an accessible name.
- **`TableA11yTest` / empty table**: zero violations on the empty-state row.
- **`TableA11yTest` / loading state**: zero violations; `aria-busy` is valid on `<table>`.

### Keyboard tests (REAL substrate, real DOM, real events)

Per the APG, keyboard interaction is platform-supplied. Tests assert the platform behaves correctly
with the markup the template emits.

- **`TableKeyboardTest` / sort button is Tab-reachable**: Tab from outside the table reaches the first
  sort button; Enter activates it (assert the `hx-get` click fires — stub HTMX in jsdom, assert the
  event was dispatched); Space also activates it.
- **`TableKeyboardTest` / sort button accessible name**: the sort button's accessible name (computed
  via `getAccessibleName`) equals the column header text, NOT "▲" or "▼" (the icon is hidden).
- **`TableKeyboardTest` / row checkbox Tab order**: Tab traverses checkboxes in DOM order
  (select-all → row 1 → row 2 → …). Assert focus lands on `data-select-all` first, then
  `data-select-row` elements in sequence.
- **`TableKeyboardTest` / action cell buttons**: Tab after all checkboxes reaches the first action
  cell `<button>` or `<a>`. Enter/Space fires the action (assert the click fires).

### Enhancer tests (real `LievitRuntime` + jsdom, `table-select.enhancer.ts` mounted)

- **`TableSelectEnhancerTest` / select one row sets aria-selected**: check a single row checkbox →
  `aria-selected="true"` on that `<tr>`; select-all indeterminate DOM property = true.
- **`TableSelectEnhancerTest` / select all rows**: check the select-all checkbox → all row checkboxes
  are checked; all `<tr>` have `aria-selected="true"`; select-all `indeterminate` = false.
- **`TableSelectEnhancerTest` / deselect from all**: with all rows checked, uncheck one → select-all
  becomes indeterminate; the unchecked row `<tr>` has `aria-selected="false"`.
- **`TableSelectEnhancerTest` / deselect all via header**: with some rows checked, uncheck select-all
  → all row checkboxes unchecked; all `<tr>` have `aria-selected="false"`; `indeterminate` = false.
- **`TableSelectEnhancerTest` / bulk-action bar visibility**: select zero rows → `data-bulk-action-bar`
  has `class="hidden"`. Select one row → bulk-action bar visible. Deselect all → hidden again.
- **`TableSelectEnhancerTest` / selectedIds populated before submit**: simulate a form submit on the
  bulk-action bar → the hidden `<input name="selectedIds">` value equals the comma-separated list of
  `data-row-id` values of the checked rows.
- **`TableSelectEnhancerTest` / htmx:afterSwap resets selection**: fire `htmx:afterSwap` event on the
  wrapper → all row checkboxes reset to unchecked; select-all `indeterminate` = false; bulk-action
  bar hidden.
- **`TableSelectEnhancerTest` / select-all indeterminate announced as mixed**: with indeterminate=true,
  the select-all checkbox's ARIA state is "mixed" (assert `input.indeterminate === true` — the platform
  maps this to the accessibility tree "mixed" value).

### Escaping (XSS abuse-case)

- **`TableEscapingTest` / hostile row-id in data-row-id**: a `RowData` whose `id()` returns
  `"\"><script>alert(1)</script>"` renders inert: `data-row-id` is HTML-escaped via
  `Escape.htmlAttribute`; the rendered HTML contains no `<script>` tag.
- **`TableEscapingTest` / hostile column id in hx-vals**: a `ColumnDef.id` containing `"` or `'`
  renders safely in the `hx-vals` JSON string (JSON-escaped, not raw-injected); no attribute
  injection is possible.
- **`TableEscapingTest` / hostile cell value**: a cell value containing `<script>alert(1)</script>`
  rendered via `valueKey` (plain string path) is HTML-escaped by the JTE template engine by default
  (`${value}` auto-escapes in JTE); no script executes.
- **`TableEscapingTest` / dataAttrs**: `dataAttrs={"foo": "\">|<script>"}` on the `<table>` renders
  the attribute value HTML-escaped and inert.

### Playwright (gesture fidelity — real browser, legacy-VM oracle)

- **`TableE2ETest` / sort changes displayed rows**: open the gest page that embeds the table, click
  the "Name" column sort button, assert the first row of the new `<tbody>` shows the expected
  alphabetically-first name (real HTMX swap, real server response — not a fake substrate).
- **`TableE2ETest` / pagination changes page**: click "Next page" in the `<tfoot>` pagination,
  assert `aria-rowindex` on the first body row changes from 1 to `pageSize + 1`.
- **`TableE2ETest` / bulk-select gesture**: check two row checkboxes, assert the bulk-action bar
  becomes visible and the select-all checkbox is indeterminate (real browser `indeterminate`
  property, real gesture — not jsdom).
- **`TableE2ETest` / row action**: click a per-row action button (e.g. "Edit"), assert navigation or
  dialog open (the row action's own concern, but the table must render the button reachable).

## 8. Non-goals / anti-patterns

- **NOT `role="grid"`**: this component is a static data table (`role="table"`, implicit). Cell-level
  arrow-key navigation belongs to the `data-grid` component (`role="grid"`, APG Grid pattern, S2).
  Never add arrow-key handlers to this component.
- **NOT client-side sort**: sort always triggers an HTMX server round-trip. Client-side sort of the
  current page is not supported (it would make the `aria-sort` state diverge from the server truth).
  If the caller needs instant sort of a small fixed list, they render the sorted list server-side.
- **NOT client-side virtualization**: rows beyond what the server returns are not virtual-scrolled here.
  A table with 10k rows uses the `data-grid` (S2), not this component.
- **NOT inline cell editing**: read-only display only. Inline editing belongs to `data-grid`.
- **NOT a WIRE component for the base case**: the sort/paginate/filter state is query-param-driven
  (HTMX GET), not a `@Wire` field. The server reconstructs state from the URL params on every request.
  If the caller needs server-persisted filter/sort preferences, the controller saves them; the table
  partial does not own that persistence.
- **NOT an accordion / expandable-row parent**: expandable rows (Ant Design Table `expandable`) are
  a separate concern. If needed, the `accordion` PARTIAL is composed inside a `cellTemplate` in the
  trailing column; this partial does not ship built-in expand/collapse logic.
- **NOT responsible for filter UI**: filter inputs (search boxes, dropdowns) live above the table in
  the caller's markup, fire their own HTMX requests, and include their current values via
  `hx-include`. The table partial renders only the result set it is given.
- **NOT a React-style controlled component**: the table does not manage its own state. The controller
  owns `sortBy`, `sortDir`, `page`, `pageSize`; the partial renders what it receives.
- **AVOID `<div role="table">`**: always use native `<table>` / `<thead>` / `<tbody>` / `<tr>` /
  `<th>` / `<td>`. Native elements give `scope`, `colspan`, `rowspan`, and browser column-width
  algorithms for free. The APG itself recommends native elements for the table pattern.
- **NO literal colour values in the JTE**: every colour is `var(--lv-*)`. No hex, no `rgb()`, no
  `oklch(…)` literals in the component body (the token-lint CI gate enforces this).
- **NO `<script>` or inline `on*=`**: the CSP refuses them and the anti-pattern grep enforces the
  absence. The enhancer loads via the directive/lifecycle registry, never inline.
