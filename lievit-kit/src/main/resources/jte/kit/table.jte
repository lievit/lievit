@import io.lievit.kit.AdminListView
@import io.lievit.kit.Cell
@import io.lievit.kit.ColumnSummary
@import io.lievit.kit.page.KitTableView
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-kit :: kit.table - the canonical Filament TABLE chrome, rendered from a KitTableView onto
  the lievit-ui data-table/* + table/* + pagination / empty / badge / checkbox / chip / native-select
  / dropdown-menu / icon partials. This is the kit's reference render template: the OTHER builders
  (forms, panels, infolists) follow the SAME pattern set here.

  It is render-less-builder no more: the kit ships THIS, so an adopter stops hand-assembling the
  chrome per resource. A Resource/ListPage renders it through KitTableComponent (or any host
  @LievitComponent) that exposes a live KitTableView via the _instance.

  The 14 Filament pieces, server-first (every control a real GET <a href> / <select> / <form> POST
  or an l:* wire hook; strict CSP -> no inline <script>/on*):
    1  header heading + header-actions toolbar     -> button partial, real <a href> / l:click
    2  global search field                          -> form GET input (name=q) + clear link
    3  filters trigger + inline filter panel        -> native-select / checkbox per FilterControl
    4  active-filter indicator chips + reset-all     -> chip partial (removeHref) + reset <a href>
    5  bulk select-all + per-row checkbox            -> data-table.selection-cell (header + row)
    6  bulk-action bar (N of M selected)             -> data-table.selection-footer
    7  sortable header cell (aria-sort + chevron)    -> kit.table.sortable-head
    8  header-group super-row (colspan)              -> spanning <tr>
    9  per-page selector                             -> size links (GET, JS-off) when a size href is set
    10 numbered pagination + "Showing X to Y of Z"   -> pagination partial + results-count line
    11 column-manager (toggle columns)               -> data-table.column-visibility (host fills items)
    12 summary / footer row                          -> table.footer + ColumnSummary cells
    13 empty state                                   -> empty partial
    14 rich cells (Text/Badge/Link/Icon/Tags/...)    -> kit.table.rich-cell

  Params:
    table     - the KitTableView render bundle (the AdminListView + render-time URL/selection facts).
    createUrl - the "New" create href (Filament's create header action); "" hides the create button.
    columnManager - host-supplied column-visibility items (one dropdown-menu.item per toggleable
                    column); null hides the column manager.
--%>
@param KitTableView table
@param String createUrl = ""
@param gg.jte.Content columnManager = null
!{AdminListView view = table.view();}
!{AdminListView.Controls controls = view.controls();}
!{AdminListView.Pagination pagination = view.pagination();}
!{KitTableView.Selection selection = table.selection();}
!{int columnCount = view.headers().size() + (selection.enabled() ? 1 : 0) + 1;}
<div data-slot="kit-table" data-admin-list class="w-full" style="font-family:var(--lv-font-sans);">

  <%-- 1. Header bar: heading + the resource-scoped header actions (Filament fi-ta-header). --%>
  <div data-slot="kit-table-header" class="flex items-center justify-between gap-[var(--lv-space-2)]">
    <h1 data-admin-heading class="text-[length:var(--lv-text-xl)] font-[var(--lv-font-semibold)] text-[var(--lv-color-fg)]">${view.heading()}</h1>
    <div data-admin-toolbar class="flex items-center gap-[var(--lv-space-2)]">
      @for(AdminListView.HeaderAction action : view.headerActions())
        @if(action.hasUrl())
          @template.lievit.button(variant = "secondary", size = "sm", href = action.url(),
            attrs = action.newTab() ? "target=\"_blank\" rel=\"noopener noreferrer\"" : "",
            dataAttrs = java.util.Map.of("admin-header-action", action.name()),
            content = @`${action.label()}`)
        @else
          @template.lievit.button(variant = "secondary", size = "sm", wireClick = action.name(),
            dataAttrs = java.util.Map.of("admin-header-action", action.name()),
            content = @`${action.label()}`)
        @endif
      @endfor
      @if(createUrl != null && !createUrl.isBlank())
        @template.lievit.button(variant = "primary", size = "sm", href = createUrl,
          dataAttrs = java.util.Map.of("admin-create", "true"), content = @`New`)
      @endif
    </div>
  </div>

  <%-- 2 + 3 + 11. Toolbar: global search (left), filters trigger + column-manager (right). --%>
  @template.lievit.data-table.toolbar(
    search = controls.searchable() ? @`
      <form method="get" data-slot="kit-table-search-form" role="search" class="flex items-center gap-[var(--lv-space-2)]">
        @template.lievit.input(name = "q", type = "search", size = "sm", value = controls.search(),
          placeholder = "Search...", model = "search", ariaLabel = "Search", cssClass = "max-w-[20rem]")
        @if(!controls.search().isBlank())
          @template.lievit.button(variant = "ghost", size = "sm", wireClick = "clearSearch", content = @`Clear`)
        @endif
      </form>
    ` : null,
    end = @`
      @if(controls.hasFilters())
        <div data-admin-filters-trigger class="inline-flex items-center gap-[var(--lv-space-1)] text-[length:var(--lv-text-sm)] text-[var(--lv-color-muted-fg)]">
          @template.lievit.icon(name = "funnel", size = "1rem")
          <span>Filters</span>
          @if(controls.activeFilterCount() > 0)
            @template.lievit.badge(variant = "neutral", label = String.valueOf(controls.activeFilterCount()))
          @endif
        </div>
      @endif
      @if(columnManager != null)
        @template.lievit.data-table.column-visibility(content = columnManager)
      @endif
    `
  )

  <%-- 3. Inline filter panel: one control per registered filter (toggle / select / ternary / trashed). --%>
  @if(controls.hasFilters())
    <div data-admin-filters data-filters-layout="${controls.filtersLayout().token()}" class="flex flex-wrap items-end gap-[var(--lv-space-3)] py-[var(--lv-space-2)]">
      @for(AdminListView.FilterControl filter : controls.filterControls())
        <div data-admin-filter="${filter.name()}" data-filter-kind="${filter.kind().name()}" data-filter-active="${filter.active()}">
          @if(filter.kind() == AdminListView.FilterControl.Kind.TOGGLE)
            @template.lievit.checkbox(name = filter.name(), checked = filter.active(),
              label = filter.label(), model = "filters." + filter.name())
          @else
            !{var opts = new java.util.ArrayList<String>(filter.options().keySet());}
            @template.lievit.native-select(name = filter.name(), label = filter.label(), size = "sm",
              options = opts,
              value = filter.selected().isEmpty() ? "" : filter.selected().get(0),
              placeholder = filter.hasPlaceholder() ? filter.placeholder() : null,
              model = "filters." + filter.name())
          @endif
        </div>
      @endfor
    </div>
  @endif

  <%-- 4. Active-filter indicator chips + reset-all (Filament filter indicators). --%>
  @if(table.hasFilterChips() || table.hasResetFiltersHref())
    <div data-admin-filter-indicators class="flex flex-wrap items-center gap-[var(--lv-space-2)] py-[var(--lv-space-1)]">
      @for(KitTableView.FilterChip chip : table.filterChips())
        @template.lievit.chip(label = chip.label(), removeHref = chip.removeHref(),
          removeLabel = "Remove filter " + chip.label())
      @endfor
      @if(table.hasResetFiltersHref())
        <a href="${table.resetFiltersHref()}" data-admin-filters-reset
           class="text-[length:var(--lv-text-sm)] text-[var(--lv-color-muted-fg)] underline hover:text-[var(--lv-color-fg)]">Reset all</a>
      @endif
    </div>
  @endif

  <%-- The table (table/* primitives). --%>
  <div data-slot="kit-table-scroll" class="relative w-full overflow-x-auto rounded-[var(--lv-radius-md)] border border-[var(--lv-color-border)]">
    <table data-slot="table" class="w-full caption-bottom text-[length:var(--lv-text-sm)]" style="border-collapse:collapse;">
      @template.lievit.table.header(content = @`
        <%-- 8. Header-group super-row (colspan), when a column group is registered. --%>
        @if(view.hasHeaderGroups())
          <tr data-admin-header-groups>
            @if(selection.enabled())<th aria-hidden="true"></th>@endif
            @for(AdminListView.HeaderGroup group : view.headerGroups())
              @if(group.isGroup())
                <th colspan="${group.span()}" data-admin-header-group="${group.label()}" data-align="${group.alignment()}"
                    class="lv-table-head px-2 text-left align-middle font-medium" style="color:var(--lv-color-fg);">${group.label()}</th>
              @else
                <th colspan="${group.span()}" data-admin-header-group-spacer></th>
              @endif
            @endfor
            <th aria-hidden="true"></th>
          </tr>
        @endif
        <%-- 5 (header) + 7. Select-all box + sortable column headers. --%>
        <tr>
          @if(selection.enabled())
            @template.lievit.data-table.selection-cell(header = true, name = "selectAll",
              checked = selection.allSelected(), indeterminate = selection.someSelected(), model = "selectAll")
          @endif
          @for(AdminListView.Header header : view.headerCells())
            @template.kit.table.sortable-head(header = header, sortHref = table.sortHref(header.sortKey()))
          @endfor
          @template.lievit.table.head(content = @`Actions`)
        </tr>
      `)
      @if(view.rows().isEmpty())
        <%-- 13. Empty state: a single full-width cell holding the empty panel. --%>
        @template.lievit.table.body(content = @`
          <tr data-admin-empty>
            <td colspan="${columnCount}" class="p-0">
              @template.lievit.empty(title = controls.emptyStateHeading(),
                description = controls.emptyStateDescription(), icon = "file")
            </td>
          </tr>
        `)
      @else
        @template.lievit.table.body(content = @`
          @for(AdminListView.Row row : view.rows())
            !{var rowSelected = selection.isSelected(row.id());}
            @template.lievit.table.row(state = rowSelected ? "selected" : "", content = @`
              @if(selection.enabled())
                @template.lievit.data-table.selection-cell(name = "selected", value = row.id(),
                  checked = rowSelected, model = "selected")
              @endif
              @for(Cell cell : row.cells())
                @template.lievit.table.cell(content = @`@template.kit.table.rich-cell(cell = cell)`)
              @endfor
              @template.lievit.table.cell(content = @`
                <a href="${createUrl}" data-admin-row-action="${row.id()}" class="text-[var(--lv-color-primary)] hover:underline">Edit</a>
              `)
            `)
          @endfor
        `)
      @endif
      <%-- 12. Summary / footer row, when summaries are projected. --%>
      @if(table.hasSummaries())
        @template.lievit.table.footer(content = @`
          <tr data-admin-summary>
            @if(selection.enabled())<td></td>@endif
            @for(ColumnSummary summary : table.summaries())
              @template.lievit.table.cell(content = @`<span data-admin-summary-label>${summary.label()}</span> <span data-admin-summary-value>${summary.value()}</span>`)
            @endfor
            <td></td>
          </tr>
        `)
      @endif
    </table>
  </div>

  <%-- 6. Bulk-action bar: "N of M row(s) selected" + the bulk actions (shown when a row is selected). --%>
  @if(selection.enabled())
    @template.lievit.data-table.selection-footer(selected = selection.selectedCount(),
      total = (int) selection.total(),
      actions = selection.hasSelection() ? @`
        @template.lievit.button(variant = "destructive", size = "sm", wireClick = "deleteSelected", content = @`Delete selected`)
      ` : null)
  @endif

  <%-- 9 + 10. Per-page selector, numbered pagination + "Showing X to Y of Z results". --%>
  <div data-slot="kit-table-pagination" class="flex flex-wrap items-center justify-between gap-[var(--lv-space-3)] py-[var(--lv-space-3)]">
    <div data-admin-results-count aria-live="polite" class="text-[length:var(--lv-text-sm)] text-[var(--lv-color-muted-fg)]">
      @if(pagination.total() == 0)
        No results
      @else
        Showing ${pagination.firstShown()} to ${pagination.lastShown()} of ${pagination.total()} results
      @endif
    </div>
    @if(table.hasSizeHref())
      <div data-admin-per-page class="flex items-center gap-[var(--lv-space-2)] text-[length:var(--lv-text-sm)] text-[var(--lv-color-muted-fg)]">
        <span>Per page</span>
        @for(int size : controls.pageSizeOptions())
          <a href="${table.sizeHrefPattern().formatted(size)}" data-admin-page-size="${size}"
             aria-current="${size == pagination.size() ? "true" : null}"
             class="rounded-[var(--lv-radius-md)] px-[var(--lv-space-2)] no-underline ${size == pagination.size() ? "font-[var(--lv-font-semibold)] text-[var(--lv-color-fg)]" : "text-[var(--lv-color-muted-fg)] hover:text-[var(--lv-color-fg)]"}">${size}</a>
        @endfor
      </div>
    @endif
    @if(pagination.totalPages() > 1)
      @if(table.hasPageHref())
        <%-- inline = true: the footer row already lays this out (count left | per-page + pager
             clustered right via justify-between); the pager must NOT self-center full-width. --%>
        @template.lievit.pagination(current = pagination.page(), total = pagination.totalPages(),
          hrefPattern = table.pageHrefPattern(), inline = true)
      @else
        <nav data-admin-pagination class="flex items-center gap-[var(--lv-space-2)]">
          @if(pagination.hasPrevious())
            @template.lievit.button(variant = "ghost", size = "sm", wireClick = "prev", content = @`Previous`)
          @endif
          <span data-admin-page>Page ${pagination.page()} of ${pagination.totalPages()}</span>
          @if(pagination.hasNext())
            @template.lievit.button(variant = "ghost", size = "sm", wireClick = "next", content = @`Next`)
          @endif
        </nav>
      @endif
    @endif
  </div>
</div>
