<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui :: chart.legend - a SERVER-rendered static legend for the chart partial.

  The shadcn-faithful equivalent of ChartLegendContent (data-slot="chart-legend"): one entry per
  series, each a coloured swatch + the series name. Here the entries are typed @param data, the
  swatch is a token-coloured square, and there is zero JS (no client legend, no toggle handlers).
  Single-series charts (bar / line / area) pass one name + one colour; the pie passes one entry per
  slice (the slice name + its --lv-color-chart-N token), so the legend is the slice key.

  A11y: the legend is decorative chrome over the chart's own role=img text alternative (every datum
  is already announced via the per-shape aria-label), so the swatches are aria-hidden and the list
  is a plain inline <ul>; the names stay readable text. It adds visual key, never a second source of
  the data to a screen reader.

  Params:
    String[] names    series / slice names, one per entry.
    String[] colors   fill per entry, aligned positionally with names (each a --lv-color-* token).
    String   cssClass = ""  extra utility classes on the legend.

  Usage:
    @@template.lievit.chart.legend(names = labels, colors = palette)
--%>
@param String[] names
@param String[] colors
@param String cssClass = ""

<ul
  data-slot="chart-legend"
  class="flex flex-wrap items-center justify-center gap-x-[var(--lv-space-4)] gap-y-[var(--lv-space-1)] pt-[var(--lv-space-3)] text-[length:var(--lv-text-sm)] text-[var(--lv-color-muted-fg)] ${cssClass}"
  style="font-family:var(--lv-font-sans);list-style:none;margin:0;padding-left:0;"
>
  @for(int i = 0; i < names.length; i++)
    !{String swatch = i < colors.length ? colors[i] : "var(--lv-color-chart-1)";}
    <li data-slot="chart-legend-item" class="inline-flex items-center gap-[var(--lv-space-1)]">
      <span
        data-slot="chart-legend-swatch"
        aria-hidden="true"
        class="inline-block h-[var(--lv-space-2)] w-[var(--lv-space-2)] shrink-0 rounded-[var(--lv-radius-sm)]"
        style="background:${swatch};"
      ></span>
      ${names[i]}
    </li>
  @endfor
</ul>
