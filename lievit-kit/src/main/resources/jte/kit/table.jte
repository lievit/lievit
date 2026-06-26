@import dev.lievit.kit.AdminListView
@import dev.lievit.kit.Cell
@import dev.lievit.kit.ColumnSummary
@import dev.lievit.kit.RowAction
@import dev.lievit.kit.page.KitTableView
@import dev.lievit.kit.page.KitTableLabels
@import dev.lievit.kit.page.SavedViewsView
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

  Params (additive; all new params default to null — existing adopters are unaffected):
    table     - the KitTableView render bundle (the AdminListView + render-time URL/selection facts).
    createUrl - the "New" create href (Filament's create header action); "" hides the create button.
    columnManager - host-supplied column-visibility items (one dropdown-menu.item per toggleable
                    column); null falls back to the AUTO-rendered "Columns" dropdown built from the
                    view-model's toggleable columns (view.columnToggles()), shown only when the table
                    has any toggleable column. Pass a non-null Content to override the items entirely.
    headerExtra - OPTIONAL slot beside the heading (Filament publish-views): null renders nothing.
    headerActionsExtra - OPTIONAL slot inside the header-actions cluster (beside the create button,
                    e.g. CSV export); null renders nothing.  [#489, ADR sw-architecture-008]
    scopeBar    - OPTIONAL slot above the filter toolbar that constrains the visible row set (e.g. a
                    toggle group "All / Active / Archived", a colleague picker); null renders nothing.
                    [#489, ADR sw-architecture-008]
    toolbarEnd  - OPTIONAL slot at the end of the filter/toolbar row (e.g. an advanced-search
                    popover trigger); null renders nothing.
    aboveTable  - OPTIONAL slot between the toolbar and the table (e.g. active-filter chips from an
                    alternative filter UI); null renders nothing.
    favoriteTabs - OPTIONAL slot appended inside the saved-views tab nav (e.g. user-starred views
                    promoted to the tab strip, Filament Advanced Tables v3); null renders nothing.
                    [#489, ADR sw-architecture-008]
    viewsManager - OPTIONAL slot that REPLACES the kit's default saved-views manage dropdown (for
                    adopters that need a custom Save/manage modal); null falls back to the kit default.
                    [#489, ADR sw-architecture-008]
    bulkActions - OPTIONAL slot inside the selection-footer that REPLACES the default "Delete
                    selected" button; null falls back to the default.  [#489, ADR sw-architecture-008]
    rowActionsSlot - OPTIONAL per-row fallback slot: rendered in the trailing actions cell when a row
                    carries NO kit-declared Row.actions(); lets adopters inject custom row chrome
                    (e.g. a stateful arm/confirm sequence) without forking the template.
                    [#490, ADR sw-architecture-008]

  Sort-token anti-tampering (#491, ADR sw-architecture-008): when table.hasSortTokenSigner() is
  true, the sortable-column links carry HMAC-signed tokens instead of plain keys; the host's
  controller calls SortTokenSigner.verify() to reject tampered ?sort= values. Opt-in; existing
  adopters pass no signer and continue to receive plain links.

  i18n: every chrome string comes from table.labels() (a KitTableLabels value object); the host maps
  its own MessageSource into it. KitTableLabels.DEFAULT carries the English copy, so a host that
  supplies no labels renders exactly as before.
--%>
@param KitTableView table
@param String createUrl = ""
@param gg.jte.Content columnManager = null
@param gg.jte.Content headerExtra = null
@param gg.jte.Content headerActionsExtra = null
@param gg.jte.Content scopeBar = null
@param gg.jte.Content toolbarEnd = null
@param gg.jte.Content aboveTable = null
@param gg.jte.Content favoriteTabs = null
@param gg.jte.Content viewsManager = null
@param gg.jte.Content bulkActions = null
@param gg.jte.Content rowActionsSlot = null
!{AdminListView view = table.view();}
!{KitTableLabels labels = table.labels();}
!{AdminListView.Controls controls = view.controls();}
!{AdminListView.Pagination pagination = view.pagination();}
!{KitTableView.Selection selection = table.selection();}
!{int columnCount = view.headers().size() + (selection.enabled() ? 1 : 0) + 1;}
!{SavedViewsView savedViews = table.savedViews();}
<%-- Filament fidelity (fi-ta-ctn): the WHOLE chrome (heading -> toolbar -> bars -> table ->
     pagination) sits in ONE elevated card: rounded-xl, a hairline ring/border, a soft shadow, on the
     page background, with the internal sections divided by border-b. No overflow-hidden on the root:
     the column-manager / saved-views dropdowns must be free to escape the card edge. --%>
<div data-slot="kit-table" data-admin-list
     class="w-full rounded-[var(--lv-radius-xl)] border border-[var(--lv-color-border)] bg-[var(--lv-color-bg)] shadow-[var(--lv-shadow-sm)]"
     style="font-family:var(--lv-font-sans);">

  <%-- 1. Header bar: heading + the resource-scoped header actions (Filament fi-ta-header). The card
       gutter (px) + the section divider (border-b) come from the card frame. --%>
  <div data-slot="kit-table-header" class="flex items-center justify-between gap-[var(--lv-space-2)] border-b border-[var(--lv-color-border)] px-[var(--lv-space-4)] py-[var(--lv-space-3)]">
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
      <%-- #489 slot: extra header actions beside the create button (e.g. CSV export, ADR sw-architecture-008). --%>
      @if(headerActionsExtra != null)
        <div data-admin-header-actions-extra class="flex items-center gap-[var(--lv-space-2)]">${headerActionsExtra}</div>
      @endif
    </div>
  </div>

  <%-- #489 slot: scope bar above the filter toolbar (e.g. toggle group "All / Active / Archived",
       colleague picker); scopes WHAT the table reads (ADR sw-architecture-008). --%>
  @if(scopeBar != null)
    <div data-admin-scope-bar class="py-[var(--lv-space-2)]">${scopeBar}</div>
  @endif

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
        <%-- #489 slot: user-starred views promoted into the tab strip (Filament Advanced Tables v3
             favourites-as-tabs); rendered after preset tabs so they blend in. ADR sw-architecture-008. --%>
        @if(favoriteTabs != null)${favoriteTabs}@endif
      </nav>
      <div data-admin-view-manage class="flex items-center gap-[var(--lv-space-1)]">
        @if(savedViews.dirty())
          <span data-admin-view-dirty class="text-[length:var(--lv-text-xs)] text-[var(--lv-color-muted-fg)]">${labels.unsavedChanges()}</span>
        @endif
        <%-- #489 slot: viewsManager REPLACES the kit's default manage dropdown when supplied (e.g. a
             custom Save-view modal trigger); null falls back to the kit's four wire actions.
             ADR sw-architecture-008. --%>
        @if(viewsManager != null)
          ${viewsManager}
        @else
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
        @endif
      </div>
    </div>
  @endif

  <%-- 2 + 3 + 11. Toolbar: global search (left), filters trigger + column-manager (right). The card
       gutter (px) + section divider (border-b) ride the toolbar's own klass so the row sits inside
       the card frame. --%>
  @template.lievit.data-table.toolbar(
    klass = "px-[var(--lv-space-4)] border-b border-[var(--lv-color-border)]",
    search = controls.searchable() ? @`
      <form method="get" data-slot="kit-table-search-form" role="search" class="flex items-center gap-[var(--lv-space-2)]">
        <%-- v-next input: model= and ariaLabel= removed; use a sr-only <label> for a11y. --%>
        <label for="kit-table-search-q" class="sr-only">${labels.searchAria()}</label>
        @template.lievit.input(name = "q", id = "kit-table-search-q", type = "search", size = "sm",
          value = controls.search(), placeholder = labels.search(), cssClass = "max-w-[20rem]")
        @if(!controls.search().isBlank())
          @template.lievit.button(variant = "ghost", size = "sm", wireClick = "clearSearch", content = @`${labels.clear()}`)
        @endif
      </form>
    ` : null,
    end = @`
      @if(controls.hasFilters())
        <%-- Filament fidelity (#5): the "Filtri" affordance is a real <button> trigger sitting in the
             toolbar's right cluster beside search (the actionable fi-ta filters control), not a static
             <div> indicator. aria-controls points at the always-open inline filter panel below (the
             server-first / strict-CSP JS-off fallback); the button toggles its visibility client-side
             when an enhancer is present, and is a harmless no-op (panel already visible) when JS is off.
             No hardcoded wire action: the panel below is the server-rendered source of truth. --%>
        <button type="button" data-admin-filters-trigger data-slot="filters-trigger"
                aria-controls="kit-table-filters" aria-expanded="true"
                class="inline-flex items-center gap-[var(--lv-space-1)] rounded-[var(--lv-radius-md)] border border-[var(--lv-color-border)] bg-transparent px-[var(--lv-space-2)] py-[var(--lv-space-1)] text-[length:var(--lv-text-sm)] text-[var(--lv-color-fg)] hover:bg-[color-mix(in_srgb,var(--lv-color-surface)_50%,var(--lv-color-bg))]">
          @template.lievit.icon(name = "funnel", size = "1rem")
          <span>${labels.filters()}</span>
          @if(controls.activeFilterCount() > 0)
            @template.lievit.badge(variant = "neutral", label = String.valueOf(controls.activeFilterCount()))
          @endif
        </button>
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
    <div id="kit-table-filters" data-admin-filters data-filters-layout="${controls.filtersLayout().token()}" class="flex flex-wrap items-end gap-[var(--lv-space-3)] border-b border-[var(--lv-color-border)] px-[var(--lv-space-4)] py-[var(--lv-space-3)]">
      @for(AdminListView.FilterControl filter : controls.filterControls())
        <div data-admin-filter="${filter.name()}" data-filter-kind="${filter.kind().name()}" data-filter-active="${filter.active()}">
          @if(filter.kind() == AdminListView.FilterControl.Kind.TOGGLE)
            <%-- v-next checkbox: label= and model= removed; use a sibling <label> for the accessible name. --%>
            <label class="inline-flex items-center gap-[var(--lv-space-2)] cursor-pointer text-[length:var(--lv-text-sm)]">
              @template.lievit.checkbox(name = filter.name(), id = "kit-filter-" + filter.name(),
                checked = filter.active())
              <span>${filter.label()}</span>
            </label>
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

  <%-- The table (table/* primitives). The card frame is the single elevated surface now, so the
       scroll wrapper drops its OWN box (no double border / rounding); it only scrolls horizontally. --%>
  <div data-slot="kit-table-scroll" class="relative w-full overflow-x-auto">
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
          @for(int _hi = 0; _hi < view.headerCells().size(); _hi++)
            !{AdminListView.Header header = view.headerCells().get(_hi);}
            <%-- #491 signed sort-token: the sort link carries an HMAC-signed token when the host
                 wires a SortTokenSigner; a re-click on the active sort column carries the negated key
                 ("-key") to toggle asc→desc, signed with the same key so the server verifies both
                 directions. Unsigned mode (no signer) is the backward-compatible default.
                 ADR sw-architecture-008. --%>
            !{var _rawSortKey = (header.isSorted() && header.sortDirection() == dev.lievit.kit.SortDirection.ASC) ? "-" + header.sortKey() : header.sortKey();}
            <%-- Filament fi-ta edge gutter: the first DATA header gets the leading inset only when no
                 select-all checkbox column precedes it (else the checkbox cell is the leading column). --%>
            @template.kit.table.sortable-head(header = header, sortHref = table.sortHref(_rawSortKey),
              edge = (_hi == 0 && !selection.enabled()) ? "first" : "")
          @endfor
          @template.lievit.table.head(edge = "last", content = @`${labels.actions()}`)
        </tr>
      `)
      @if(view.rows().isEmpty())
        <%-- 13. Empty state: a single full-width cell holding the empty panel. --%>
        @template.lievit.table.body(content = @`
          <tr data-admin-empty>
            <td colspan="${columnCount}" class="p-0">
              @template.lievit.empty(title = controls.emptyStateHeading(),
                description = controls.emptyStateDescription())
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
              <%-- Filament fi-ta edge gutter: the first DATA cell gets the leading inset only when no
                   select-all checkbox column precedes it. --%>
              @for(int _ci = 0; _ci < row.cells().size(); _ci++)
                !{Cell cell = row.cells().get(_ci);}
                @template.lievit.table.cell(edge = (_ci == 0 && !selection.enabled()) ? "first" : "",
                  content = @`@template.kit.table.rich-cell(cell = cell)`)
              @endfor
              <%-- Trailing actions cell: preference order (Filament Table->actions, #490):
                   1. GENERIC kit Row.actions() — per-record static actions declared on the Resource.
                   2. #490 rowActionsSlot — host-supplied per-row fallback for stateful or custom
                      actions (e.g. arm/confirm, that cannot be expressed as static Row.actions()).
                      Rendered once per row; the host receives no context param (use the surrounding
                      template or a child component for per-row state). ADR sw-architecture-008.
                   3. Kit fallback: the legacy single Edit link so hosts without actions keep a link. --%>
              @template.lievit.table.cell(edge = "last", content = @`
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
                @elseif(rowActionsSlot != null)
                  <div data-admin-row-actions-slot="${row.id()}" class="flex items-center gap-[var(--lv-space-1)]">${rowActionsSlot}</div>
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

  <%-- 6. Bulk-action bar: "N of M row(s) selected" + the bulk actions (shown when a row is selected).
       #489 slot: bulkActions REPLACES the default "Delete selected" button when supplied.
       ADR sw-architecture-008. --%>
  @if(selection.enabled())
    @template.lievit.data-table.selection-footer(selected = selection.selectedCount(),
      total = (int) selection.total(),
      actions = selection.hasSelection() ? @`
        @if(bulkActions != null)
          ${bulkActions}
        @else
          @template.lievit.button(variant = "destructive", size = "sm", wireClick = "deleteSelected", content = @`${labels.deleteSelected()}`)
        @endif
      ` : null)
  @endif

  <%-- 9 + 10. Per-page selector, numbered pagination + "Showing X to Y of Z results". --%>
  <div data-slot="kit-table-pagination" class="flex flex-wrap items-center justify-between gap-[var(--lv-space-3)] border-t border-[var(--lv-color-border)] px-[var(--lv-space-4)] py-[var(--lv-space-3)]">
    <div class="flex items-center gap-[var(--lv-space-2)]">
      <div data-admin-results-count aria-live="polite" class="text-[length:var(--lv-text-sm)] text-[var(--lv-color-muted-fg)]">
        @if(pagination.total() == 0)
          ${labels.noResults()}
        @else
          ${labels.resultsCount(pagination.firstShown(), pagination.lastShown(), pagination.total())}
        @endif
      </div>
      <%-- Filament fidelity: a loading indicator while a wire call is in flight (filter/sort/page/
           column change), Filament's fi-ta async spinner. l:loading shows it only during the call; the
           .delay debounces the flicker on a fast round-trip. Decorative spinner + an AT-only label. --%>
      <span data-admin-loading l:loading.delay style="display:none;"
            class="inline-flex items-center gap-[var(--lv-space-1)] text-[var(--lv-color-muted-fg)]">
        <span aria-hidden="true" class="inline-flex animate-spin">@template.lievit.icon(name = "loader-circle", size = "0.875rem")</span>
        <span class="sr-only">Loading…</span>
      </span>
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
        <%-- Derive baseUrl from the old printf pattern so the new pagination partial appends the
             page param itself. Strip "page=%d" WHEREVER it sits (not only trailing): a page-FIRST
             pattern like "/x?page=%d&a=1" must not leave a dangling "&a=1" with no leading "?" (that
             yielded a broken "/x&a=1?page=N" - 404 + lost filters - silently). So remove the first
             "[?&]page=%d", then if the leftover query now starts with "&" (the page param WAS first),
             swap that leading "&" to "?" so the query leader is valid for any param order. --%>
        !{var _rawPattern = table.pageHrefPattern();}
        !{var _stripped = _rawPattern.replaceFirst("[?&]page=%d", "");}
        !{var _pageBaseUrl = (!_stripped.contains("?") && _stripped.contains("&"))
            ? _stripped.replaceFirst("&", "?") : _stripped;}
        @template.lievit.pagination(currentPage = pagination.page(), totalPages = pagination.totalPages(),
          baseUrl = _rawPattern.isBlank() ? null : _pageBaseUrl)
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
