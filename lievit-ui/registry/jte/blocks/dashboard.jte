@import java.util.List
@import java.util.Map
@import gg.jte.Content
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui :: dashboard (BLOCK - a composition, not a component)

  The canonical analytics-dashboard PATTERN as a JTE block, mirroring shadcn's
  blocks/dashboard-01 content region (section-cards + chart + data-table). This is
  the MAIN-region CONTENT only: drop it into the app-shell block's content slot.
  It composes EXISTING lievit-ui pieces and ships NO hardcoded business data - every
  number, label, series and row arrives via @param, derived by the calling controller
  from real model data (planning two-tier model: blocks are compositions of the
  component tier).

  COMPOSES (existing pieces, nothing rebuilt):
    - stat cards     : server-rendered token-styled <section role="region"> surfaces
                       (the card visual built inline so the whole KPI row is one
                       SSR pass; the trend delta uses <lv-badge> + the Lucide icon
                       partial for the up/down arrow).
    - <lv-badge>     : the delta pill (variant success/danger/neutral), island.
    - @template.icon : the Lucide up/down arrow on each delta (never Font Awesome).
    - <lv-chart>     : the charts row (one or two), native-SVG island. Data is passed
                       as JSON-string attributes (Lit @property({type:Array}) parses
                       them); the controller serialises categories + series to JSON.
    - the table set  : @template.table.* (real <table>/<thead>/<th scope>/<tbody>)
                       for the recent-items section. Caller owns the row loop.

  A11Y (Radix / WAI-ARIA model):
    - each KPI is a <section role="region" aria-labelledby> announced by its label,
      grouped under a visually-hidden "Key metrics" heading so the row is navigable.
    - each chart card is a <section> with a real <h*> heading; <lv-chart> itself
      carries role="img" + aria-label + a visually-hidden data <table>.
    - the recent-items table is a real <table> with <th scope="col"> header cells and
      a <caption> as its accessible name.
    - section headings give the block a proper document outline.

  PARAMS (everything parameterised, the caller derives all data):
    String  title          h1/region title for the dashboard (e.g. "Overview").
    int     headingLevel   the heading rank for the SECTION titles (2 by default), so
                           the block nests correctly under the page's <h1>.
    List<Map<String,String>> stats   the KPI cards. Each map keys:
                             label    KPI name (the region's accessible name).
                             value    the big formatted value (e.g. "240.000 EUR").
                             delta    trend text (e.g. "+12,5%"); leading "-" => down.
                             trend    one-line footer headline (optional).
                             hint     muted sub-caption (optional).
                             icon     OPTIONAL explicit Lucide arrow name; when absent
                                      it is derived from delta's sign.
                             badge    OPTIONAL explicit lv-badge variant; when absent
                                      derived (down => danger, else success).
    String  chartTitle      heading for the primary chart card.
    String  chartType       "bar" | "line" | "area" (default "area").
    String  chartLabel      <lv-chart> accessible label (default = chartTitle).
    String  chartCategories JSON array string of x-axis labels, e.g. ["Jan","Feb"].
    String  chartSeries      JSON array string of {key,label,data[],color?} series.
    String  chart2Title      OPTIONAL second chart card heading; when null the second
                             chart is omitted and the first spans the full width.
    String  chart2Type       second chart kind (default "bar").
    String  chart2Categories JSON for the second chart.
    String  chart2Series     JSON for the second chart.
    String  rowsTitle        heading + <caption> for the recent-items table.
    List<String> rowColumns  the table header cells (in order).
    List<Map<String,String>> rows  the table rows; each map is column-key -> cell text,
                             read positionally against rowColumns by index "c0","c1"...
                             so the controller stays free of column names. A "state" key
                             of "selected" marks a highlighted row.
    gg.jte.Content actions   OPTIONAL toolbar slot rendered next to the title (filters,
                             a date range, an export button); null => no toolbar.

  Usage (controller serialises the data; nothing hardcoded here):
    @@template.blocks.dashboard(
      title = "Overview",
      stats = kpis,                              // List<Map<String,String>>
      chartTitle = "Listings closed",
      chartType = "area",
      chartCategories = categoriesJson,          // e.g. ["Gen","Feb","Mar",...]
      chartSeries = seriesJson,                  // [{"key":"closed","label":"Closed","data":[...]}]
      chart2Title = "Leads by source",
      chart2Type = "bar",
      chart2Categories = sourcesJson,
      chart2Series = leadsJson,
      rowsTitle = "Recent activity",
      rowColumns = List.of("Ref", "Agent", "Stage", "Value"),
      rows = recentRows
    )
--%>
@param String title = "Dashboard"
@param int headingLevel = 2
@param List<Map<String, String>> stats = java.util.List.of()
@param String chartTitle = "Trend"
@param String chartType = "area"
@param String chartLabel = null
@param String chartCategories = "[]"
@param String chartSeries = "[]"
@param String chart2Title = null
@param String chart2Type = "bar"
@param String chart2Categories = "[]"
@param String chart2Series = "[]"
@param String rowsTitle = "Recent items"
@param List<String> rowColumns = java.util.List.of()
@param List<Map<String, String>> rows = java.util.List.of()
@param gg.jte.Content actions = null

!{var hLevel = Math.min(Math.max(headingLevel, 2), 5);}
!{var subLevel = Math.min(hLevel + 1, 6);}
!{var hasSecondChart = chart2Title != null && !chart2Title.isBlank();}
!{var chartCols = hasSecondChart ? "lg:grid-cols-2" : "lg:grid-cols-1";}

<div
  class="lv-dashboard flex w-full flex-col gap-[var(--lv-space-6)]"
  style="font-family:var(--lv-font-sans);color:var(--lv-color-fg);"
  data-slot="dashboard"
>
  <%-- Title row + optional toolbar slot --%>
  <div class="flex flex-col gap-[var(--lv-space-2)] sm:flex-row sm:items-center sm:justify-between">
    <div role="heading" aria-level="${hLevel}" class="text-[length:var(--lv-text-2xl)] font-[var(--lv-font-semibold)] tracking-tight">
      ${title}
    </div>
    @if(actions != null)
      <div class="flex items-center gap-[var(--lv-space-2)]" data-slot="dashboard-toolbar">
        ${actions}
      </div>
    @endif
  </div>

  <%-- KPI / stat-cards row: each card a labelled region under a hidden group heading --%>
  <section aria-labelledby="lv-dashboard-kpis-title">
    <div role="heading" aria-level="${subLevel}" id="lv-dashboard-kpis-title" class="sr-only">Key metrics</div>
    <div class="grid grid-cols-1 gap-[var(--lv-space-4)] sm:grid-cols-2 lg:grid-cols-4">
      @for(var i = 0; i < stats.size(); i++)
        !{var stat = stats.get(i);}
        !{var label = stat.getOrDefault("label", "");}
        !{var value = stat.getOrDefault("value", "");}
        !{var delta = stat.getOrDefault("delta", "");}
        !{var isDown = delta != null && delta.startsWith("-");}
        !{var iconName = stat.containsKey("icon") ? stat.get("icon") : (isDown ? "arrow-down" : "arrow-up");}
        !{var badgeVariant = stat.containsKey("badge") ? stat.get("badge") : (isDown ? "danger" : "success");}
        !{var trend = stat.getOrDefault("trend", "");}
        !{var hint = stat.getOrDefault("hint", "");}
        !{var regionId = "lv-dashboard-kpi-" + i;}
        <section
          role="region"
          aria-labelledby="${regionId}"
          data-slot="dashboard-stat-card"
          class="flex flex-col gap-[var(--lv-space-3)] rounded-[var(--lv-radius-md)] border border-[var(--lv-color-border)] bg-[var(--lv-color-card)] p-[var(--lv-space-4)] text-[var(--lv-color-card-fg)] shadow-[var(--lv-shadow-xs)]"
        >
          <div class="flex items-start justify-between gap-[var(--lv-space-2)]">
            <span id="${regionId}" class="text-[length:var(--lv-text-sm)] text-[var(--lv-color-muted-fg)]">
              ${label}
            </span>
            @if(delta != null && !delta.isBlank())
              <lv-badge variant="${badgeVariant}">
                @template.icon(name = iconName, size = "var(--lv-text-sm)", cssClass = "shrink-0")
                <span>${delta}</span>
              </lv-badge>
            @endif
          </div>
          <span class="text-[length:var(--lv-text-3xl)] font-[var(--lv-font-semibold)] tabular-nums leading-none">
            ${value}
          </span>
          @if(trend != null && !trend.isBlank())
            <span class="flex items-center gap-[var(--lv-space-1)] text-[length:var(--lv-text-sm)] font-[var(--lv-font-medium)]">
              @template.icon(name = iconName, size = "var(--lv-text-sm)", cssClass = "shrink-0 text-[var(--lv-color-muted-fg)]")
              ${trend}
            </span>
          @endif
          @if(hint != null && !hint.isBlank())
            <span class="text-[length:var(--lv-text-sm)] text-[var(--lv-color-muted-fg)]">${hint}</span>
          @endif
        </section>
      @endfor
    </div>
  </section>

  <%-- Charts row: one or two <lv-chart> islands, data driven by JSON-string params --%>
  <section aria-labelledby="lv-dashboard-charts-title" class="flex flex-col gap-[var(--lv-space-4)]">
    <div role="heading" aria-level="${subLevel}" id="lv-dashboard-charts-title" class="sr-only">Charts</div>
    <div class="grid grid-cols-1 gap-[var(--lv-space-4)] ${chartCols}">
      <section
        aria-labelledby="lv-dashboard-chart-1-title"
        data-slot="dashboard-chart-card"
        class="flex flex-col gap-[var(--lv-space-4)] rounded-[var(--lv-radius-md)] border border-[var(--lv-color-border)] bg-[var(--lv-color-card)] p-[var(--lv-space-4)] text-[var(--lv-color-card-fg)] shadow-[var(--lv-shadow-xs)]"
      >
        <div role="heading" aria-level="${subLevel}" id="lv-dashboard-chart-1-title" class="text-[length:var(--lv-text-lg)] font-[var(--lv-font-semibold)]">
          ${chartTitle}
        </div>
        <lv-chart
          type="${chartType}"
          label="${chartLabel == null ? chartTitle : chartLabel}"
          categories="${chartCategories}"
          series="${chartSeries}"
        ></lv-chart>
      </section>

      @if(hasSecondChart)
        <section
          aria-labelledby="lv-dashboard-chart-2-title"
          data-slot="dashboard-chart-card"
          class="flex flex-col gap-[var(--lv-space-4)] rounded-[var(--lv-radius-md)] border border-[var(--lv-color-border)] bg-[var(--lv-color-card)] p-[var(--lv-space-4)] text-[var(--lv-color-card-fg)] shadow-[var(--lv-shadow-xs)]"
        >
          <div role="heading" aria-level="${subLevel}" id="lv-dashboard-chart-2-title" class="text-[length:var(--lv-text-lg)] font-[var(--lv-font-semibold)]">
            ${chart2Title}
          </div>
          <lv-chart
            type="${chart2Type}"
            label="${chart2Title}"
            categories="${chart2Categories}"
            series="${chart2Series}"
          ></lv-chart>
        </section>
      @endif
    </div>
  </section>

  <%-- Recent-items table: real <table> via the composable table partial set --%>
  <section
    aria-labelledby="lv-dashboard-rows-title"
    data-slot="dashboard-rows-card"
    class="flex flex-col gap-[var(--lv-space-4)] rounded-[var(--lv-radius-md)] border border-[var(--lv-color-border)] bg-[var(--lv-color-card)] p-[var(--lv-space-4)] text-[var(--lv-color-card-fg)] shadow-[var(--lv-shadow-xs)]"
  >
    <div role="heading" aria-level="${subLevel}" id="lv-dashboard-rows-title" class="text-[length:var(--lv-text-lg)] font-[var(--lv-font-semibold)]">
      ${rowsTitle}
    </div>
    @template.table(content = @`
      @template.table.caption(content = @`${rowsTitle}`)
      @template.table.header(content = @`
        @template.table.row(content = @`
          @for(String col : rowColumns)
            @template.table.head(content = @`${col}`)
          @endfor
        `)
      `)
      @template.table.body(content = @`
        @for(Map<String, String> row : rows)
          @template.table.row(state = row.getOrDefault("state", ""), content = @`
            @for(var c = 0; c < rowColumns.size(); c++)
              !{var cell = row.getOrDefault("c" + c, "");}
              @template.table.cell(content = @`${cell}`)
            @endfor
          `)
        @endfor
      `)
    `)
  </section>
</div>
