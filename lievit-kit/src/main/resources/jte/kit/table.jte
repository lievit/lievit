@import io.lievit.kit.AdminListView
@import io.lievit.kit.Cell
@import io.lievit.kit.ColumnSummary
@import io.lievit.kit.RowAction
@import io.lievit.kit.page.KitTableView
@import io.lievit.kit.page.KitTableLabels
@import io.lievit.kit.page.SavedViewsView
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
                    column); null falls back to the AUTO-rendered "Columns" dropdown built from the
                    view-model's toggleable columns (view.columnToggles()), shown only when the table
                    has any toggleable column. Pass a non-null Content to override the items entirely.
    headerExtra - OPTIONAL chrome slot beside the heading (Filament publish-views): null renders nothing.
    toolbarEnd  - OPTIONAL chrome slot at the end of the filter/toolbar row: null renders nothing.
    aboveTable  - OPTIONAL chrome slot between the toolbar and the table: null renders nothing.

  i18n: every chrome string comes from table.labels() (a KitTableLabels value object); the host maps
  its own MessageSource into it. KitTableLabels.DEFAULT carries the English copy, so a host that
  supplies no labels renders exactly as before.
--%>
@param KitTableView table
@param String createUrl = ""
@param gg.jte.Content columnManager = null
@param gg.jte.Content headerExtra = null
@param gg.jte.Content toolbarEnd = null
@param gg.jte.Content aboveTable = null
!{AdminListView view = table.view();}
!{KitTableLabels labels = table.labels();}
!{AdminListView.Controls controls = view.controls();}
!{AdminListView.Pagination pagination = view.pagination();}
!{KitTableView.Selection selection = table.selection();}
!{int columnCount = view.headers().size() + (selection.enabled() ? 1 : 0) + 1;}
!{SavedViewsView savedViews = table.savedViews();}
<div data-slot="kit-table" data-admin-list class="w-full" style="font-family:var(--lv-font-sans);">

  <%-- 1. Header bar: heading + the resource-scoped header actions (Filament fi-ta-header). --%>
  <div data-slot="kit-table-header" class="flex items-center justify-between gap-[var(--lv-space-2)]">
    <div data-admin-heading-row class="flex items-center gap-[var(--lv-space-3)]">
      <h1 data-admin-heading class="text-[length:var(--lv-text-xl)] font-[var(--lv-font-semibold)] text-[var(--lv-color-fg)]">${view.heading()}</h1>
      @if(headerExtra != null)
        <div data-admin-header-extra class="flex items-center gap-[var(--lv-space-2)]">${headerExtra}</div>
      @endif
    </div>
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
          dataAttrs = java.util.Map.of("admin-create", "true"), content = @`${labels.newRecord()}`)
      @endif
    </div>
  </div>

  <%-- 15. Saved-views switcher: the Salesforce list-view tab strip / Filament advanced-table tabs.
       Each tab is a real GET <a href> (?view=<id>, JS-off) with an optional count badge + a pinned
       star on the default; tabs past the first few collapse into an overflow dropdown; a "Save/manage"
       dropdown exposes the wire action names the host arms. Renders only when a view exists. Strict
       CSP: no inline <script>/on*; user view names ride JTE auto-escape (${...}), never $unsafe. --%>
  @if(table.hasSavedViews())
    !{int visibleTabCount = 5;}
    <div data-slot="kit-table-views" data-admin-views aria-label="Saved views"
         class="flex items-center justify-between gap-[var(--lv-space-2)] border-b border-[var(--lv-color-border)]">
      <nav data-admin-view-tabs role="tablist" class="flex flex-wrap items-center gap-[var(--lv-space-1)]">
        @for(int i = 0; i < savedViews.tabs().size(); i++)
          !{SavedViewsView.Tab tab = savedViews.tabs().get(i);}
          @if(i < visibleTabCount)
            !{boolean tabActive = savedViews.isActive(tab.id());}
            <a href="${table.viewHref(tab.id())}" role="tab" data-admin-view-tab="${tab.id()}"
               aria-selected="${tabActive ? "true" : "false"}"
               aria-current="${tabActive ? "true" : null}"
               class="inline-flex items-center gap-[var(--lv-space-1)] rounded-t-[var(--lv-radius-md)] border-b-2 px-[var(--lv-space-3)] py-[var(--lv-space-2)] text-[length:var(--lv-text-sm)] no-underline ${tabActive ? "border-[var(--lv-color-primary)] font-[var(--lv-font-semibold)] text-[var(--lv-color-fg)]" : "border-transparent text-[var(--lv-color-muted-fg)] hover:text-[var(--lv-color-fg)]"}">
              @if(tab.isDefault())
                <span aria-hidden="true" data-admin-view-default>@template.lievit.icon(name = "star", size = "0.875rem")</span>
              @endif
              <span>${tab.name()}</span>
              @if(tab.hasCount())
                @template.lievit.badge(variant = "neutral", label = String.valueOf(tab.count().getAsLong()))
              @endif
            </a>
          @endif
        @endfor
        @if(savedViews.tabs().size() > visibleTabCount)
          @template.lievit.dropdown-menu(
            id = "kit-views-overflow",
            trigger = @`@template.lievit.icon(name = "ellipsis", size = "1rem") <span>${labels.more()}</span>`,
            content = @`
              @for(int i = 0; i < savedViews.tabs().size(); i++)
                !{SavedViewsView.Tab tab = savedViews.tabs().get(i);}
                @if(i >= visibleTabCount)
                  @template.lievit.dropdown-menu.item(href = table.viewHref(tab.id()), label = tab.name(),
                    icon = tab.isDefault() ? "star" : "")
                @endif
              @endfor
            `)
        @endif
      </nav>
      <div data-admin-view-manage class="flex items-center gap-[var(--lv-space-1)]">
        @if(savedViews.dirty())
          <span data-admin-view-dirty class="text-[length:var(--lv-text-xs)] text-[var(--lv-color-muted-fg)]">${labels.unsavedChanges()}</span>
        @endif
        @template.lievit.dropdown-menu(
          id = "kit-views-manage",
          trigger = @`@template.lievit.icon(name = "plus", size = "1rem") <span>${labels.saveViewTrigger()}</span>`,
          content = @`
            <button type="button" role="menuitem" data-slot="dropdown-menu-item" l:click="${KitTableView.ACTION_SAVE_VIEW}"
              class="flex w-full items-center gap-[var(--lv-space-2)] border-0 bg-transparent px-[var(--lv-space-3)] py-[var(--lv-space-2)] text-left text-[var(--lv-color-fg)]">${labels.saveView()}</button>
            <button type="button" role="menuitem" data-slot="dropdown-menu-item" l:click="${KitTableView.ACTION_UPDATE_VIEW}"
              class="flex w-full items-center gap-[var(--lv-space-2)] border-0 bg-transparent px-[var(--lv-space-3)] py-[var(--lv-space-2)] text-left text-[var(--lv-color-fg)]">${labels.updateView()}</button>
            <button type="button" role="menuitem" data-slot="dropdown-menu-item" l:click="${KitTableView.ACTION_SET_DEFAULT_VIEW}"
              class="flex w-full items-center gap-[var(--lv-space-2)] border-0 bg-transparent px-[var(--lv-space-3)] py-[var(--lv-space-2)] text-left text-[var(--lv-color-fg)]">${labels.setDefaultView()}</button>
            <button type="button" role="menuitem" data-slot="dropdown-menu-item" data-variant="destructive" l:click="${KitTableView.ACTION_DELETE_VIEW}"
              class="flex w-full items-center gap-[var(--lv-space-2)] border-0 bg-transparent px-[var(--lv-space-3)] py-[var(--lv-space-2)] text-left text-[var(--lv-color-destructive)]">${labels.deleteView()}</button>
          `)
      </div>
    </div>
  @endif

  <%-- 2 + 3 + 11. Toolbar: global search (left), filters trigger + column-manager (right). --%>
  @template.lievit.data-table.toolbar(
    search = controls.searchable() ? @`
      <form method="get" data-slot="kit-table-search-form" role="search" class="flex items-center gap-[var(--lv-space-2)]">
        @template.lievit.input(name = "q", type = "search", size = "sm", value = controls.search(),
          placeholder = labels.search(), model = "search", ariaLabel = labels.searchAria(), cssClass = "max-w-[20rem]")
        @if(!controls.search().isBlank())
          @template.lievit.button(variant = "ghost", size = "sm", wireClick = "clearSearch", content = @`${labels.clear()}`)
        @endif
      </form>
    ` : null,
    end = @`
      @if(controls.hasFilters())
        <div data-admin-filters-trigger class="inline-flex items-center gap-[var(--lv-space-1)] text-[length:var(--lv-text-sm)] text-[var(--lv-color-muted-fg)]">
          @template.lievit.icon(name = "funnel", size = "1rem")
          <span>${labels.filters()}</span>
          @if(controls.activeFilterCount() > 0)
            @template.lievit.badge(variant = "neutral", label = String.valueOf(controls.activeFilterCount()))
          @endif
        </div>
      @endif
      <%-- 11. Column manager: a host-supplied items slot overrides; otherwise the AUTO dropdown built
           from the view-model's toggleable columns. Each checkbox item is a real GET <a href> when a
           column-toggle href is configured, else a wire l:click (ACTION_TOGGLE_COLUMN) carrying the
           column key. Shown only when there is at least one toggleable column. --%>
      @if(columnManager != null)
        @template.lievit.data-table.column-visibility(label = labels.columns(), content = columnManager)
      @elseif(table.hasColumnToggles())
        @template.lievit.data-table.column-visibility(label = labels.columns(), content = @`
          @for(AdminListView.ColumnToggle col : view.columnToggles())
            @if(table.hasColumnToggleHref())
              @template.lievit.dropdown-menu.item(type = "checkbox", label = col.label(),
                checked = col.visible(), href = table.columnToggleHref(col.key()))
            @else
              @template.lievit.dropdown-menu.item(type = "checkbox", label = col.label(),
                checked = col.visible(), wireClick = "${KitTableView.ACTION_TOGGLE_COLUMN}",
                wireArgs = java.util.Map.of("col", col.key()))
            @endif
          @endfor
        `)
      @endif
      @if(toolbarEnd != null)
        <div data-admin-toolbar-end class="flex items-center gap-[var(--lv-space-2)]">${toolbarEnd}</div>
      @endif
    `
  )

  <%-- OPTIONAL aboveTable slot: host chrome between the toolbar and the table (Filament publish-views). --%>
  @if(aboveTable != null)
    <div data-admin-above-table class="py-[var(--lv-space-2)]">${aboveTable}</div>
  @endif

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
           class="text-[length:var(--lv-text-sm)] text-[var(--lv-color-muted-fg)] underline hover:text-[var(--lv-color-fg)]">${labels.resetAll()}</a>
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
          @template.lievit.table.head(content = @`${labels.actions()}`)
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
              <%-- Trailing actions cell: the generic per-row actions resolved on the view-model
                   (Filament Table->actions), one button each (a real <a href> link action or an
                   l:click wire action, the button partial owns the root tag so there is no
                   different-root-per-branch gotcha here). When a row has no actions we fall back to
                   the legacy single Edit link so existing hosts keep their row affordance. --%>
              @template.lievit.table.cell(content = @`
                @if(row.hasActions())
                  <div data-admin-row-actions="${row.id()}" class="flex items-center gap-[var(--lv-space-1)]">
                    @for(RowAction action : row.actions())
                      @if(action.hasHref())
                        @template.lievit.button(variant = action.variant(), size = "sm",
                          href = action.href(),
                          disabled = action.disabled(),
                          attrs = action.newTab() ? "target=\"_blank\" rel=\"noopener noreferrer\"" : "",
                          dataAttrs = action.requiresConfirmation() ? java.util.Map.of("admin-row-action", action.label(), "confirm", action.confirm()) : java.util.Map.of("admin-row-action", action.label()),
                          content = @`@if(action.hasIcon())@template.lievit.icon(name = action.icon(), size = "1rem")@endif<span>${action.label()}</span>`)
                      @else
                        @template.lievit.button(variant = action.variant(), size = "sm",
                          wireClick = action.wire(), wireArgs = action.wireArgs(),
                          disabled = action.disabled(),
                          dataAttrs = action.requiresConfirmation() ? java.util.Map.of("admin-row-action", action.label(), "confirm", action.confirm()) : java.util.Map.of("admin-row-action", action.label()),
                          content = @`@if(action.hasIcon())@template.lievit.icon(name = action.icon(), size = "1rem")@endif<span>${action.label()}</span>`)
                      @endif
                    @endfor
                  </div>
                @else
                  <a href="${createUrl}" data-admin-row-action="${row.id()}" class="text-[var(--lv-color-primary)] hover:underline">${labels.edit()}</a>
                @endif
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
        @template.lievit.button(variant = "destructive", size = "sm", wireClick = "deleteSelected", content = @`${labels.deleteSelected()}`)
      ` : null)
  @endif

  <%-- 9 + 10. Per-page selector, numbered pagination + "Showing X to Y of Z results". --%>
  <div data-slot="kit-table-pagination" class="flex flex-wrap items-center justify-between gap-[var(--lv-space-3)] py-[var(--lv-space-3)]">
    <div data-admin-results-count aria-live="polite" class="text-[length:var(--lv-text-sm)] text-[var(--lv-color-muted-fg)]">
      @if(pagination.total() == 0)
        ${labels.noResults()}
      @else
        ${labels.resultsCount(pagination.firstShown(), pagination.lastShown(), pagination.total())}
      @endif
    </div>
    @if(table.hasSizeHref())
      <div data-admin-per-page class="flex items-center gap-[var(--lv-space-2)] text-[length:var(--lv-text-sm)] text-[var(--lv-color-muted-fg)]">
        <span>${labels.perPage()}</span>
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
            @template.lievit.button(variant = "ghost", size = "sm", wireClick = "prev", content = @`${labels.previous()}`)
          @endif
          <span data-admin-page>${labels.page(pagination.page(), pagination.totalPages())}</span>
          @if(pagination.hasNext())
            @template.lievit.button(variant = "ghost", size = "sm", wireClick = "next", content = @`${labels.next()}`)
          @endif
        </nav>
      @endif
    @endif
  </div>
</div>
