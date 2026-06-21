@import gg.jte.Content
@import java.util.List
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui :: data-table (static JTE partial - server-sorted/paginated table)

  The SERVER-FIRST data table: a real <table> whose sort and page are SERVER facts.
  Sortable column headers are real <a href> re-sort links (the server produces the next
  sort URL per column); clicking one re-sorts on the server and re-renders. Pagination is
  the windowed pagination partial (real <a href> page links). The empty state renders a
  single spanning row when there are no rows. ZERO client JavaScript, ZERO client sort.

  TIER (why this is a partial, not a Lit island / wire component): the genuinely STATEFUL
  server-sorted/paginated table is OWNED by lievit-kit's admin list -- the ListingListComponent
  wire holds the page/sort/search/filter as @Wire fields, AdminListView.of(...) reads one bounded
  page, and l:click="toggleSort/prev/next" actions re-render it. This partial is NOT that engine; it
  is the presentational PRIMITIVE the kit (and any plain Spring controller) composes to RENDER one
  page. The kit's listing-list.jte hand-rolls this exact <table>/<thead>/<tbody>/pagination markup;
  this partial generalises it so the markup, the aria-sort contract, and the sort-link affordance
  live in one owned place instead of being copy-pasted per resource. The old <lv-data-table> Lit
  island (client sort + client pagination, fully in the browser) is removed by ADR-0012: the table
  is server-first, the kit holds the state, this partial draws it.

  STRUCTURE (scientific decision rule). shadcn's Data Table is a TanStack-Table client grid (sort /
  paginate / select all in JS); the WAI-ARIA APG "sortable table" pattern is a plain <table> whose
  sorted <th> carries aria-sort and whose header is an in-cell control that re-sorts. For a
  server-first kit the APG sortable-table pattern wins on (1) a11y (real table semantics, the sort
  control is a real link that works with JS off) and (5) robustness (the sort and page survive a
  reload because they are URL state, not in-memory client state). shadcn's grid is rejected: it puts
  the sort/page truth in the browser, the exact silent-client-state class the pivot removes. So:
  a real <table>/<thead>/<tbody> (composing the table primitive's look), <th scope="col"> headers,
  aria-sort on the active column, the sort affordance as a real <a href> (the kit emits the
  next-sort URL), and the pagination partial for paging.

  ROWS via a Content slot (data down, the caller owns the cells). The caller renders one
  @template.lievit.data-table.row(...) per data item inside `rows`, each holding @template.lievit.data-table.cell
  blocks (or composes the existing table.row / table.cell primitives). This mirrors the kit's typed
  Cell switch: the partial owns the chrome + the sort/page contract, the caller owns what a cell
  shows (a badge, a link, an icon, escaped text). No row data is hardcoded here; it arrives via the
  slot from the controller's typed model.

  A11y (WAI-ARIA APG, sortable table): real <table>/<thead>/<tbody>/<th scope="col">; the active
  sort column's <th> carries aria-sort="ascending|descending" (others "none"); the sort control is
  a real <a href> so it is keyboard reachable and works with JS off; a visible sort indicator glyph
  (chevron-up/down for asc/desc, chevrons-up-down for unsorted) is aria-hidden (the aria-sort state
  is the accessible signal); the optional <caption> is the table's accessible name; the empty state
  is one row spanning all columns. The pagination partial owns its own nav landmark + aria-current.

  Params:
    List<String> headers              column header labels, in order (REQUIRED).
    List<String> sortUrls    = null   per-column next-sort URL; "" / null = that column is not
                                      sortable (no link). Same length / order as `headers`.
    List<String> sortStates  = null   per-column active sort: "asc" | "desc" | "" (none).
                                      Same length / order as `headers`. null = nothing sorted.
    Content rows                      the <tbody> rows (caller owns them; one row per data item).
    int rowCount             = -1     number of data rows; <= 0 renders the empty state. -1 = unknown
                                      (trust the slot; never render the empty row).
    String emptyText         = "No data"   text of the empty-state row.
    String caption           = null   optional <caption> (accessible name).
    String ariaLabel         = null   aria-label when there is no visible caption.
    int page                 = 0      current page (1-based); a page < 1 hides the pager.
    int totalPages           = 0      total pages; <= 1 hides the pager.
    String pageHrefPattern   = null   printf pattern for a page URL (one %d = the page number);
                                      null hides the pager. Forwarded to @template.lievit.pagination.
    String klass             = ""     extra classes on the <table>.

  Usage:
    @@template.lievit.data-table(
      headers   = view.headers(),
      sortUrls  = sortUrls,            // controller builds the next-sort href per column
      sortStates= sortStates,          // "asc"/"desc"/"" per column from the active Sort
      caption   = "Listings",
      rowCount  = view.rows().size(),
      page      = view.pagination().page(),
      totalPages= view.pagination().totalPages(),
      pageHrefPattern = "/admin/listings?page=%d",
      rows = @@`
        @@for(var row : view.rows())
          @@template.lievit.data-table.row(content = @@`
            @@template.lievit.data-table.cell(content = @@`${row.id()}`)
          `)
        @@endfor
      `)
--%>
@param java.util.List<String> headers
@param java.util.List<String> sortUrls = null
@param java.util.List<String> sortStates = null
@param gg.jte.Content rows
@param int rowCount = -1
@param String emptyText = "No data"
@param String caption = null
@param String ariaLabel = null
@param int page = 0
@param int totalPages = 0
@param String pageHrefPattern = null
@param String klass = ""

!{var colCount = headers.size();}
!{var showPager = pageHrefPattern != null && page >= 1 && totalPages > 1;}
<div data-slot="data-table" class="lv-data-table relative w-full">
  <div class="lv-data-table-container w-full overflow-x-auto">
    <table
      data-slot="data-table-grid"
      aria-label="${caption == null ? ariaLabel : null}"
      class="lv-table w-full caption-bottom text-[length:var(--lv-text-sm)] ${klass}"
      style="font-family:var(--lv-font-sans);color:var(--lv-color-fg);border-collapse:collapse;"
    >
      @if(caption != null && !caption.isBlank())
        <caption data-slot="data-table-caption" class="mt-[var(--lv-space-3)] text-[length:var(--lv-text-sm)] text-[var(--lv-color-muted-fg)]">${caption}</caption>
      @endif
      <thead data-slot="data-table-header">
        <tr class="border-b" style="border-color:var(--lv-color-border);">
          @for(int i = 0; i < colCount; i++)
            !{var label = headers.get(i);}
            !{var url = (sortUrls != null && i < sortUrls.size()) ? sortUrls.get(i) : null;}
            !{var sortable = url != null && !url.isBlank();}
            !{var state = (sortStates != null && i < sortStates.size()) ? sortStates.get(i) : "";}
            !{var sorted = state != null && (state.equals("asc") || state.equals("desc"));}
            !{var ariaSort = !sortable ? null : (state.equals("asc") ? "ascending" : (state.equals("desc") ? "descending" : "none"));}
            <th
              scope="col"
              data-slot="data-table-head"
              aria-sort="${ariaSort}"
              class="lv-table-head h-[var(--lv-space-9)] px-[var(--lv-space-2)] text-left align-middle font-[var(--lv-font-medium)] whitespace-nowrap"
              style="color:var(--lv-color-fg);background-color:color-mix(in srgb, var(--lv-color-surface) 70%, var(--lv-color-bg));"
            >
              @if(sortable)
                <a
                  href="${url}"
                  data-slot="data-table-sort"
                  data-sorted="${sorted ? state : null}"
                  class="inline-flex items-center gap-[var(--lv-space-1)] text-[var(--lv-color-fg)] no-underline hover:text-[var(--lv-color-primary)] focus-visible:outline-none focus-visible:shadow-[var(--lv-ring)] rounded-[var(--lv-radius-sm)]"
                >
                  <span>${label}</span>
                  <span aria-hidden="true" class="text-[var(--lv-color-muted-fg)] data-[active=true]:text-[var(--lv-color-primary)]" data-active="${sorted}">
                    @if(state.equals("asc"))
                      @template.lievit.icon(name = "chevron-up", size = "0.85em")
                    @elseif(state.equals("desc"))
                      @template.lievit.icon(name = "chevron-down", size = "0.85em")
                    @else
                      @template.lievit.icon(name = "chevrons-up-down", size = "0.85em")
                    @endif
                  </span>
                </a>
              @else
                <span>${label}</span>
              @endif
            </th>
          @endfor
        </tr>
      </thead>
      <tbody data-slot="data-table-body">
        @if(rowCount == 0)
          <tr data-slot="data-table-empty">
            <td colspan="${colCount}" class="px-[var(--lv-space-2)] py-[var(--lv-space-5)] text-center text-[var(--lv-color-muted-fg)]">${emptyText}</td>
          </tr>
        @else
          ${rows}
        @endif
      </tbody>
    </table>
  </div>
  @if(showPager)
    <div data-slot="data-table-pagination" class="mt-[var(--lv-space-3)]">
      @template.lievit.pagination(current = page, total = totalPages, hrefPattern = pageHrefPattern)
    </div>
  @endif
</div>
