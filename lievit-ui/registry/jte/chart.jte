<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui chart partial -- a SERVER-rendered static chart as inline SVG (ADR-0012).
  The shapes, axis labels and accessible title are all emitted from typed @param data; there is
  NO JavaScript, NO <canvas>, NO client charting library. Replaces the dropped <lv-chart> Lit
  island, whose hover tooltip + lv-point event were the only client behaviour and are not shipped.

  TIER: PARTIAL (server-rendered SVG). A chart is a pure projection of a fixed dataset: given the
  values, the picture is fully determined server-side, so a client renderer added only the risk of
  the silent-projection bug (the exact class that motivated the pivot) for no decision the server
  could not make. The values arrive via @param from the controller's typed model and the partial
  emits declarative <svg> markup the browser draws with zero boot. INTERACTIVE charting (hover
  tooltips, zoom, live updates) is an ESCAPE-HATCH, not shipped: an adopter who truly needs it drops
  a typed-TS micro-enhancement over this SVG in their own frontend/src/ (the documented seam), the
  way gest keeps ht-calendar. lievit-ui ships no charting island.

  STRUCTURE (scientific decision rule): each chart `type` is the one geometry whose picture is a
  trivial server computation from the typed dataset -- bar: a <rect> per datum (height = value/max);
  line: a <polyline> through the points; area: that polyline closed to the baseline as a <polygon>;
  pie: one <path> arc per datum (angle = value/total). shadcn's chart guidance and the WAI-ARIA img
  role agree: a static data graphic is a single role="img" with a text alternative, NOT a widget. So
  the partial is one <svg role="img"> with an <title>/aria-label for the accessible name, one shape
  per data point coloured by the --lv-color-chart-N tokens (the same token cascade the island used),
  and -- for the cartesian types -- a baseline + per-datum category labels under the plot. The
  optional legend (chart/legend.jte, shadcn ChartLegendContent's data-slot="chart-legend") lists the
  series/slices with a token swatch. Native SVG beats a bundled lib on every axis here: a11y (the
  title is the text alternative a screen reader reads), zero dependency, and SSR-native declarative
  markup.

  A11y (WAI-ARIA img): the <svg> carries role="img" + aria-label (the chart's accessible name) and
  an in-SVG <title> as the first child (the SVG-native text alternative). Each shape (bar / point /
  slice) also carries an aria-label="<category>: <value>" so the individual data is reachable; the
  decorative axis text + legend swatches are aria-hidden so the value is not announced twice.

  Params:
    String   label                 accessible name for the whole chart (role=img aria-label + <title>).
    String[] categories            x-axis / slice labels, one per data point.
    int[]    values                data values, aligned positionally with categories.
    String   type     = "bar"      "bar" | "line" | "area" | "pie": which geometry to render.
    String   color    = "var(--lv-color-chart-1)"  fill/stroke for the single-series types (bar/line/area).
    String   seriesName = null     legend name for the single series (bar/line/area); defaults to `label`.
    int      width    = 600        SVG viewBox width.
    int      height   = 300        SVG viewBox height.
    boolean  showAxis = true       render the category labels under the plot (cartesian types only).
    boolean  showLegend = false    render the static legend (chart/legend.jte).
    String   cssClass = ""         extra utility classes on the <svg>.

  Usage:
    @@template.lievit.chart(label = "Listings closed", categories = months, values = closed)
    @@template.lievit.chart(label = "Leads", categories = sources, values = leads, type = "line", color = "var(--lv-color-chart-3)")
    @@template.lievit.chart(label = "Pipeline by stage", categories = stages, values = counts, type = "pie", showLegend = true)
--%>
@param String label
@param String[] categories
@param int[] values
@param String type = "bar"
@param String color = "var(--lv-color-chart-1)"
@param String seriesName = null
@param int width = 600
@param int height = 300
@param boolean showAxis = true
@param boolean showLegend = false
@param String cssClass = ""

!{
  boolean isPie = "pie".equals(type);
  boolean isLine = "line".equals(type);
  boolean isArea = "area".equals(type);
  // the five-step --lv-color-chart-N palette (pie cycles it per slice).
  String[] palette = {
    "var(--lv-color-chart-1)", "var(--lv-color-chart-2)", "var(--lv-color-chart-3)",
    "var(--lv-color-chart-4)", "var(--lv-color-chart-5)"
  };

  int padTop = 12;
  int padRight = 12;
  int padBottom = (showAxis && !isPie) ? 28 : 12;
  int padLeft = isPie ? 12 : 36;
  int plotW = width - padLeft - padRight;
  int plotH = height - padTop - padBottom;
  int n = Math.max(values.length, 1);
  double bandW = (double) plotW / n;
  double barW = bandW * 0.7;
  int max = 1;
  for (int v : values) if (v > max) max = v;
  int baseY = padTop + plotH;

  // cartesian point coordinates (line / area), one per datum at its band centre.
  String pointsAttr = "";
  if (isLine || isArea) {
    StringBuilder sb = new StringBuilder();
    for (int i = 0; i < values.length; i++) {
      int px = (int) Math.round(padLeft + bandW * i + bandW / 2.0);
      int py = (int) Math.round(baseY - plotH * ((double) values[i] / max));
      if (i > 0) sb.append(' ');
      sb.append(px).append(',').append(py);
    }
    pointsAttr = sb.toString();
  }
  // area closes the line back along the baseline.
  String areaPoints = "";
  if (isArea && values.length > 0) {
    int firstX = (int) Math.round(padLeft + bandW / 2.0);
    int lastX = (int) Math.round(padLeft + bandW * (values.length - 1) + bandW / 2.0);
    areaPoints = firstX + "," + baseY + " " + pointsAttr + " " + lastX + "," + baseY;
  }

  // pie geometry: total + per-slice arc path (SVG A command), centred.
  long total = 0;
  for (int v : values) total += Math.max(v, 0);
  if (total <= 0) total = 1;
  int cx = padLeft + plotW / 2;
  int cy = padTop + plotH / 2;
  int radius = Math.min(plotW, plotH) / 2;
}

<svg
  data-slot="chart"
  role="img"
  aria-label="${label}"
  viewBox="0 0 ${width} ${height}"
  preserveAspectRatio="xMidYMid meet"
  class="block h-auto w-full ${cssClass}"
  style="font-family:var(--lv-font-sans);overflow:visible;"
>
  <title>${label}</title>

  @if(isPie)
    !{double angle = -Math.PI / 2.0;}
    @for(int i = 0; i < values.length; i++)
      !{int v = Math.max(values[i], 0);}
      !{double frac = (double) v / total;}
      !{double start = angle;}
      !{double end = angle + frac * 2.0 * Math.PI;}
      !{angle = end;}
      !{int x1 = (int) Math.round(cx + radius * Math.cos(start));}
      !{int y1 = (int) Math.round(cy + radius * Math.sin(start));}
      !{int x2 = (int) Math.round(cx + radius * Math.cos(end));}
      !{int y2 = (int) Math.round(cy + radius * Math.sin(end));}
      !{int largeArc = (end - start) > Math.PI ? 1 : 0;}
      !{String slicePath = "M " + cx + " " + cy + " L " + x1 + " " + y1 + " A " + radius + " " + radius + " 0 " + largeArc + " 1 " + x2 + " " + y2 + " Z";}
      !{String fill = palette[i % palette.length];}
      !{String cat = i < categories.length ? categories[i] : String.valueOf(i);}
      <path
        data-slot="chart-slice"
        d="${slicePath}"
        fill="${fill}"
        stroke="var(--lv-color-bg)"
        stroke-width="1"
        aria-label="${cat}: ${v}"
      ></path>
    @endfor
  @else
    <%-- baseline (cartesian types) --%>
    <line x1="${padLeft}" y1="${baseY}" x2="${width - padRight}" y2="${baseY}" stroke="var(--lv-color-border)" stroke-width="1" />

    @if(isArea)
      <polygon
        data-slot="chart-area"
        points="${areaPoints}"
        fill="${color}"
        fill-opacity="0.2"
        stroke="none"
        aria-hidden="true"
      ></polygon>
    @endif
    @if(isLine || isArea)
      <polyline
        data-slot="chart-line"
        points="${pointsAttr}"
        fill="none"
        stroke="${color}"
        stroke-width="2"
        stroke-linejoin="round"
        stroke-linecap="round"
        aria-hidden="true"
      ></polyline>
    @endif

    @for(int i = 0; i < values.length; i++)
      !{int v = values[i];}
      !{double bandX = padLeft + bandW * i;}
      !{String cat = i < categories.length ? categories[i] : String.valueOf(i);}
      @if(isLine || isArea)
        !{int px = (int) Math.round(bandX + bandW / 2.0);}
        !{int py = (int) Math.round(baseY - plotH * ((double) v / max));}
        <circle
          data-slot="chart-point"
          cx="${px}" cy="${py}" r="3"
          fill="${color}"
          aria-label="${cat}: ${v}"
        ></circle>
      @else
        !{int x = (int) Math.round(bandX + (bandW - barW) / 2.0);}
        !{int barH = (int) Math.round(plotH * ((double) v / max));}
        !{int y = baseY - barH;}
        !{int bw = (int) Math.round(barW);}
        <rect
          data-slot="chart-bar"
          x="${x}" y="${y}" width="${Math.max(bw, 1)}" height="${Math.max(barH, 0)}"
          rx="2"
          fill="${color}"
          aria-label="${cat}: ${v}"
        ></rect>
      @endif
      @if(showAxis)
        !{int labelX = (int) Math.round(bandX + bandW / 2.0);}
        <text
          x="${labelX}" y="${height - 8}"
          text-anchor="middle"
          aria-hidden="true"
          fill="var(--lv-color-muted)"
          style="font-size:11px;"
        >${cat}</text>
      @endif
    @endfor
  @endif
</svg>

@if(showLegend)
  !{String single = (seriesName != null && !seriesName.isBlank()) ? seriesName : label;}
  @if(isPie)
    !{String[] sliceColors = new String[values.length];}
    !{for (int i = 0; i < values.length; i++) sliceColors[i] = palette[i % palette.length];}
    @template.lievit.chart.legend(names = categories, colors = sliceColors)
  @else
    @template.lievit.chart.legend(names = new String[]{single}, colors = new String[]{color})
  @endif
@endif
