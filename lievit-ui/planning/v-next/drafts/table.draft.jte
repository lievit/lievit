@import gg.jte.Content
@import gg.jte.output.StringOutput
@import gg.jte.html.escape.Escape
@import java.util.List
@import java.util.Map
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui table partial -- APG sortable data table with HTMX server swaps and optional
  bulk-select column. Server-rendered, server-sorted, server-paginated; zero client sort.

  TIER: PARTIAL presentational + HTMX pattern (ADR-0012, Wave 4). The table holds no client
  state: sort/page/filter are URL query-param facts that the server reads and re-renders.
  The one irreducible client bit -- maintaining the select-all checkbox indeterminate state
  as individual row checkboxes toggle -- is table-select.enhancer.ts (optional, CSP-clean,
  mounted only when selectable=true). This is the canonical HTMX-pattern example: a plain
  HTMX GET swap, not a wire call.

  STRUCTURE (scientific decision rule):
    - WAI-ARIA APG Table pattern (https://www.w3.org/WAI/ARIA/apg/patterns/table/)
      + APG Sortable Table example (https://www.w3.org/WAI/ARIA/apg/patterns/table/examples/sortable-table/).
      The APG is explicit: "Keyboard interaction: Not applicable" for the table role. Sortable
      column headers use native button inside th[scope=col]; the browser supplies Enter and Space
      for free. No custom keyboard enhancer needed -- the platform gives it.
    - Inventory reference: Ant Design Table (column config, sort, paginate, row actions, bulk-select)
      as feature-completeness reference. Virtual rows for 10k+ rows live in data-grid, NOT here.
    - Styling: ORIGINAL generation over --lv-* tokens; look inspired by Tailwind UI (no code copied).

  COLUMN DEFS -- each column is a Map[String,String] with these keys:
    id           -- unique column identifier (sort param value + data-col-id)
    header       -- column header label rendered in th
    sortable     -- "true" | "false" (default "false") -- wraps header in a sort button
    scope        -- "col" | "colgroup" | "row" | "rowgroup" (default "col")
    width        -- inline width on the col element, e.g. "120px" or "15%" (null = auto)
    align        -- "start" | "center" | "end" (default "start") -- td text-align
    numeric      -- "true" | "false" -- right-aligns + tabular-nums (shortcut for numeric cols)
    rowHeader    -- "true" | "false" -- renders body cells as th[scope=row] (row-header columns)
    hidden       -- "true" | "false" -- col visibility:collapse (stays in DOM for a11y math)
    valueKey     -- the row map key whose value is rendered as plain text in each cell

  ROW DATA -- each row is a Map[String,String] with:
    _id          -- the stable row identity written into data-row-id (required for selectable tables)
    ...fields    -- any key matching a column's valueKey renders as that cell's text content

  For custom cell rendering (badges, links, action buttons) use the cellTemplate param to pass
  a Content slot for a specific column's cells (keyed by column id via cellTemplates map param).

  A11y (WAI-ARIA APG table + sortable-table):
    - Native table/thead/tbody/tfoot/tr/th/td elements (implicit roles, no div-role substitutes).
    - caption or aria-label REQUIRED for the accessible name.
    - aria-sort="ascending|descending|none" on sortable th (NOT on the inner button).
    - Sort button accessible name = column header text; sort icon is aria-hidden.
    - aria-rowcount on table when paginated; aria-rowindex on each body tr.
    - aria-busy on table + wrapper when loading=true.
    - select-all checkbox: aria-label="Select all rows"; per-row: aria-label="Select row N".
    - aria-selected="true|false" on each body tr when selectable=true.
    - Loading announcer (role=status, aria-live=polite) OUTSIDE the table.
    - Empty state: single tr with td[colspan=N] spanning all columns.

  HTMX sort/paginate swap:
    1. User clicks a sort button -> GET htmxEndpoint with sort+dir params.
    2. Server re-renders this partial with updated rows/sortBy/sortDir/page.
    3. HTMX replaces htmxTarget (the div#table-region wrapper's innerHTML).
    4. The role=status announcer in the new fragment announces the result.

  ENHANCER -- table-select.enhancer.ts (NEW component-specific enhancer, not a shared one).
  Mounted via data-lievit-enhancer="table-select" on the table-region div when selectable=true.
  Manages: select-all indeterminate DOM property, aria-selected on tr, bulk-action bar visibility,
  selectedIds hidden input population before form submit, htmx:afterSwap reset.

  EXTRA ATTRIBUTES -- two channels, by trust (the XSS decision rule):
    attrs     (TRUSTED, raw) -- $unsafe, STATIC author-typed strings only. NEVER per-row DB values.
    dataAttrs (SAFE, escaped) -- Map[String,String] of dynamic data-*, each value via Escape.htmlAttribute.

  Params:
    List[Map[String,String]] columns     REQUIRED. Column definitions (see COLUMN DEFS above).
    List[Map[String,String]] rows        REQUIRED. Row records (see ROW DATA above).
    String caption            = null     Visible or sr-only caption (preferred accessible name).
    String ariaLabel          = null     aria-label when no caption; one of caption|ariaLabel REQUIRED.
    String ariaDescribedBy    = null     aria-describedby pointing to an external description id.
    String size               = "md"     "sm" | "md" | "lg" -- cell vertical padding.
    boolean bordered          = false    Outer border + inner cell borders.
    boolean striped           = false    Alternating row tint via --lv-color-surface.
    boolean hoverable         = true     Row hover highlight via --lv-color-accent.
    boolean stickyHeader      = false    position:sticky on thead (caller provides scroll-area).
    boolean loading           = false    Spinner overlay + aria-busy="true" on the region.
    Content empty             = null     Slot for empty-state row; defaults to simple text.
    boolean selectable        = false    Prepends a checkbox column for bulk selection.
    Content selectActionSlot  = null     Bulk-action toolbar rendered above table when selectable.
    String rowId              = "_id"    Row map key used as each row's stable identity.
    String sortParam          = "sort"   HTMX query-param name for the active sort column id.
    String directionParam     = "dir"    HTMX query-param name for sort direction.
    String sortBy             = null     Currently active sort column id (server state).
    String sortDir            = "asc"    Current sort direction: "asc" | "desc".
    String htmxTarget         = "#table-region"  CSS selector of the element HTMX replaces.
    String htmxEndpoint       = null     URL HTMX posts sort/page changes to. null = no HTMX wiring.
    String htmxSwap           = "innerHTML"  HTMX hx-swap strategy.
    int page                  = 1        Current page number (1-based).
    int pageSize              = 20       Rows per page.
    long totalRows            = -1       Total rows across all pages (-1 = unknown).
    boolean showPagination    = true     Renders pagination footer when totalRows > pageSize.
    String cssClass           = ""       Extra utility classes on the table element.
    String attrs              = ""       TRUSTED raw ($unsafe) -- STATIC author-typed strings only.
    Map[String,String] dataAttrs = {}    SAFE dynamic data-* (values via Escape.htmlAttribute).

  Usage:
    @@template.lievit.table(
      columns = java.util.List.of(
        java.util.Map.of("id","name","header","Name","sortable","true","valueKey","name"),
        java.util.Map.of("id","price","header","Price","numeric","true","valueKey","price")),
      rows = java.util.List.of(
        java.util.Map.of("_id","1","name","Cecchetto","price","240000")),
      caption = "Q2 Listings",
      sortBy = "name", sortDir = "asc",
      htmxEndpoint = "/listings/table")

    @@template.lievit.table(
      columns = columns, rows = rows,
      ariaLabel = "Users", selectable = true,
      htmxEndpoint = "/admin/users/table",
      selectActionSlot = @@`...bulk actions...`)
--%>
@param java.util.List<java.util.Map<String, String>> columns
@param java.util.List<java.util.Map<String, String>> rows
@param String caption = null
@param String ariaLabel = null
@param String ariaDescribedBy = null
@param String size = "md"
@param boolean bordered = false
@param boolean striped = false
@param boolean hoverable = true
@param boolean stickyHeader = false
@param boolean loading = false
@param gg.jte.Content empty = null
@param boolean selectable = false
@param gg.jte.Content selectActionSlot = null
@param String rowId = "_id"
@param String sortParam = "sort"
@param String directionParam = "dir"
@param String sortBy = null
@param String sortDir = "asc"
@param String htmxTarget = "#table-region"
@param String htmxEndpoint = null
@param String htmxSwap = "innerHTML"
@param int page = 1
@param int pageSize = 20
@param long totalRows = -1
@param boolean showPagination = true
@param String cssClass = ""
@param String attrs = ""
@param java.util.Map<String, String> dataAttrs = java.util.Map.of()

<%-- Derived: total column count (used for colspan on empty/pagination cells). --%>
!{var _colCount = columns.size() + (selectable ? 1 : 0);}

<%-- Derived: cell vertical padding token per size. --%>
!{var _cellPy = switch (size) {
    case "sm" -> "var(--lv-space-2)";
    case "lg" -> "var(--lv-space-4)";
    default   -> "var(--lv-space-3)";
  };}
!{var _cellFont = "sm".equals(size) ? "var(--lv-text-sm)" : "var(--lv-text-base)";}

<%-- Derived: border style for bordered mode. --%>
!{var _borderedStyle = bordered
    ? "border:1px solid var(--lv-color-border);border-collapse:collapse;"
    : "border-collapse:collapse;";}

<%-- Derived: sticky header styles. --%>
!{var _theadStyle = stickyHeader
    ? "position:sticky;top:0;z-index:var(--lv-z-sticky);background:var(--lv-color-bg);box-shadow:0 1px 0 0 var(--lv-color-border);"
    : "";}

<%-- Derived: aria-rowcount emitted only when totalRows is known. --%>
!{var _ariaRowcount = totalRows > 0 ? String.valueOf(totalRows) : null;}

<%-- Derived: whether caption is visually hidden (ariaLabel provided, no caption text). --%>
!{var _captionText = (caption != null && !caption.isBlank()) ? caption : ariaLabel;}
!{var _captionSrOnly = (caption == null || caption.isBlank());}

<%-- Derived: aria-label on table -- present only when no visible caption. --%>
!{var _tableAriaLabel = (caption == null || caption.isBlank()) ? ariaLabel : null;}

<%-- SAFE dynamic data-* attributes fragment (mirrors badge.jte exactly). --%>
!{var _dataAttrs_ = new StringOutput();}
!{for (var e : dataAttrs.entrySet()) {
    if (e.getKey() != null && e.getKey().matches("[A-Za-z][A-Za-z0-9-]*")) {
      _dataAttrs_.writeContent(" data-" + e.getKey() + "=\"");
      Escape.htmlAttribute(e.getValue() == null ? "" : e.getValue(), _dataAttrs_);
      _dataAttrs_.writeContent("\"");
    }
  }}
!{var _dataAttrsMarkup = _dataAttrs_.toString();}

<div
  id="table-region"
  data-slot="table-region"
  aria-busy="${loading ? "true" : null}"
  data-lievit-enhancer="${selectable ? "table-select" : null}"
  data-bordered="${bordered ? "true" : null}"
  data-striped="${striped ? "true" : null}"
  data-hoverable="${hoverable ? "true" : null}"
>
  <%-- Loading status announcer (outside table, so screen readers do not read it as a cell). --%>
  <div
    role="status"
    aria-live="polite"
    aria-atomic="true"
    aria-label="${loading ? "Loading" : null}"
    data-slot="table-announcer"
    style="position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;"
  >${loading ? "Loading" : ""}</div>

  <%-- Optional bulk-action bar (selectable only; shown/hidden by the enhancer). --%>
  @if(selectable && selectActionSlot != null)
    <div
      data-bulk-action-bar
      data-slot="table-bulk-action-bar"
      class="hidden"
      style="display:none;margin-bottom:var(--lv-space-3);"
    >${selectActionSlot}</div>
  @endif

  <%-- Horizontal scroll wrapper (the caller provides a scroll-area if stickyHeader). --%>
  <div
    data-slot="table-scroll"
    style="width:100%;overflow-x:auto;"
  >
    <table
      data-slot="table"
      data-size="${size}"
      aria-label="${_tableAriaLabel}"
      aria-describedby="${ariaDescribedBy}"
      aria-rowcount="${_ariaRowcount}"
      aria-busy="${loading ? "true" : null}"
      style="width:100%;caption-side:bottom;font-family:var(--lv-font-sans);color:var(--lv-color-fg);${_borderedStyle}"
      class="${cssClass}"
      $unsafe{_dataAttrsMarkup}
      $unsafe{attrs}
    >
      <%-- Caption: the preferred accessible name mechanism. sr-only when no visible caption. --%>
      @if(_captionText != null && !_captionText.isBlank())
        <caption
          data-slot="table-caption"
          style="font-size:var(--lv-text-sm);color:var(--lv-color-muted);padding-top:var(--lv-space-2);${_captionSrOnly ? "position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;" : ""}"
        >${_captionText}</caption>
      @endif

      <%-- Column group: drives width + visibility:collapse for hidden columns. --%>
      <colgroup>
        @if(selectable)
          <col style="width:var(--lv-space-10);">
        @endif
        @for(var col : columns)
          !{var _colWidth = col.getOrDefault("width", "");}
          !{var _colHidden = "true".equals(col.get("hidden"));}
          <col
            data-col-id="${col.get("id")}"
            style="${!_colWidth.isBlank() ? "width:" + _colWidth + ";" : ""}${_colHidden ? "visibility:collapse;" : ""}"
          >
        @endfor
      </colgroup>

      <%-- thead: select-all checkbox column + column header cells. --%>
      <thead
        data-slot="table-head"
        style="${_theadStyle}background:${stickyHeader ? "var(--lv-color-bg)" : "color-mix(in srgb, var(--lv-color-surface) 35%, var(--lv-color-bg))"};"
      >
        <tr data-slot="table-header-row">
          @if(selectable)
            <th
              scope="col"
              data-slot="table-select-head"
              style="width:var(--lv-space-10);padding:${_cellPy} var(--lv-space-4);text-align:left;vertical-align:middle;font-size:var(--lv-text-xs);color:var(--lv-color-muted);${bordered ? "border:1px solid var(--lv-color-border);" : "border-bottom:1px solid var(--lv-color-border);"}"
            >
              <input
                type="checkbox"
                data-select-all
                aria-label="Select all rows"
                style="width:var(--lv-space-4);height:var(--lv-space-4);border-radius:var(--lv-radius-sm);border:1px solid var(--lv-color-input);accent-color:var(--lv-color-primary);cursor:pointer;"
                class="focus-visible:shadow-[var(--lv-ring)]"
              >
            </th>
          @endif
          @for(var col : columns)
            !{var _colId = col.getOrDefault("id", "");}
            !{var _colHeader = col.getOrDefault("header", "");}
            !{var _isSortable = "true".equals(col.get("sortable"));}
            !{var _scope = col.getOrDefault("scope", "col");}
            !{var _colHiddenHead = "true".equals(col.get("hidden"));}
            !{var _isActive = _colId.equals(sortBy);}
            !{var _ariaSort = _isSortable ? (_isActive ? ("asc".equals(sortDir) ? "ascending" : "descending") : "none") : null;}
            !{var _nextDir = (_isActive && "asc".equals(sortDir)) ? "desc" : "asc";}
            !{var _thStyle = "padding:" + _cellPy + " var(--lv-space-4);text-align:left;vertical-align:middle;font-size:var(--lv-text-xs);font-weight:var(--lv-font-semibold);color:var(--lv-color-muted);letter-spacing:0.025em;white-space:nowrap;" + (bordered ? "border:1px solid var(--lv-color-border);" : "border-bottom:1px solid var(--lv-color-border);");}
            <th
              scope="${_scope}"
              data-slot="table-col-head"
              data-col-id="${_colId}"
              aria-sort="${_ariaSort}"
              style="${_colHiddenHead ? "visibility:hidden;" : ""}${_thStyle}"
            >
              @if(_isSortable && htmxEndpoint != null)
                <button
                  type="button"
                  id="sort-${_colId}"
                  hx-get="${htmxEndpoint}"
                  hx-target="${htmxTarget}"
                  hx-swap="${htmxSwap}"
                  hx-vals='{"${sortParam}":"${_colId}","${directionParam}":"${_nextDir}"}'
                  hx-include="[name='page'],[name='pageSize']"
                  style="display:inline-flex;align-items:center;gap:var(--lv-space-1);background:transparent;border:0;padding:0;cursor:pointer;font:inherit;color:${_isActive ? "var(--lv-color-primary)" : "inherit"};font-size:var(--lv-text-xs);font-weight:var(--lv-font-semibold);letter-spacing:0.025em;border-radius:var(--lv-radius-sm);outline:none;"
                  class="focus-visible:shadow-[var(--lv-ring)]"
                >${_colHeader}<span aria-hidden="true" style="display:inline-flex;align-items:center;color:${_isActive ? "var(--lv-color-primary)" : "var(--lv-color-muted)"}">${_isActive ? ("asc".equals(sortDir) ? "&#9650;" : "&#9660;") : "&#8645;"}</span></button>
              @else
                ${_colHeader}
              @endif
            </th>
          @endfor
        </tr>
      </thead>

      <%-- tbody: empty state or data rows. --%>
      <tbody data-slot="table-body">
        @if(rows.isEmpty())
          <tr data-slot="table-empty-row">
            <td
              colspan="${_colCount}"
              data-slot="table-empty-cell"
              style="padding:var(--lv-space-8) var(--lv-space-4);text-align:center;color:var(--lv-color-muted);font-size:var(--lv-text-sm);${bordered ? "border:1px solid var(--lv-color-border);" : "border-bottom:1px solid var(--lv-color-border);"}"
            >@if(empty != null)${empty}@else<span>No data.</span>@endif</td>
          </tr>
        @else
          !{var _rowIdx_ = new int[]{0};}
          @for(var row : rows)
            !{var _rowNum = _rowIdx_[0] + 1 + (page - 1) * pageSize;}
            !{_rowIdx_[0]++;}
            !{var _rid_ = new StringOutput();}
            !{Escape.htmlAttribute(row.getOrDefault(rowId, ""), _rid_);}
            !{var _ridVal = _rid_.toString();}
            !{var _ariaRowindex = totalRows > 0 ? String.valueOf(_rowNum) : null;}
            !{var _trStyle = "border-bottom:1px solid var(--lv-color-border);" + (bordered ? "border:1px solid var(--lv-color-border);" : "") + (striped && (_rowIdx_[0] % 2 == 0) ? "background:color-mix(in srgb, var(--lv-color-surface) 40%, var(--lv-color-bg));" : "") + (hoverable ? "" : "");}
            <tr
              data-slot="table-row"
              data-row-id="${_ridVal}"
              aria-selected="${selectable ? "false" : null}"
              aria-rowindex="${_ariaRowindex}"
              style="${_trStyle}"
              class="${hoverable ? "hover:[&[data-slot=table-row]]:bg-[var(--lv-color-accent)]" : ""}"
            >
              @if(selectable)
                <td
                  data-slot="table-select-cell"
                  style="padding:${_cellPy} var(--lv-space-4);vertical-align:middle;width:var(--lv-space-10);"
                >
                  <input
                    type="checkbox"
                    data-select-row
                    aria-label="Select row ${_rowNum}"
                    style="width:var(--lv-space-4);height:var(--lv-space-4);border-radius:var(--lv-radius-sm);border:1px solid var(--lv-color-input);accent-color:var(--lv-color-primary);cursor:pointer;"
                    class="focus-visible:shadow-[var(--lv-ring)]"
                  >
                </td>
              @endif
              @for(var col : columns)
                !{var _cid = col.getOrDefault("id", "");}
                !{var _vk = col.get("valueKey");}
                !{var _cellVal = (_vk != null) ? row.getOrDefault(_vk, "") : "";}
                !{var _isNumeric = "true".equals(col.get("numeric"));}
                !{var _isRowHeader = "true".equals(col.get("rowHeader"));}
                !{var _colAlign = col.getOrDefault("align", "start");}
                !{var _cellTextAlign = "end".equals(_colAlign) ? "right" : ("center".equals(_colAlign) ? "center" : "left");}
                !{var _cellFont2 = _isNumeric ? "var(--lv-font-mono)" : "var(--lv-font-sans)";}
                !{var _cellStyle = "padding:" + _cellPy + " var(--lv-space-4);vertical-align:middle;font-size:" + _cellFont + ";text-align:" + _cellTextAlign + ";font-family:" + _cellFont2 + ";" + (_isNumeric ? "font-variant-numeric:tabular-nums;" : "") + (bordered ? "border:1px solid var(--lv-color-border);" : "") + ("true".equals(col.get("hidden")) ? "visibility:hidden;" : "");}
                @if(_isRowHeader)
                  <th
                    scope="row"
                    data-slot="table-row-head"
                    data-col-id="${_cid}"
                    style="${_cellStyle}font-weight:var(--lv-font-medium);"
                  >${_cellVal}</th>
                @else
                  <td
                    data-slot="table-cell"
                    data-col-id="${_cid}"
                    style="${_cellStyle}"
                  >${_cellVal}</td>
                @endif
              @endfor
            </tr>
          @endfor
        @endif
      </tbody>

      <%-- tfoot: pagination region (rendered when showPagination=true and needed). --%>
      @if(showPagination && totalRows > 0 && totalRows > pageSize)
        <tfoot data-slot="table-foot">
          <tr>
            <td
              colspan="${_colCount}"
              style="padding:var(--lv-space-3) var(--lv-space-4);border-top:1px solid var(--lv-color-border);"
            >
              @template.lievit.pagination(
                currentPage = page,
                totalPages = (int)Math.ceil((double)totalRows / pageSize),
                baseUrl = htmxEndpoint != null ? htmxEndpoint : "#")
            </td>
          </tr>
        </tfoot>
      @endif
    </table>
  </div>
</div>
