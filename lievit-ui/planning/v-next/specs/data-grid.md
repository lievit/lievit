<!--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").
-->
# Spec — data-grid (virtualized)

- **tier**: WIRE (+ HTMX for server-sort/filter/page) + ENH (`grid-nav.enhancer.ts` for roving-tabindex
  arrow navigation + virtual-scroll + inline-edit; composes `collection-nav.enhancer.ts` for
  typeahead-on-column-header)
- **build sequence**: S2  (every component ships — no MMP cut, `03`)
- **status (current)**: NET-NEW (no equivalent in the 68 existing templates; the non-virtualized
  `table/data-table` is a distinct HTMX component covering server-paginated display — this component
  is the RICH INTERACTIVE surface: client-virtual rows/cols, frozen cols, inline-cell editing,
  multi-row selection, column resizing, row reorder, server-fetched pages via HTMX under the hood)
- **credits** (maintainer note, not a legal record — `02` is "no literal code-copy", output is original):
    - a11y: WAI-ARIA APG Grid pattern (BUILT against raw APG, not a react-aria reference because react-aria
      `useTable`/`useGrid` is a React hook and cannot be transcribed to a server-first stack without a
      full framework; the interaction model is sourced directly from the APG Data Grid spec at
      https://www.w3.org/WAI/ARIA/apg/patterns/grid/ and the example at
      https://www.w3.org/WAI/ARIA/apg/patterns/grid/examples/data-grids/; roving-tabindex focus model
      confirmed from the APG examples)
    - inventory: Ant Design Table (virtual / ProTable) as inventory reference for the feature matrix:
      virtual scroll, frozen (sticky) columns, inline edit, column resize, bulk select, row actions,
      row expand, empty state; column drag-reorder trimmed (too heavy for v2; re-evaluate at S3)
    - styling: ORIGINAL generation over `--lv-*` (OKLCH) tokens; visual look inspired by Tailwind UI
      table styles (NO code copied)

---

## 1. What it is

A virtualized, interactive data grid: a server-rendered `<table role="grid">` shell with a typed-TS
enhancer (`grid-nav.enhancer.ts`) that owns the three irreducible client behaviors: (a) the APG Grid
roving-tabindex arrow navigation across cells, (b) the virtual-scroll windowing (only the rows in the
visible viewport are in the DOM), and (c) inline-cell editing (Enter/F2 enters a cell's edit widget,
Escape cancels). The DATA (rows, columns, sort, pagination) is always a server fact: the WIRE Java
component holds the current page, sort state, selected rows, and the column definitions. HTMX drives
server fetches (sort, page-change, filter) which swap the row fragment; the enhancer re-attaches its
virtual-scroll to the fresh DOM. Inline edits fire a typed wire action that persists the change and
re-renders the cell.

This component earns its WIRE tier because the data, the selection set, and the column sort/filter
state are all server facts. It earns the +ENH path because the three behaviors above (roving arrow
navigation across potentially thousands of virtual rows, the windowing algorithm, and the cell-edit
mode transition) cannot be expressed as native-element platform behavior or a server round-trip without
genuine UX loss. No framework (no Lit, no AG Grid, no React): a typed-vanilla-TS enhancer for the
irreducible client bit, server-first everywhere else.

Use this component when: (a) the row count is large enough that full-DOM rendering is slow (>200 rows
as a rule of thumb), or (b) inline cell editing is required, or (c) column freezing/resizing is needed.
For a plain server-paginated sortable table with no virtual rows and no inline editing, use the simpler
`table/data-table` HTMX component instead — it has no enhancer and no wire complexity.

---

## 2. API — params / props (the typed surface)

### 2.a Java WIRE component (`DataGridComponent`)

| member | kind | meaning |
|---|---|---|
| `columns` `List<ColumnDef>` | `@Wire @LievitProperty(locked=true)` | ordered column definitions (id, label, field, width, minWidth, frozen, sortable, resizable, editable, align, renderAs); locked — a client cannot inject columns |
| `rows` `List<Map<String,Object>>` | `@Wire` | the current page of row data (keyed by field name); updated by HTMX row-fragment swap or by a wire action |
| `totalRows` `int` | `@Wire` | total row count across all pages (for `aria-rowcount` + pagination display) |
| `page` `int` | `@Wire` | current 1-based page index |
| `pageSize` `int` | `@Wire @LievitProperty(locked=true)` | rows per page (default 50) |
| `sortField` `String` | `@Wire` | the column field currently sorted (null = unsorted) |
| `sortDir` `String` | `@Wire` | `asc` \| `desc` |
| `selectedRowIds` `Set<String>` | `@Wire` | set of row ids currently checked (bulk selection) |
| `editingCell` `CellRef` | `@Wire` | the cell currently in edit mode (`{rowId, field}`) or null; set by `enterEdit` |
| `rowIdField` `String` | `@Wire @LievitProperty(locked=true)` | which data field is the unique row identifier (default `"id"`) |
| `selectable` `boolean` | `@Wire @LievitProperty(locked=true)` | show the checkbox selection column |
| `selectAll` `boolean` | `@Wire` | tri-state: all / none / partial (derived by the template from `selectedRowIds` vs `rows`) |
| `loading` `boolean` | `@Wire` | true during an HTMX row-fragment fetch (the enhancer sets `aria-busy` on the grid) |
| `emptyLabel` `String` | `@Wire @LievitProperty(locked=true)` | text shown when `rows` is empty (default "No data") |
| `sort(String field)` | `@LievitAction` | toggles sort asc/desc on the given field; resets page to 1; re-fetches rows |
| `selectRow(String id, boolean checked)` | `@LievitAction` | adds/removes a row id from `selectedRowIds`; validates id ∈ current page |
| `selectAllRows(boolean checked)` | `@LievitAction` | selects/deselects all rows in the current page |
| `enterEdit(String rowId, String field)` | `@LievitAction` | sets `editingCell`; validates the column is `editable=true` + the row exists; authz check BEFORE mutate |
| `commitEdit(String rowId, String field, String value)` | `@LievitAction` | persists the new cell value (domain service call), clears `editingCell`; validates value format + domain invariants BEFORE mutate |
| `cancelEdit()` | `@LievitAction` | clears `editingCell` with no persistence |
| `changePage(int page)` | `@LievitAction` | sets `page`, re-fetches rows |

**`ColumnDef` (value record, locked server config)**:

| field | type | meaning |
|---|---|---|
| `id` | `String` | unique column identifier (used as `aria-colindex` anchor + data-* key) |
| `label` | `String` | visible column header text (also the accessible name of the columnheader cell) |
| `field` | `String` | the key in each row `Map` to read the cell value from |
| `width` | `int` | initial column width in px (0 = auto) |
| `minWidth` | `int` | minimum width in px during resize (default 60) |
| `frozen` | `boolean` | sticky left column (frozen=true → `position:sticky` in the template) |
| `sortable` | `boolean` | shows sort icon; clicking fires `sort(id)` |
| `resizable` | `boolean` | shows a resize handle; the enhancer tracks pointer drag |
| `editable` | `boolean` | Enter/F2 in the cell enters inline-edit mode (fires `enterEdit`) |
| `align` | `String` | `start \| center \| end` (default `start`) |
| `renderAs` | `String` | `text \| badge \| boolean \| date \| currency \| link` — how the cell value is rendered by the template (the server decides the render shape; the client gets the result) |

**`CellRef` (value record)**:

| field | type |
|---|---|
| `rowId` | `String` |
| `field` | `String` |

### 2.b Template `@param` list

One `@param` per `@Wire` field + standard wire params. No `Content` slot (WIRE has none — the rows and
cells are OWNED template markup generated from `columns` + `rows`).

| param | type | meaning |
|---|---|---|
| `_component` | `ComponentMetadata` | standard wire param (cid, snapshot, FQN) |
| `_instance` | `DataGridComponent` | to call derived getters |
| `columns` | `List<ColumnDef>` | column definitions |
| `rows` | `List<Map<String,Object>>` | current page rows |
| `totalRows` | `int` | total row count |
| `page` | `int` | current page |
| `pageSize` | `int` | rows per page |
| `sortField` | `String` | active sort column field |
| `sortDir` | `String` | `asc \| desc` |
| `selectedRowIds` | `Set<String>` | selected row ids |
| `editingCell` | `CellRef` | active edit cell or null |
| `rowIdField` | `String` | the row unique-id field |
| `selectable` | `boolean` | show checkbox column |
| `selectAll` | `boolean` | header checkbox tri-state |
| `loading` | `boolean` | busy state |
| `emptyLabel` | `String` | empty state label |

### 2.c Enhancer `data-*` attributes (the client contract surface)

The enhancer reads these from the rendered DOM to learn the grid's shape; they are stamped by the
template and are SAFE-escaped (all values go through `Escape.htmlAttribute` — none of these carry
user content directly, but row ids may be DB-derived):

| attribute | on element | meaning |
|---|---|---|
| `data-grid-root` | `<table>` | the enhancer's mount point |
| `data-total-rows` | `<table>` | value of `totalRows` (for virtual-scroll calculations) |
| `data-page-size` | `<table>` | value of `pageSize` |
| `data-row-id` | `<tr>` | the row's unique id (safe-escaped; DB-derived → `wireArgs` channel) |
| `data-col-id` | `<th>` / `<td>` | the column id (locked-config value, safe but still escaped) |
| `data-editable` | `<td>` | `"true"` if the cell is editable |
| `data-editing` | `<td>` | `"true"` if this cell is currently in edit mode |
| `data-resizable` | `<th>` | `"true"` if the column header has a resize handle |
| `data-frozen` | `<th>` / `<td>` | `"true"` for sticky columns |

### 2.d Escaping channels

- `attrs` (TRUSTED raw, `$unsafe`): reserved for author-typed static wire directives stamped once in
  the template (`l:click="sort"`, `l:click="selectRow"`, etc.). Never fed per-row DB data.
- `wireArgs` / `dataAttrs` (SAFE escaped, `Escape.htmlAttribute`): per-row, per-cell DB-derived values
  (`data-row-id`, `data-col-id`, the edit field name). Every value through this channel; no exceptions.
  This is the XSS load-bearing convention from `button.jte` — a row id that contains `"><script>` must
  render inert.

---

## 3. Variants / sizes / states

### Variants

The data-grid has no `variant` param in the intent-vocabulary sense (it is not an action control).
Instead it has a `density` param that governs row height (a display/readability trade-off):

| density | row height token | use when |
|---|---|---|
| `comfortable` | `--lv-space-12` (48px) | default; suits gestionale admin |
| `compact` | `--lv-space-9` (36px) | high-density reporting tables |
| `spacious` | `--lv-space-14` (56px) | when rows carry multi-line content |

`density` is a `@Wire @LievitProperty(locked=true)` field, not a display param; the server decides.

### Sizes

Column widths and header/cell padding are controlled by the `ColumnDef.width` (per-column) and the
`density` param (row height). There is no global `size` sm/md/lg scale on the grid itself — the grid
fills its container; the consumer sizes the container.

### States

| state | how expressed |
|---|---|
| `loading` (fetching rows) | `aria-busy="true"` on the `<table>`; skeleton rows in the visible window (the enhancer overlays them while the HTMX swap is in-flight); spinner in the toolbar |
| `empty` (zero rows) | an OWNED empty-state region (`role="row"` with `role="gridcell"` spanning all columns, containing the `emptyLabel` text and optionally an empty-state illustration partial) |
| `disabled column` (non-sortable) | no `aria-sort`; the columnheader is not focusable by the roving-tabindex; no hover sort icon |
| `selected row` | `aria-selected="true"` on the `<tr role="row">`; the checkbox column shows the checked state |
| `all selected` | `<input type="checkbox">` in the header has `indeterminate` (JS-set) when partial; `checked` when all |
| `editing cell` | the `<td>` that matches `editingCell` renders an `<input>` (or a `native-select` partial) instead of the display value; `data-editing="true"` for the enhancer; grid nav is suspended for that cell (Tab moves between widgets inside it, not to the next cell) |
| `sort active` | `aria-sort="ascending"` / `aria-sort="descending"` on the active `columnheader`; all other sortable columns carry `aria-sort="none"` |
| `frozen column` | `position:sticky; left: <offset>px` stamped by the template via a local variable; `data-frozen="true"` for the enhancer's sticky-offset recalculation on resize |
| `aria-busy` | set by the lievit runtime `beforeCall`/`afterCall` hook during wire round-trips (the component does not manage it) |

### Slots

No `Content` slot (WIRE). The grid has three OWNED template regions:

| region | what |
|---|---|
| **toolbar** | OWNED markup above the `<table>`: search input (if configured), column-visibility toggle, bulk-action buttons when `selectedRowIds` is non-empty; rendered by the template from `@Wire` state |
| **row-body** | the `<tbody>` OWNED by the template, one `<tr>` per row in `rows`, cells per `columns` |
| **empty-region** | the empty-state `<tr>` rendered when `rows` is empty (composes the `empty` partial) |

---

## 4. The a11y contract (the heart)

- **WAI-ARIA pattern**: APG Grid (Data Grid sub-pattern), BUILT against the raw APG.
  Source cited: https://www.w3.org/WAI/ARIA/apg/patterns/grid/
  Example cited: https://www.w3.org/WAI/ARIA/apg/patterns/grid/examples/data-grids/

- **roles + ARIA**:

  | element | role / attribute | value / notes |
  |---|---|---|
  | `<table>` | `role="grid"` | overrides implicit `table` role to opt into grid interaction model |
  | `<table>` | `aria-label` / `aria-labelledby` | the grid's accessible name (from a `<caption>` or an external heading; mandatory) |
  | `<table>` | `aria-rowcount` | `totalRows` (total across all pages, not just visible rows) |
  | `<table>` | `aria-colcount` | total column count (including frozen + checkbox col if `selectable`) |
  | `<table>` | `aria-busy` | `"true"` while `loading`; `"false"` otherwise |
  | `<table>` | `aria-multiselectable` | `"true"` when `selectable` (multiple row selection is permitted) |
  | `<thead><tr>` | `role="row"` | native `<tr>` inside a `role=grid` implicitly owns `row`; stated explicitly for clarity |
  | `<th>` (sortable) | `role="columnheader"` + `aria-sort` | `"ascending"` / `"descending"` / `"none"` (all sortable headers carry one of these; unsortable headers carry no `aria-sort`) |
  | `<th>` (row-select) | `role="columnheader"` + `aria-label="Select all rows"` | the checkbox column header |
  | `<tbody><tr>` | `role="row"` | one per data row |
  | `<tbody><tr>` | `aria-rowindex` | 1-based absolute row index across all pages: `(page-1)*pageSize + localIndex + 1` (required when `aria-rowcount` > visible rows) |
  | `<tbody><tr>` | `aria-selected` | `"true"` when the row id is in `selectedRowIds`; `"false"` otherwise (always present when `selectable`) |
  | `<td>` (data) | `role="gridcell"` | native `<td>` inside `role=row` inside `role=grid` implicitly owns `gridcell`; stated explicitly |
  | `<td>` (data) | `aria-colindex` | 1-based column position (required when `aria-colcount` > visible columns, e.g. when columns are hidden) |
  | `<td>` (data, editing) | `aria-readonly="false"` | the cell is currently editable; the inner `<input>` carries no redundant role |
  | `<td>` (data, non-editable) | `aria-readonly="true"` | not editable (present on non-editable cells so AT knows not to attempt edit) |
  | `<td>` (checkbox) | `role="gridcell"` | the per-row checkbox lives here; the `<input type=checkbox>` carries `aria-label="Select row <rowId>"` |
  | `<input>` inside editing cell | `type="text"` / `type="number"` / native-select | no extra role; the gridcell context supplies the edit affordance semantics |
  | empty-state row | `role="row"` > `role="gridcell" colspan=N` | the colspan makes AT read it as a single region; `aria-label` on the gridcell = `emptyLabel` |

- **keyboard map** (the load-bearing table — the `grid-nav` enhancer owns every non-platform key below;
  APG Data Grid pattern, https://www.w3.org/WAI/ARIA/apg/patterns/grid/):

  | key | does | who |
  |---|---|---|
  | `ArrowRight` | move focus one cell to the right; no-op at the last cell in the row | `grid-nav` enhancer (roving tabindex) |
  | `ArrowLeft` | move focus one cell to the left; no-op at the first cell | `grid-nav` enhancer |
  | `ArrowDown` | move focus one cell down; scrolls virtual window if needed; no-op at the last row | `grid-nav` enhancer + virtual-scroll |
  | `ArrowUp` | move focus one cell up; scrolls virtual window if needed; no-op at the first row | `grid-nav` enhancer + virtual-scroll |
  | `Home` | move focus to the first cell in the current row | `grid-nav` enhancer |
  | `End` | move focus to the last cell in the current row | `grid-nav` enhancer |
  | `Ctrl+Home` | move focus to the first cell of the first row (scrolls to top of virtual list) | `grid-nav` enhancer |
  | `Ctrl+End` | move focus to the last cell of the last row (scrolls to bottom of virtual list) | `grid-nav` enhancer |
  | `Page Down` | move focus down one viewport-worth of rows (APG: "author-determined number"; here = visible row count); scrolls virtual window | `grid-nav` enhancer |
  | `Page Up` | move focus up one viewport-worth of rows; scrolls virtual window | `grid-nav` enhancer |
  | `Enter` | if cell is editable: enter edit mode (fires `enterEdit` wire action; focuses the inner `<input>`); if cell is a link: follows the link; if column header is sortable: toggles sort | `grid-nav` enhancer (for edit transition) / platform (for link / header button) |
  | `F2` | toggle edit mode on an editable cell (enter if not editing, exit + commit if editing); APG-defined alternative to Enter for edit | `grid-nav` enhancer |
  | `Escape` | if editing: cancel edit (fires `cancelEdit`); exits cell back to grid navigation | `grid-nav` enhancer |
  | `Tab` | while NOT editing: move focus to the next focusable element outside the grid (grid exits tab stop — only one cell is in the tab order at a time via roving tabindex); while EDITING: move focus to the next widget WITHIN the cell (Tab does not navigate to the next cell while a cell is open for edit) | platform (roving tabindex leaves one `tabindex=0` in the grid) |
  | `Shift+Tab` | reverse of Tab, same semantics | platform |
  | `Ctrl+Space` | select the entire column that contains focus (adds all rows' ids to `selectedRowIds` for the current page) | `grid-nav` enhancer → `selectAll` wire action scoped to column |
  | `Shift+Space` | select the row that contains focus (fires `selectRow(rowId, true)`) | `grid-nav` enhancer → `selectRow` wire action |
  | `Ctrl+A` | select all rows in the current page (fires `selectAllRows(true)`) | `grid-nav` enhancer |
  | `Shift+ArrowRight` | extend selection one cell to the right (adds intermediate rows to `selectedRowIds`) | `grid-nav` enhancer |
  | `Shift+ArrowLeft` | extend selection one cell to the left | `grid-nav` enhancer |
  | `Shift+ArrowDown` | extend selection one cell down | `grid-nav` enhancer |
  | `Shift+ArrowUp` | extend selection one cell up | `grid-nav` enhancer |
  | alphanumeric (while a focused cell is editable) | begin editing: fires `enterEdit` then sets the typed character as the input value (replaces any existing cell value — the "type to start editing" shortcut, APG-specified) | `grid-nav` enhancer |
  | `Space` (on a checkbox cell) | toggle row selection (the `<input type=checkbox>` is the focusable element in that cell; Space is platform native for checkboxes) | platform |

- **focus management** (the roving-tabindex model, confirmed from APG examples):
    - The grid uses **roving tabindex**, NOT `aria-activedescendant`. At any moment exactly ONE cell
      has `tabindex="0"`; all other cells have `tabindex="-1"`. The `grid-nav` enhancer tracks the
      focused cell and moves the `tabindex=0` + DOM focus on arrow navigation.
    - **Initial focus**: when the grid receives Tab focus, focus lands on the cell that last held
      `tabindex=0` (the enhancer persists the last-focused cell's `[data-row-id][data-col-id]`
      coordinates as a local variable and re-applies `tabindex=0` after each virtual-scroll re-render
      or HTMX row-fragment swap). On first mount, focus lands on the first data cell (row 1, first
      non-frozen data column).
    - **Virtual scroll re-render**: when the enhancer scrolls the virtual window, it re-renders the
      visible row slice in the DOM. It must re-apply `tabindex=0` to the focus-cell after the DOM
      update and scroll-into-view that cell if it was off-screen.
    - **HTMX row-fragment swap**: after an HTMX swap (sort/page/filter), the enhancer re-attaches
      (the lievit `onComponentInit` lifecycle) and restores `tabindex=0` on the same logical cell
      (same `data-row-id` + `data-col-id`) if still present; otherwise falls back to the first cell.
    - **Edit mode**: on `enterEdit`, the `<td>` replaces its display content with an `<input>` (the
      morph handles this after the wire round-trip). The enhancer then moves DOM focus from the cell
      to the inner `<input>`. Tab and Shift+Tab while editing cycle through widgets WITHIN that cell
      only. Arrow keys while editing do NOT navigate the grid (the cell is in "cell-widget interaction
      mode", APG terminology). Escape (enhancer-owned) fires `cancelEdit`, the morph reverts the
      `<td>` to display, the enhancer moves focus back to the `<td>` cell.
    - **No focus trap**: the grid is non-modal. Tab exits the grid to the next focusable element in
      the page order (the roving-tabindex model, not `focus-trap`).
    - **Focus after morph**: the lievit bespoke morph already preserves DOM node identity + focus for
      statically-present elements; for the virtual-scroll DOM (nodes added/removed on scroll), the
      enhancer manages focus explicitly because those nodes do not have stable identity across scrolls.

- **live region**: the loading announcer. When `loading` transitions `true → false` and the row count
  changes, the shared announcer emits "N rows loaded" (or the empty state text if `rows` is empty).
  Implemented via the shared live-region announcer, NOT a new `role=status` element bespoke to this
  component. The sort change is not announced separately (the `aria-sort` attribute change is sufficient
  for AT).

- **shared mechanisms composed**:
    - `grid-nav.enhancer.ts` (NET-NEW, this component's own enhancer): roving-tabindex cell navigation,
      virtual-scroll windowing, edit-mode transitions, selection key handling. This is a SUPERSET of
      `collection-nav` for the grid's 2D navigation; it does NOT reuse `collection-nav` for cell
      navigation (1D listbox roving is not the same as 2D grid roving), BUT it delegates typeahead
      on column headers to `collection-nav` for consistency.
    - The shared **live-region announcer** for row-count / empty-state announcements.
    - The `table/data-table` HTMX fragment endpoint is REUSED for the server-side row fetches
      (sort, page, filter). The data-grid's HTMX target is the `<tbody>` element; the response is the
      same row-fragment that `data-table` uses. This avoids a parallel server endpoint.
    - Does NOT compose `focus-trap` (non-modal) or the popover seam (no overlay).

---

## 5. Tokens

The data-grid reads the following `--lv-*` tokens. All colour tokens are authored in OKLCH.

**Colour tokens**:

| token | used for |
|---|---|
| `--lv-color-bg` | table background |
| `--lv-color-border` | column separator lines + outer border |
| `--lv-color-muted` | alternating row stripe (even rows: `--lv-color-muted` at 30% opacity) |
| `--lv-color-muted-fg` | secondary cell text (e.g. null/empty values) |
| `--lv-color-fg` | primary cell text |
| `--lv-color-accent` | sort-active column header background tint; focused cell highlight |
| `--lv-color-accent-fg` | sort icon in active state |
| `--lv-color-primary` | selected-row checkbox accent + selected-row stripe color |
| `--lv-color-primary-fg` | selected-row text |
| `--lv-color-header-bg` | `<thead>` background (NET-NEW: a distinct header background is needed for sticky frozen headers; proposed value: `oklch(0.97 0.005 250)` light / `oklch(0.18 0.01 250)` dark — a slightly-tinted neutral, not a brand colour) |
| `--lv-color-header-fg` | column header text |
| `--lv-ring` | the focus ring on the focused cell (`tabindex=0` cell outline) |
| `--lv-color-destructive` | validation error state on an editing cell |
| `--lv-color-overlay` | loading overlay tint over the tbody during row fetch |

**Spacing tokens**:

| token | used for |
|---|---|
| `--lv-space-2` | cell horizontal padding (compact density) |
| `--lv-space-3` | cell horizontal padding (comfortable / spacious density) |
| `--lv-space-9` | row height — compact density (36px) |
| `--lv-space-12` | row height — comfortable density (48px, default) |
| `--lv-space-14` | row height — spacious density (56px) |
| `--lv-space-4` | toolbar vertical padding |
| `--lv-space-6` | empty-state region vertical padding |

**Typography tokens**:

| token | used for |
|---|---|
| `--lv-text-sm` | cell text size |
| `--lv-text-xs` | compact density cell text |
| `--lv-text-base` | spacious density cell text |
| `--lv-font-sans` | cell font family |
| `--lv-font-mono` | `renderAs=currency` / `renderAs=date` cells (tabular figures) |

**Other tokens**:

| token | used for |
|---|---|
| `--lv-radius-sm` | focused-cell ring radius |
| `--lv-shadow-xs` | frozen column right-edge shadow (visual separator) |
| `--lv-z-sticky` | `z-index` of frozen (sticky) columns + sticky header row |
| `--lv-transition-fast` | row hover background transition |

**NET-NEW tokens proposed** (additive, go in both `:root` and `.dark`):

| token | proposed value (`:root`) | proposed value (`.dark`) | justification |
|---|---|---|---|
| `--lv-color-header-bg` | `oklch(0.97 0.005 250)` | `oklch(0.18 0.01 250)` | the `<thead>` needs a distinct, slightly-elevated background from the body to visually anchor it when sticky; the existing `--lv-color-muted` is too close to the body stripe |
| `--lv-z-sticky` | `10` | `10` | a dedicated z-index level for sticky table columns/headers, below `--lv-z-popover`; avoids magic numbers in the template |

No new colour tokens beyond these two. All other needs are covered by the existing vocabulary.

---

## 6. Wire actions + enhancer wiring

### 6.a Server-side wire actions (via `l:click` / `l:submit`)

| directive on element | action fired | what it mutates | round-trip result |
|---|---|---|---|
| `l:click="sort" data-field="<escaped colId>"` on `<th>` button | `sort(field)` | `sortField`, `sortDir`, `page=1` | server re-fetches + re-renders the `<tbody>` rows + the `<thead>` `aria-sort` attributes |
| `l:click="selectRow" data-row-id="<escaped id>" data-checked="true/false"` on row checkbox | `selectRow(id, checked)` | `selectedRowIds` | re-renders the row (checkbox state + `aria-selected`) + toolbar (bulk action visibility) |
| `l:click="selectAllRows" data-checked="true/false"` on header checkbox | `selectAllRows(checked)` | `selectedRowIds` (all current page rows) | re-renders all rows + header checkbox |
| `l:click="enterEdit" data-row-id="<escaped>" data-field="<escaped>"` fired by the enhancer on Enter/F2 | `enterEdit(rowId, field)` | `editingCell` | re-renders the target `<td>` with an `<input>` |
| `l:submit` on the cell edit form (the `<input>` wrapped in a minimal `<form>`) | `commitEdit(rowId, field, value)` via hidden inputs | `editingCell=null` + the row value | re-renders the `<td>` with the new display value |
| `l:click="cancelEdit"` fired by the enhancer on Escape | `cancelEdit()` | `editingCell=null` | re-renders the `<td>` back to display value |
| `l:click="changePage" data-page="<n>"` on pagination buttons | `changePage(n)` | `page` | re-renders `<tbody>` + pagination region |

### 6.b HTMX row-fragment swap

Sort, page, and filter changes that re-fetch the full row set use HTMX targeting the `<tbody>`:
```
hx-get="/lievit/{cid}/rows"
hx-target="tbody[data-grid-body]"
hx-swap="outerHTML"
hx-trigger="click from:[data-sort-btn], ..."
```
The server endpoint returns only the `<tbody>` fragment (the same fragment endpoint as `data-table`).
This keeps the heavy row-data out of the signed snapshot (the snapshot carries column defs + state,
not the row payload). The `loading` `@Wire` field is set `true` before the HTMX request and `false`
after the swap, so `aria-busy` transitions correctly.

### 6.c Enhancer (`grid-nav.enhancer.ts`) responsibilities

The enhancer registers via the directive registry on the `[data-grid-root]` element. It owns:

1. **Roving tabindex bootstrap**: on `onComponentInit`, finds all `[role="gridcell"]` and
   `[role="columnheader"]` elements, sets all to `tabindex="-1"`, sets the last-focused cell (or
   first cell on first mount) to `tabindex="0"`.
2. **Arrow key navigation**: binds `keydown` on the grid root; on ArrowRight/Left/Down/Up, computes
   the next cell's coordinates, moves `tabindex=0` + calls `.focus()`. Accounts for frozen columns
   (they are always in the DOM and navigable). Calls the virtual-scroll renderer if the target row
   is outside the current window.
3. **Home / End / Ctrl+Home / Ctrl+End / Page Up / Page Down**: same coordinate logic, mapped to row
   boundaries and page boundaries.
4. **Virtual-scroll windowing**: on scroll events on the table's scroll container and on vertical
   arrow navigation, computes the visible row window (`[ scrollTop / rowHeight, (scrollTop +
   containerHeight) / rowHeight ]`), renders only those `<tr>` elements into the `<tbody>`, and
   stamps `aria-rowindex` on each (using the absolute row index). Uses a fixed `rowHeight` derived
   from the `density` token via `getComputedStyle`. The total `<tbody>` height is padded with a
   spacer row to preserve scroll size.
5. **Enter/F2 → edit**: on `keydown` Enter or F2 on a focused editable cell (`data-editable="true"`),
   fires the `enterEdit` wire action (via `$lievit.call(cid, 'enterEdit', {rowId, field})`). After
   the morph, moves DOM focus to the inner `<input>`.
6. **Escape → cancel**: on `keydown` Escape while a cell has `data-editing="true"`, fires `cancelEdit`.
   After the morph, moves DOM focus back to the cell.
7. **Form submit in edit cell**: the inner `<form>` has `l:submit="commitEdit"` with hidden `<input>`
   fields for `rowId`, `field`, `value`. The enhancer ensures focus returns to the `<td>` after commit.
8. **Selection keys**: Shift+Space fires `selectRow`; Ctrl+A fires `selectAllRows`; Shift+Arrow extends
   selection by accumulating row ids client-side and firing a batched `selectRow` call (or a single
   `selectAllRows` for Ctrl+A). Ctrl+Space (column select) is implemented as a client-only visual
   highlight — column selection is a display affordance, not a domain action, so no wire call.
9. **Alphanumeric start-edit shortcut**: on `keydown` of a printable character on a focused editable
   cell, fires `enterEdit`, then (after morph) seeds the inner `<input>` with the typed character.
10. **Column resize**: pointer-drag on `[data-resizable]` handles adjusts the `<col>` element widths
    via inline `style.width`. No wire action (column widths are ephemeral layout state, not a domain
    fact). Persisting widths can be added by the adopter via a `resize` DOM event that fires their own
    wire action.
11. **Post-HTMX re-attach**: registers a `htmx:afterSwap` listener on the `<tbody>`. After a swap,
    re-bootstraps the roving tabindex on the new row set and re-applies `tabindex=0` to the
    last-focused cell if it is still in the new row set (matched by `data-row-id` + `data-col-id`);
    otherwise falls back to the first row's first cell.
12. **Post-morph re-attach**: the lievit runtime calls `onComponentInit` after each wire round-trip
    morph; the enhancer re-bootstraps roving tabindex state on the new DOM.

---

## 7. Acceptance tests

A component is DONE only when ALL tests below pass on a REAL substrate — no mocked `$lievit`, no
mocked runtime, no jsdom-only assertions for gesture-driven behavior (the client-island-fidelity lesson
from the gest CLAUDE.md). The real `LievitRuntime` + `installAllFeatures` is mounted for enhancer tests.

### 7.a Render tests (jsdom + real LievitRuntime)

- **`renders-grid-role`**: the `<table>` has `role="grid"`, `aria-rowcount` equals `totalRows`,
  `aria-colcount` equals `columns.size()` + 1 (if `selectable`); the `<tbody>` rows carry
  `role="row"` and `aria-rowindex` with the correct 1-based absolute index.
- **`renders-columnheaders`**: each `<th>` has `role="columnheader"`; sortable columns carry
  `aria-sort="none"` when unsorted; the active-sort column carries `aria-sort="ascending"` or
  `"descending"` according to `sortDir`; non-sortable columns have no `aria-sort`.
- **`renders-gridcells`**: each `<td>` has `role="gridcell"`; `aria-readonly="true"` on non-editable
  cells; `aria-readonly="false"` on editable cells; `aria-colindex` present when columns are hidden.
- **`renders-selected-row`**: a row whose id is in `selectedRowIds` has `aria-selected="true"` and
  the checkbox `<input>` is `checked`; an unselected row has `aria-selected="false"`.
- **`renders-editing-cell`**: when `editingCell` is set to `{rowId="R1", field="name"}`, the
  corresponding `<td>` renders an `<input>` (not a display value) and carries `data-editing="true"`.
- **`renders-empty-state`**: when `rows` is empty, a single `role="row" > role="gridcell"` spanning
  all columns is rendered containing the `emptyLabel` text.
- **`renders-loading`**: when `loading=true`, `aria-busy="true"` is on the `<table>`.
- **`renders-frozen-column`**: a column with `frozen=true` has `position:sticky` and `data-frozen=
  "true"` on both its `<th>` and all its `<td>` cells.
- **`renders-accessible-name`**: the `<table>` has either `aria-label` or `aria-labelledby` pointing
  to a non-empty element (asserts the mandatory labelling rule).

### 7.b axe-core assertions

- **`axe-grid-clean`**: `axe.run()` on the fully-rendered open grid DOM (all columns, multiple rows,
  one selected, one editing) reports zero violations against the rules: `aria-required-children`,
  `aria-required-parent`, `aria-valid-attr-value`, `aria-allowed-attr`, `grid-aria-required-attr`,
  `label`, `aria-label`, `aria-labelledby`. Verified with real-compiled JTE output, not a hand-crafted
  HTML string.
- **`axe-empty-grid-clean`**: zero violations on the empty-state rendering.
- **`axe-loading-grid-clean`**: zero violations when `aria-busy="true"`.
- **`axe-no-label-fails`**: a grid rendered WITHOUT `aria-label` / `aria-labelledby` FAILS the axe
  scan (asserts that the labelling rule is enforced, not silently passing).

### 7.c Keyboard tests (real `grid-nav` enhancer mounted, jsdom)

Each test asserts the OBSERVABLE outcome (which cell has `tabindex=0` + DOM focus; which wire action
was called), not internal state:

- **`arrow-right-moves-focus`**: focus on cell (0, 0); ArrowRight → focus on (0, 1); `tabindex=0`
  is on (0, 1), `tabindex=-1` on (0, 0).
- **`arrow-right-at-last-cell-is-noop`**: focus on the last cell in a row; ArrowRight → no change.
- **`arrow-down-moves-focus`**: ArrowDown from (0, 0) → focus on (1, 0).
- **`arrow-down-at-last-row-is-noop`**: no change.
- **`home-moves-to-first-cell-in-row`**: focus on (1, 3); Home → focus on (1, 0).
- **`end-moves-to-last-cell-in-row`**: focus on (1, 0); End → focus on (1, last).
- **`ctrl-home-moves-to-first-cell`**: ArrowDown a few times; Ctrl+Home → focus on (0, 0).
- **`ctrl-end-moves-to-last-cell`**: Ctrl+End → focus on (lastRow, lastCol).
- **`page-down-moves-focus-by-window-height`**: assert focus moves down by the configured visible
  row count (the test grid has 5 visible rows; PageDown from row 0 → row 5 or the last row).
- **`enter-on-editable-cell-fires-enterEdit`**: focus on an editable cell; Enter → `enterEdit` wire
  action called with the correct `{rowId, field}`; after the morph, the `<input>` has DOM focus.
- **`f2-on-editable-cell-fires-enterEdit`**: same as above via F2.
- **`escape-while-editing-fires-cancelEdit`**: with `editingCell` set; Escape → `cancelEdit` fired;
  after morph, DOM focus is back on the `<td>` cell.
- **`shift-space-selects-row`**: focus on a data cell; Shift+Space → `selectRow(rowId, true)` called.
- **`ctrl-a-selects-all-rows`**: Ctrl+A → `selectAllRows(true)` called.
- **`enter-on-sort-header-fires-sort`**: focus on a sortable columnheader; Enter → `sort(field)` called.
- **`alphanumeric-on-editable-cell-starts-edit`**: focus on an editable cell; press "a" → `enterEdit`
  fired; after morph, the `<input>` value is seeded with "a".
- **`tab-exits-grid`**: Tab while focused on a cell → focus moves to the next focusable element OUTSIDE
  the grid (assert the post-grid element has DOM focus).
- **`tab-inside-editing-cell-stays-in-cell`**: while editing, Tab → focus moves to the next widget
  inside the `<td>`, NOT to the next cell.

### 7.d Focus management tests

- **`initial-focus-on-first-cell`**: on mount, `tabindex=0` is on cell (0, 0) (the first data cell).
- **`focus-preserved-after-htmx-swap`**: focus was on (1, 2); simulate an HTMX swap (re-render the
  `<tbody>`); assert (1, 2) still has `tabindex=0` and receives DOM focus after re-attach.
- **`focus-preserved-after-morph`**: focus was on (0, 1); trigger a wire round-trip that morphs the
  DOM; assert (0, 1) still has `tabindex=0`.
- **`focus-falls-back-to-first-cell-when-row-removed`**: focus was on row "R3"; simulate a sort that
  removes "R3" from the current page; assert focus falls back to (0, 0).
- **`no-trap-tab-exits`**: Tab from any cell → focus exits the grid (NOT trapped); assert this is
  different from the `focus-trap` enhancer behavior (grid is non-modal).

### 7.e Virtual scroll test

- **`virtual-scroll-renders-only-visible-rows`**: a grid with `totalRows=500`, `pageSize=500`, and a
  fixed-height container showing 10 rows; on mount, only 10–15 `<tr>` elements are in the `<tbody>`
  (the window); scrolling down renders new rows; absolute `aria-rowindex` on the rendered rows is
  correct (matches the virtual offset).
- **`virtual-scroll-scroll-to-focused-cell`**: focus on (0, 0); ArrowDown 20 times (past the visible
  window); assert that the row that receives focus is scrolled into view.
- **`virtual-scroll-preserves-rowindex-continuity`**: at any scroll position, the `aria-rowindex` of
  the first visible `<tr>` equals `currentScrollOffset / rowHeight + 1` (rounded); no gap in the
  logical sequence.

### 7.f Wire round-trip IT (lievit-kit, real runtime — the CollapsibleComponentIT pattern)

- **`sort-round-trip`**: mount the component with 3 rows unsorted; click the first column header;
  assert the re-rendered `<thead>` has `aria-sort="ascending"` on that column; assert the `<tbody>`
  rows are re-rendered in the server's sorted order.
- **`select-row-round-trip`**: click a row checkbox; assert `aria-selected="true"` on that `<tr>` in
  the re-rendered DOM; assert the toolbar shows a bulk-action button.
- **`edit-commit-round-trip`**: focus on an editable cell; fire `enterEdit`; type in the inner
  `<input>`; submit the form; assert the `<td>` reverts to display mode with the NEW value visible;
  assert `editingCell` is null in the new snapshot.
- **`edit-cancel-round-trip`**: enter edit mode; fire `cancelEdit`; assert `<td>` shows the ORIGINAL
  value; `editingCell` is null.
- **`changePage-round-trip`**: click the "next page" button; assert `aria-rowindex` on the first row
  of the new page = `pageSize + 1`.

### 7.g Playwright tests (gesture fidelity, legacy-VM oracle)

- **`playwright-keyboard-nav`**: real `page.keyboard.press('ArrowDown')` × 3 from cell (0, 0); assert
  cell (3, 0) is focused (real DOM focus, not a simulated assertion). The test runs against the real
  enhancer on the real runtime, not a jsdom mock.
- **`playwright-inline-edit`**: double-click an editable cell (or press Enter); assert an `<input>`
  appears with the cell value; type a new value; press Enter; assert the display cell shows the new value.
- **`playwright-sort`**: click a sortable column header; assert the table reloads and the
  `aria-sort="ascending"` attribute is present; click again; `aria-sort="descending"`.
- **`playwright-row-select`**: click a row checkbox; assert the row has `aria-selected="true"` and a
  bulk-action toolbar appears.
- **`playwright-escape-cancels-edit`**: enter edit mode; press Escape; assert the original value is
  still displayed and the `<input>` is gone.
- **`playwright-virtual-scroll-aria-rowindex`**: scroll a large grid to position 100 rows down; assert
  the `aria-rowindex` on the first visible row is approximately 100 (within ±1 of the scroll offset).

### 7.h Escaping test

- **`escaping-hostile-row-id`**: a row whose id is `"><script>alert(1)</script>` renders `data-row-id`
  as a correctly-escaped HTML attribute value (`&quot;&gt;&lt;script&gt;...`); the `<td>` does NOT
  contain a live `<script>` tag; the `selectRow` wire action call passes the escaped string safely.
- **`escaping-hostile-cell-value`**: a cell whose display value contains `<img onerror=...>` is
  rendered as escaped text, not live HTML (the `renderAs=text` path goes through JTE's default
  HTML-escaped output, not `$unsafe`).

### 7.i JTE compile + render gate

Covered by the existing `test/jte-compile` real-compiler gate. The data-grid template is added to the
compile + render assertion set; no separate test needed beyond ensuring the template file is included.

---

## 8. Non-goals / anti-patterns

- **Not a replacement for `table/data-table`**: for server-paginated tables with no inline editing and
  fewer than ~200 rows, use the simpler HTMX `data-table`. Do not reach for `data-grid` because it
  looks fancier — it carries real complexity (the enhancer, the virtual scroll, the wire surface).
- **Not a pivot to client-side data management**: the grid does NOT own the data. It does NOT sort,
  filter, or page the dataset client-side in JavaScript. Every sort/page/filter is a server round-trip
  (HTMX row-fragment swap). The server is the source of truth; the client renders and navigates. Any
  attempt to "make the grid faster" by sorting rows in the enhancer is an anti-pattern that will drift
  from the server's domain invariants.
- **No framework**: no AG Grid, no TanStack Table, no Lit. The enhancer is typed-vanilla-TS, CSP-clean.
  Referencing AG Grid's interaction MODEL as a pattern reference is fine; importing it is not.
- **No literal react-aria / Ant Design / Tailwind UI code**: the keyboard map and ARIA wiring are
  ORIGINAL, sourced from the APG. The visual look is ORIGINAL over `--lv-*` tokens, inspired by
  Tailwind UI. No literal source from any of these is copied (the one bright line, `02-licensing.md`).
- **No inline `<script>` or `on*=` handlers in the JTE template**: the CSP refuses them. All client
  behavior lives in `grid-nav.enhancer.ts`, registered via the directive/lifecycle registries.
- **No hand-rolled focus trap**: the grid is non-modal; it uses roving tabindex, not a trap. Do NOT
  compose `focus-trap.enhancer.ts` here — that is for dialog/drawer/sheet.
- **No client-only selection state**: the selected row set lives in `selectedRowIds` on the Java
  `@Wire` field. The client does NOT maintain a shadow copy. The enhancer fires wire actions; the
  server mutates and re-renders. A client-only optimistic-update for selection is NOT in scope (it
  introduces a state-divergence risk with no escape).
- **No column drag-reorder** in this version (S2): column reorder is a heavy client-only gesture (drag,
  drop, visual placeholder) with no clear server-fact equivalent. It is noted as a S3 candidate; for
  now the `ColumnDef` order is locked (`locked=true`) and the server decides it.
- **No `<slot>` for custom cell renderers from the adopter**: cell rendering is controlled by
  `ColumnDef.renderAs` (a locked server config). An adopter who needs a custom cell look owns a copy
  of the template (the import/copy-in model of the library). Do NOT expose a `Content` slot in a WIRE
  template (WIRE has none — server-first refactor blueprint §1.b).
- **No hardcoded option lists or cell values in the template**: cell values come from `rows` (the
  `@Wire` field, server-provided). Column labels come from `ColumnDef.label` (locked config). Nothing
  is hardcoded in the JTE template body. This is the "no data in a partial" rule from `00-architecture-
  contract` §3, applied to WIRE.
- **No `aria-activedescendant` for cell focus**: the APG Grid examples use roving tabindex, not
  `aria-activedescendant`. Do NOT use `aria-activedescendant` here; it is the listbox/combobox pattern
  (`collection-nav`). The grid uses real DOM focus on real `<td>` elements via `tabindex=0`.
- **No separate `columnheader` row outside the `<table>`**: frozen headers are implemented as a sticky
  `<thead>`, NOT as a separate `<div>` above the table. A separate div breaks the semantic
  `role=columnheader` → `role=grid` parent relationship and breaks AT column/row count arithmetic.

---

## Agent instructions

Generate ORIGINAL code over `--lv-*` (OKLCH) tokens. You MAY read the W3C WAI-ARIA APG Grid pattern
(https://www.w3.org/WAI/ARIA/apg/patterns/grid/) and the APG Data Grid example
(https://www.w3.org/WAI/ARIA/apg/patterns/grid/examples/data-grids/) as the a11y authority; you MAY
read Ant Design Table / ProTable feature documentation as the inventory reference; you MAY read Tailwind
UI table styles as a visual inspiration. You MUST NOT paste literal source from any of them — the output
is always original generation (the one bright line, `02-licensing.md`).

The keyboard map in §4 is the contract: assert ALL of it in §7.c. A keyboard test that asserts a mocked
outcome is not a keyboard test (the client-island-fidelity lesson). Every keyboard test runs on the REAL
`grid-nav` enhancer mounted into a real DOM.

The wire action table in §6.a is the contract: every action validates its inputs in Java BEFORE mutating
state (id ∈ current rows, field ∈ editable columns, authz check). Never mutate state on invalid input.

The virtual-scroll implementation must re-apply `tabindex=0` to the last-focused cell after every DOM
update (scroll, HTMX swap, wire morph). Losing track of the focused cell after a virtual-scroll update
is the primary failure mode; §7.e pins this explicitly.

Compose the shared live-region announcer for row-count announcements. Do NOT hand-roll a new
`role=status` element. Mirror the WIRE JTE conventions exactly (server-first refactor blueprint §1.b):
owned template markup, boolean state as JTE boolean-attribute conditional, no `Content` slot.

Minimal code to GREEN against the acceptance tests. Refactor only while green. The a11y gate (axe-core
+ keyboard + focus tests) is NOT optional — a passing build with a failing a11y test is a RED build.
