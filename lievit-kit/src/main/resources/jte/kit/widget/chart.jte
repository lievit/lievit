@import io.lievit.kit.ChartWidget
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-kit :: kit.widget.chart - renders ONE io.lievit.kit.ChartWidget as a section card (heading +
  description + an optional filter dropdown in the after-header) wrapping the lievit-ui chart, the
  SERVER-pure SVG (ADR-0012). This is the chart twin of kit.widget.stat: the canonical place a kit
  ChartWidget paints onto the lievit-ui presentational chart, server-first with NO chart.js canvas
  and NO inline script (the Filament chart.js island is deliberately not shipped; the SVG is fully
  determined server-side from the typed dataset).

  The ChartWidget carries: type() (BAR|LINE|PIE|DOUGHNUT|POLAR_AREA|RADAR|SCATTER|BUBBLE), data() (a
  ChartData = labels + List<Dataset>, each Dataset a label + List<Number> values), heading(),
  description(), maxHeight(), color() (io.lievit.kit.Color), filters() (value->label) + activeFilter(),
  isCollapsible(), pollingInterval(), dataChecksum().

  The mapping onto lievit-ui chart (a SINGLE-series SVG partial):
    type()       -> the chart `type`: BAR -> bar, LINE -> line, AREA-like is not a kit type; PIE /
                    DOUGHNUT / POLAR_AREA -> pie (the SVG partial draws a pie geometry, the closest
                    server-pure projection of a circular chart); the remaining cartesian types
                    (RADAR / SCATTER / BUBBLE) fall back to bar (no server-pure SVG geometry ships
                    for them yet -- a lievit-ui gap, see the report).
    data().labels()             -> categories (the x-axis / slice labels)
    data().datasets().get(0)    -> the rendered single series (values + legend name); the SVG chart is
                                   single-series, so a multi-dataset ChartWidget renders its FIRST
                                   dataset (the lievit-ui chart gap for grouped/stacked series).
    color()      -> the series fill/stroke, mapped to a --lv-color-* token (never a hex)
    maxHeight()  -> a max-height cap on the chart wrapper

  The filter dropdown (Filament's after-header filter select) lists filters() as menu items, marking
  activeFilter() checked. The model carries no per-filter href, so the items are rendered as labelled
  entries the host wires (a GET link or l:click) by copying this template; out of the box they are
  inert menu rows that show the available filters and the active one.

  Server-first, token-driven, strict-CSP clean. Params: chart - the ChartWidget to render.
--%>
@param ChartWidget chart
!{var data = chart.data();}
!{var hasSeries = !data.datasets().isEmpty();}
!{var series = hasSeries ? data.datasets().get(0) : new ChartWidget.Dataset("", java.util.List.of());}
!{String chartType = switch (chart.type()) {
    case LINE -> "line";
    case PIE, DOUGHNUT, POLAR_AREA -> "pie";
    default -> "bar";
  };}
!{String[] categories = data.labels().toArray(new String[0]);}
!{int[] values = new int[series.values().size()];}
!{for (int i = 0; i < values.length; i++) values[i] = series.values().get(i).intValue();}
!{String tint = chart.color().map(c -> "var(--lv-color-" + c.name() + ")").orElse("var(--lv-color-chart-1)");}
!{String seriesName = series.label().isBlank() ? chart.heading().orElse("Series") : series.label();}
!{boolean isPie = "pie".equals(chartType);}
!{String wrapperStyle = chart.maxHeight().map(h -> "max-height:" + h + "px;").orElse("");}
<div
  data-slot="kit-widget-chart"
  data-checksum="${chart.dataChecksum()}"
  class="flex flex-col gap-[var(--lv-space-3)] rounded-[var(--lv-radius-xl)] border border-[var(--lv-color-border)] bg-[var(--lv-color-card)] p-[var(--lv-space-6)] text-[var(--lv-color-card-fg)] shadow-[var(--lv-shadow-xs)]"
  style="font-family:var(--lv-font-sans);"
>
  @if(chart.heading().isPresent() || !chart.filters().isEmpty())
    <div data-slot="kit-widget-chart-header" class="flex items-start justify-between gap-[var(--lv-space-2)]">
      <div class="flex flex-col gap-[var(--lv-space-1)]">
        @if(chart.heading().isPresent())
          <h3 data-slot="kit-widget-chart-heading" class="text-[length:var(--lv-text-sm)] font-[var(--lv-font-semibold)] text-[var(--lv-color-card-fg)]">${chart.heading().get()}</h3>
        @endif
        @if(chart.description().isPresent())
          <p data-slot="kit-widget-chart-description" class="text-[length:var(--lv-text-sm)] text-[var(--lv-color-muted-fg)]">${chart.description().get()}</p>
        @endif
      </div>
      @if(!chart.filters().isEmpty())
        @template.lievit.dropdown-menu(
          id = "kit-chart-filter",
          trigger = @`
            @template.lievit.icon(name = "sliders-horizontal", size = "1rem")
            <span>${chart.activeFilter().map(v -> chart.filters().getOrDefault(v, v)).orElse("All")}</span>
          `,
          content = @`
            @for(var entry : chart.filters().entrySet())
              @template.lievit.dropdown-menu.item(
                label = entry.getValue(),
                type = "checkbox",
                checked = chart.activeFilter().map(a -> a.equals(entry.getKey())).orElse(false))
            @endfor
          `)
      @endif
    </div>
  @endif

  <div data-slot="kit-widget-chart-canvas" class="w-full overflow-hidden" style="${wrapperStyle}">
    @if(values.length == 0)
      @template.lievit.empty(title = "No data", description = "This chart has no data yet.", icon = "bar-chart-2")
    @else
      @template.lievit.chart(
        label = chart.heading().orElse("Chart"),
        categories = categories,
        values = values,
        type = chartType,
        color = tint,
        seriesName = seriesName,
        showAxis = !isPie,
        showLegend = isPie)
    @endif
  </div>
</div>
