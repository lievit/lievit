@import java.util.List
@import java.util.Map
@import gg.jte.Content
@import gg.jte.output.StringOutput
@import gg.jte.html.escape.Escape
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui chart partial -- SERVER-rendered interactive-capable chart (v-next re-forge).

  TIER: PARTIAL (server-rendered SVG). The shapes, axis labels, legend and accessible title are
  all emitted from typed @param data with zero JavaScript required. When interactive=true the
  chart.enhancer.ts colocated enhancer is discovered via data-lievit-enhancer="chart" and wires
  tooltip show/hide, keyboard navigation, series highlight, zoom/pan and the lv-chart-mark-click
  custom event. When interactive=false (default) zero JS runs.

  CLEAN BREAK (v-next): this re-forge replaces the old primitive entirely.
  API delta vs v1: `label` param renamed to `title` (required); legacy `categories`/`values`
  single-series params kept for graduated migration; `showTable` default changed to true.
  Consumers of the OLD API (`label = ...`): dashboard block must migrate
  `label = expr` to `title = expr`.

  STRUCTURE: chart type is selected by the `type` param:
    bar     -- rect per datum (height = value/max)
    line    -- polyline through points + circle data-marks
    area    -- polygon fill closed to baseline + polyline + circle data-marks
    pie     -- arc path per slice
    donut   -- arc with innerRadius hole
    composed -- multi-type per series via seriesType override

  JTE INVARIANT: every SVG void element (rect, circle, line, path, polyline, polygon, stop,
  use, ellipse) MUST be self-closed with />. JTE 3 does not treat SVG elements as void HTML.
  An unclosed element consumes the </svg> and yields "Unclosed tag <svg>".

  A11y (WAI-ARIA img + table fallback): the SVG carries role="img" + aria-labelledby pointing
  to the in-SVG title element. When showTable=true an sr-only table provides all data in linear
  format for assistive technology. Each interactive mark carries role="img" + aria-label +
  tabindex="0". Decorative chrome (axes, grid, legend swatches) is aria-hidden.

  ID management: unique IDs derived from title hash so multiple charts on one page do not clash.

  MULTI-SERIES: series is a List of Map of String to String. Each map has:
    name       -- series display name (legend, aria-label)
    color      -- optional CSS token reference (defaults to palette[i])
    seriesType -- optional per-series type override for COMPOSED charts
    values     -- comma-separated y-values as strings, e.g. "10,25,30,15"

  EXTRA ATTRIBUTES -- two channels, by trust:
    attrs (TRUSTED, raw) -- $unsafe, STATIC author-typed strings only (wire directives, data-testid).
    dataAttrs (SAFE, escaped) -- Map of String to String of dynamic data-* attributes, each value
    escaped via Escape.htmlAttribute.

  Params:
    String title                   accessible name + in-SVG title + optional visible heading. REQUIRED.
    boolean showTitle    = false   render a visible h3 above the SVG (uses title text).
    String description   = null    optional in-SVG desc element (longer text alternative).
    String type          = "bar"   "bar" | "line" | "area" | "pie" | "donut" | "composed"
    String[] xLabels     = {}      x-axis / slice labels, one per data point.
    List of Map of String to String series = List.of()
                                   multi-series data (see above). When empty, falls back to
                                   legacy categories+values single-series params.
    String[] categories  = {}      LEGACY single-series x-labels (alias for xLabels).
    int[] values         = {}      LEGACY single-series values.
    String color         = "var(--lv-color-chart-1)"  single-series fill/stroke token.
    String seriesName    = null    legend label for the single series; defaults to title.
    int height           = 300     SVG logical height in user units.
    boolean showAxis     = true    render x-axis category labels (cartesian types).
    boolean showLegend   = false   render the static legend (chart/legend.jte).
    boolean showTable    = true    render an sr-only accessible data table.
    String tableCaption  = null    caption for the accessible table; defaults to title.
    boolean interactive  = false   wire the chart.enhancer (tooltip, keyboard, zoom).
    boolean loading      = false   loading state: aria-busy + shimmer skeleton.
    String emptyText     = "No data"  message when series is empty or all-zero.
    List of String referenceLines = List.of()
                                   pipe-separated reference line specs: "value|axis|label|dashed"
    boolean zoomable     = false   enable brush-zoom in the enhancer (interactive must be true).
    String cssClass      = ""      extra utility classes on the figure root.
    String attrs         = ""      TRUSTED raw ($unsafe) -- STATIC author-typed strings only.
    Map of String to String dataAttrs = Map.of()
                                   SAFE dynamic data-* (value escaped via Escape.htmlAttribute).

  Usage:
    @@template.lievit.chart(title = "Listings closed", xLabels = months, series = seriesList)
    @@template.lievit.chart(title = "Leads", categories = sources, values = leads, type = "line")
    @@template.lievit.chart(title = "Pipeline", categories = stages, values = counts, type = "pie", showLegend = true)
    @@template.lievit.chart(title = "Live data", series = multiSeries, type = "bar", interactive = true)
--%>
@param String title
@param boolean showTitle = false
@param String description = null
@param String type = "bar"
@param String[] xLabels = new String[0]
@param java.util.List<java.util.Map<String, String>> series = java.util.List.of()
@param String[] categories = new String[0]
@param int[] values = new int[0]
@param String color = "var(--lv-color-chart-1)"
@param String seriesName = null
@param int height = 300
@param boolean showAxis = true
@param boolean showLegend = false
@param boolean showTable = true
@param String tableCaption = null
@param boolean interactive = false
@param boolean loading = false
@param String emptyText = "No data"
@param java.util.List<String> referenceLines = java.util.List.of()
@param boolean zoomable = false
@param String cssClass = ""
@param String attrs = ""
@param java.util.Map<String, String> dataAttrs = java.util.Map.of()

<%-- Unique ID derivation from title --%>
!{var _chartId = "lv-chart-" + Math.abs(title.hashCode());}
!{var _svgTitleId = _chartId + "-title";}
!{var _svgDescId = _chartId + "-desc";}
!{var _tooltipId = _chartId + "-tooltip";}

<%-- Chart type flags --%>
!{boolean isPie    = "pie".equals(type);}
!{boolean isDonut  = "donut".equals(type);}
!{boolean isPielike = isPie || isDonut;}
!{boolean isLine   = "line".equals(type);}
!{boolean isArea   = "area".equals(type);}
!{boolean isBar    = "bar".equals(type);}
!{boolean isComposed = "composed".equals(type);}

<%-- Resolve effective x-labels: xLabels wins over categories --%>
!{String[] effectiveLabels = (xLabels != null && xLabels.length > 0) ? xLabels : (categories != null ? categories : new String[0]);}

<%-- Palette: --lv-color-chart-1..5 tokens (spec chart-color tokens pending coordinator) --%>
!{String[] palette = {
    "var(--lv-color-chart-1)", "var(--lv-color-chart-2)", "var(--lv-color-chart-3)",
    "var(--lv-color-chart-4)", "var(--lv-color-chart-5)"
  };}

<%-- Build effective series list from either the multi-series param or legacy single-series --%>
!{java.util.List<java.util.Map<String, String>> effectiveSeries;}
!{if (series != null && !series.isEmpty()) {
    effectiveSeries = series;
  } else {
    String sName = (seriesName != null && !seriesName.isBlank()) ? seriesName : title;
    StringBuilder sbv = new StringBuilder();
    if (values != null) {
      for (int i = 0; i < values.length; i++) {
        if (i > 0) sbv.append(',');
        sbv.append(values[i]);
      }
    }
    java.util.Map<String, String> singleMap = new java.util.LinkedHashMap<>();
    singleMap.put("name", sName);
    singleMap.put("color", color);
    singleMap.put("values", sbv.toString());
    effectiveSeries = java.util.List.of(singleMap);
  }}

<%-- Parse each series' values into double arrays --%>
!{int seriesCount = effectiveSeries.size();}
!{double[][] seriesData = new double[seriesCount][];}
!{for (int s = 0; s < seriesCount; s++) {
    String rawVals = effectiveSeries.get(s).getOrDefault("values", "");
    if (rawVals.isBlank()) {
      seriesData[s] = new double[0];
    } else {
      String[] parts = rawVals.split(",");
      double[] arr = new double[parts.length];
      for (int i = 0; i < parts.length; i++) {
        try { arr[i] = Double.parseDouble(parts[i].trim()); } catch (NumberFormatException e) { arr[i] = 0; }
      }
      seriesData[s] = arr;
    }
  }}

<%-- Number of x-axis points: max across all series --%>
!{int n = 0;}
!{for (double[] sd : seriesData) if (sd.length > n) n = sd.length;}
!{if (n == 0) n = 1;}

<%-- Global max value (for scale) across all series --%>
!{double globalMax = 1.0;}
!{for (double[] sd : seriesData) for (double v : sd) if (v > globalMax) globalMax = v;}

<%-- Check empty state --%>
!{boolean isEmpty = true;}
!{for (int s = 0; s < seriesCount; s++) {
    for (double v : seriesData[s]) {
      if (v > 0) { isEmpty = false; break; }
    }
  }}

<%-- Layout geometry (logical SVG 1000 wide) --%>
!{int logWidth = 1000;}
!{int padTop = 16;}
!{int padRight = 16;}
!{int padBottom = (showAxis && !isPielike) ? 36 : 16;}
!{int padLeft = isPielike ? 16 : 52;}
!{int plotW = logWidth - padLeft - padRight;}
!{int plotH = height - padTop - padBottom;}
!{double bandW = (double) plotW / n;}
!{double barGroupW = bandW * 0.8;}
!{double barW = seriesCount > 0 ? barGroupW / seriesCount : barGroupW;}
!{int baseY = padTop + plotH;}

<%-- SVG aria-labelledby: use title id; extend with desc id when description is set --%>
!{String svgLabelledBy = (description != null && !description.isBlank()) ? (_svgTitleId + " " + _svgDescId) : _svgTitleId;}

<%-- Y-axis tick values (4 ticks from 0 to max) --%>
!{int[] yTicks = {0, (int)Math.round(globalMax/4), (int)Math.round(globalMax/2), (int)Math.round(globalMax*3/4), (int)Math.round(globalMax)};}

<%-- Pie/donut geometry --%>
!{int cx = padLeft + plotW / 2;}
!{int cy = padTop + plotH / 2;}
!{int pieR = Math.min(plotW, plotH) / 2 - 4;}
!{int innerR = isDonut ? pieR / 2 : 0;}
!{double[] pieValues = seriesData.length > 0 ? seriesData[0] : new double[0];}
!{double pieTotal = 0; for (double v : pieValues) pieTotal += Math.max(v, 0);}
!{if (pieTotal <= 0) pieTotal = 1;}

<%-- SAFE dynamic data-* attributes helper --%>
!{var dataAttrs_ = new StringOutput();}
!{for (var e : dataAttrs.entrySet()) {
    if (e.getKey() != null && e.getKey().matches("[A-Za-z][A-Za-z0-9-]*")) {
      dataAttrs_.writeContent(" data-" + e.getKey() + "=\"");
      Escape.htmlAttribute(e.getValue() == null ? "" : e.getValue(), dataAttrs_);
      dataAttrs_.writeContent("\"");
    }
  }}
!{var dataAttrsMarkup = dataAttrs_.toString();}

<%-- Legend arrays --%>
!{String[] legendNames = new String[seriesCount];}
!{String[] legendColors = new String[seriesCount];}
!{for (int s = 0; s < seriesCount; s++) {
    legendNames[s] = effectiveSeries.get(s).getOrDefault("name", "Series " + (s+1));
    String sc = effectiveSeries.get(s).get("color");
    legendColors[s] = (sc != null && !sc.isBlank()) ? sc : palette[s % palette.length];
  }}

<figure
  id="${_chartId}"
  data-slot="chart"
  data-chart-type="${type}"
  aria-labelledby="${_svgTitleId}"
  aria-busy="${loading ? "true" : null}"
  data-lievit-enhancer="${interactive ? "chart" : null}"
  data-chart-zoomable="${(interactive && zoomable) ? "true" : null}"
  data-tooltip-id="${interactive ? _tooltipId : null}"
  tabindex="${interactive ? null : "0"}"
  class="lv-chart relative flex flex-col gap-[var(--lv-space-3)] ${cssClass}"
  style="font-family:var(--lv-font-sans);"
  $unsafe{dataAttrsMarkup}
  $unsafe{attrs}
>
  @if(showTitle)
    <h3
      id="${_svgTitleId}-heading"
      class="text-[length:var(--lv-text-base)] font-[var(--lv-font-semibold)] text-[var(--lv-color-fg)]"
      style="margin:0;"
    >${title}</h3>
  @endif

  @if(loading)
    <div
      class="lv-chart__shimmer"
      aria-hidden="true"
      style="height:${height}px;"
    ></div>
  @else
    <svg
      role="img"
      aria-labelledby="${svgLabelledBy}"
      viewBox="0 0 ${logWidth} ${height}"
      preserveAspectRatio="xMidYMid meet"
      width="100%"
      class="block h-auto w-full overflow-visible"
      style="font-family:var(--lv-font-sans);"
    >
      <title id="${_svgTitleId}">${title}</title>
      @if(description != null && !description.isBlank())
        <desc id="${_svgDescId}">${description}</desc>
      @endif

      @if(isEmpty)
        <text
          x="${logWidth / 2}"
          y="${height / 2}"
          text-anchor="middle"
          dominant-baseline="middle"
          fill="var(--lv-color-muted-fg)"
          style="font-size:14px;"
          role="status"
        >${emptyText}</text>
      @else
        @if(isPielike)
          <%-- Pie / donut arcs. Each path is a void SVG element: MUST be self-closed />. --%>
          !{double pieAngle = -Math.PI / 2.0;}
          @for(int i = 0; i < pieValues.length; i++)
            !{double pv = Math.max(pieValues[i], 0);}
            !{double frac = pv / pieTotal;}
            !{double pStart = pieAngle;}
            !{double pEnd = pieAngle + frac * 2.0 * Math.PI;}
            !{pieAngle = pEnd;}
            !{int px1 = (int) Math.round(cx + pieR * Math.cos(pStart));}
            !{int py1 = (int) Math.round(cy + pieR * Math.sin(pStart));}
            !{int px2 = (int) Math.round(cx + pieR * Math.cos(pEnd));}
            !{int py2 = (int) Math.round(cy + pieR * Math.sin(pEnd));}
            !{int largeArc = (pEnd - pStart) > Math.PI ? 1 : 0;}
            !{String sliceFill = palette[i % palette.length];}
            !{String sliceCat = i < effectiveLabels.length ? effectiveLabels[i] : String.valueOf(i);}
            !{String slicePath;}
            !{if (isDonut) {
                int ix1 = (int) Math.round(cx + innerR * Math.cos(pEnd));
                int iy1 = (int) Math.round(cy + innerR * Math.sin(pEnd));
                int ix2 = (int) Math.round(cx + innerR * Math.cos(pStart));
                int iy2 = (int) Math.round(cy + innerR * Math.sin(pStart));
                slicePath = "M " + px1 + " " + py1 + " A " + pieR + " " + pieR + " 0 " + largeArc + " 1 " + px2 + " " + py2 + " L " + ix1 + " " + iy1 + " A " + innerR + " " + innerR + " 0 " + largeArc + " 0 " + ix2 + " " + iy2 + " Z";
              } else {
                slicePath = "M " + cx + " " + cy + " L " + px1 + " " + py1 + " A " + pieR + " " + pieR + " 0 " + largeArc + " 1 " + px2 + " " + py2 + " Z";
              }}
            <path
              class="lv-chart__sector"
              data-slot="lv-chart__sector"
              d="${slicePath}"
              fill="${sliceFill}"
              stroke="var(--lv-color-bg)"
              stroke-width="2"
              aria-label="${sliceCat}: ${(int)pv}"
              data-point-series="0"
              data-point-x="${i}"
              data-point-y="${(int)pv}"
              data-point-index="${i}"
              tabindex="${interactive ? "0" : null}"
              role="${interactive ? "img" : null}"
            />
          @endfor
        @else
          <%-- Cartesian types: grid, axes, then series shapes --%>
          <%-- Y-axis grid lines (aria-hidden decorative). line is a SVG void element: MUST end />. --%>
          <g aria-hidden="true">
            @for(int ti = 1; ti < yTicks.length; ti++)
              !{int tickY = (int) Math.round(baseY - plotH * ((double) yTicks[ti] / globalMax));}
              <line
                x1="${padLeft}" y1="${tickY}" x2="${logWidth - padRight}" y2="${tickY}"
                stroke="var(--lv-color-border)"
                stroke-width="1"
                stroke-dasharray="4 4"
              />
              <text
                x="${padLeft - 6}" y="${tickY}"
                text-anchor="end"
                dominant-baseline="middle"
                fill="var(--lv-color-muted-fg)"
                style="font-size:11px;"
              >${yTicks[ti]}</text>
            @endfor
            <%-- baseline --%>
            <line x1="${padLeft}" y1="${baseY}" x2="${logWidth - padRight}" y2="${baseY}" stroke="var(--lv-color-border)" stroke-width="1" />
            <%-- Y-axis label for 0 --%>
            <text
              x="${padLeft - 6}" y="${baseY}"
              text-anchor="end"
              dominant-baseline="middle"
              fill="var(--lv-color-muted-fg)"
              style="font-size:11px;"
            >0</text>
          </g>

          <%-- Area fills (behind lines). polygon is a SVG void element: MUST end />. --%>
          @for(int s = 0; s < seriesCount; s++)
            !{String sType = effectiveSeries.get(s).getOrDefault("seriesType", type);}
            !{boolean drawArea = "area".equals(sType) || (isArea && !isComposed);}
            @if(drawArea && seriesData[s].length > 0)
              !{String sc2 = effectiveSeries.get(s).get("color");}
              !{String aColor = (sc2 != null && !sc2.isBlank()) ? sc2 : palette[s % palette.length];}
              !{double[] sd = seriesData[s];}
              !{int fx = (int) Math.round(padLeft + bandW / 2.0);}
              !{int lx = (int) Math.round(padLeft + bandW * (sd.length - 1) + bandW / 2.0);}
              !{StringBuilder sbArea = new StringBuilder();}
              !{sbArea.append(fx).append(',').append(baseY).append(' ');}
              !{for (int i = 0; i < sd.length; i++) {
                  int apx = (int) Math.round(padLeft + bandW * i + bandW / 2.0);
                  int apy = (int) Math.round(baseY - plotH * (sd[i] / globalMax));
                  sbArea.append(apx).append(',').append(apy).append(' ');
                }}
              !{sbArea.append(lx).append(',').append(baseY);}
              <polygon
                class="lv-chart__area"
                data-slot="lv-chart__area"
                points="${sbArea.toString()}"
                fill="${aColor}"
                fill-opacity="0.18"
                stroke="none"
                aria-hidden="true"
              />
            @endif
          @endfor

          <%-- Line polylines (after area fills, before points). polyline is a SVG void element: MUST end />. --%>
          @for(int s = 0; s < seriesCount; s++)
            !{String sType = effectiveSeries.get(s).getOrDefault("seriesType", type);}
            !{boolean drawLine = "line".equals(sType) || "area".equals(sType) || (isLine && !isComposed) || (isArea && !isComposed);}
            @if(drawLine && seriesData[s].length > 0)
              !{String sc3 = effectiveSeries.get(s).get("color");}
              !{String lColor = (sc3 != null && !sc3.isBlank()) ? sc3 : palette[s % palette.length];}
              !{double[] sd = seriesData[s];}
              !{StringBuilder sbLine = new StringBuilder();}
              !{for (int i = 0; i < sd.length; i++) {
                  int lpx = (int) Math.round(padLeft + bandW * i + bandW / 2.0);
                  int lpy = (int) Math.round(baseY - plotH * (sd[i] / globalMax));
                  if (i > 0) sbLine.append(' ');
                  sbLine.append(lpx).append(',').append(lpy);
                }}
              <polyline
                class="lv-chart__line"
                data-slot="lv-chart__line"
                points="${sbLine.toString()}"
                fill="none"
                stroke="${lColor}"
                stroke-width="2"
                stroke-linejoin="round"
                stroke-linecap="round"
                aria-hidden="true"
              />
            @endif
          @endfor

          <%-- Data marks (bars and points) + x-axis labels --%>
          @for(int i = 0; i < n; i++)
            !{String xLabel = i < effectiveLabels.length ? effectiveLabels[i] : String.valueOf(i);}
            !{double bandX = padLeft + bandW * i;}

            <%-- Bars for each series at this x position. rect is a SVG void element: MUST end />. --%>
            @for(int s = 0; s < seriesCount; s++)
              !{String sType = effectiveSeries.get(s).getOrDefault("seriesType", type);}
              !{boolean drawBar = "bar".equals(sType) || (isBar && !isComposed) || (isComposed && "bar".equals(sType));}
              @if(drawBar && i < seriesData[s].length)
                !{double bv = seriesData[s][i];}
                !{String sc4 = effectiveSeries.get(s).get("color");}
                !{String bColor = (sc4 != null && !sc4.isBlank()) ? sc4 : palette[s % palette.length];}
                !{int bx = (int) Math.round(bandX + s * barW + (bandW - barGroupW) / 2.0);}
                !{int bh = (int) Math.round(plotH * (bv / globalMax));}
                !{int by = baseY - bh;}
                !{int bwi = (int) Math.round(barW) - 1;}
                <rect
                  class="lv-chart__bar"
                  data-slot="lv-chart__bar"
                  x="${bx}" y="${by}" width="${Math.max(bwi, 1)}" height="${Math.max(bh, 0)}"
                  rx="2"
                  fill="${bColor}"
                  aria-label="${xLabel}: ${(int)bv}"
                  data-point-series="${s}"
                  data-point-x="${i}"
                  data-point-y="${(int)bv}"
                  data-point-index="${i}"
                  tabindex="${interactive ? "0" : null}"
                  role="${interactive ? "img" : null}"
                />
              @endif
            @endfor

            <%-- Points (circles) for line/area series. circle is a SVG void element: MUST end />. --%>
            @for(int s = 0; s < seriesCount; s++)
              !{String sType = effectiveSeries.get(s).getOrDefault("seriesType", type);}
              !{boolean drawPoint = "line".equals(sType) || "area".equals(sType) || (isLine && !isComposed) || (isArea && !isComposed);}
              @if(drawPoint && i < seriesData[s].length)
                !{double pv2 = seriesData[s][i];}
                !{String sc5 = effectiveSeries.get(s).get("color");}
                !{String pColor = (sc5 != null && !sc5.isBlank()) ? sc5 : palette[s % palette.length];}
                !{int ppx = (int) Math.round(bandX + bandW / 2.0);}
                !{int ppy = (int) Math.round(baseY - plotH * (pv2 / globalMax));}
                <circle
                  class="lv-chart__point"
                  data-slot="lv-chart__point"
                  cx="${ppx}" cy="${ppy}" r="4"
                  fill="${pColor}"
                  stroke="var(--lv-color-bg)"
                  stroke-width="2"
                  aria-label="${xLabel}: ${(int)pv2}"
                  data-point-series="${s}"
                  data-point-x="${i}"
                  data-point-y="${(int)pv2}"
                  data-point-index="${i}"
                  tabindex="${interactive ? "0" : null}"
                  role="${interactive ? "img" : null}"
                />
              @endif
            @endfor

            <%-- X-axis category label --%>
            @if(showAxis)
              !{int labelX = (int) Math.round(bandX + bandW / 2.0);}
              <text
                x="${labelX}" y="${height - 8}"
                text-anchor="middle"
                aria-hidden="true"
                fill="var(--lv-color-muted-fg)"
                style="font-size:11px;"
              >${xLabel}</text>
            @endif
          @endfor

          <%-- Reference lines. line is a SVG void element: MUST end />. --%>
          @for(String refLine : referenceLines)
            !{String[] rParts = refLine.split("\\|", 4);}
            !{double refVal;}
            !{try { refVal = Double.parseDouble(rParts[0].trim()); } catch (NumberFormatException ex) { refVal = 0; }}
            !{String refLabel = rParts.length >= 3 ? rParts[2].trim() : "";}
            !{boolean refDashed = rParts.length >= 4 && "dashed".equalsIgnoreCase(rParts[3].trim());}
            !{int refY = (int) Math.round(baseY - plotH * (refVal / globalMax));}
            <line
              class="lv-chart__reference-line"
              x1="${padLeft}" y1="${refY}" x2="${logWidth - padRight}" y2="${refY}"
              stroke="var(--lv-color-muted-fg)"
              stroke-width="1"
              stroke-dasharray="${refDashed ? "6 3" : "none"}"
              aria-hidden="true"
            />
            @if(!refLabel.isBlank())
              <text
                x="${logWidth - padRight - 2}" y="${refY - 4}"
                text-anchor="end"
                fill="var(--lv-color-muted-fg)"
                aria-hidden="true"
                style="font-size:10px;"
              >${refLabel}</text>
            @endif
          @endfor

          <%-- In-SVG legend group (aria-hidden decorative) --%>
          <g class="lv-chart__legend" aria-hidden="true">
          </g>
        @endif
      @endif
    </svg>

    <%-- Accessible data table (sr-only when showTable=true) --%>
    @if(showTable)
      !{String tCaption = (tableCaption != null && !tableCaption.isBlank()) ? tableCaption : title;}
      <table class="sr-only" aria-label="${tCaption}">
        <caption>${tCaption}</caption>
        <thead>
          <tr>
            <th scope="col">X</th>
            @for(int s = 0; s < seriesCount; s++)
              <th scope="col">${effectiveSeries.get(s).getOrDefault("name", "Series " + (s+1))}</th>
            @endfor
          </tr>
        </thead>
        <tbody>
          @for(int i = 0; i < n; i++)
            !{String tLabel = i < effectiveLabels.length ? effectiveLabels[i] : String.valueOf(i);}
            <tr>
              <th scope="row">${tLabel}</th>
              @for(int s = 0; s < seriesCount; s++)
                !{double tv = i < seriesData[s].length ? seriesData[s][i] : 0;}
                <td>${(int)tv}</td>
              @endfor
            </tr>
          @endfor
        </tbody>
      </table>
    @endif

    <%-- Tooltip div (only rendered when interactive) --%>
    @if(interactive)
      <div
        id="${_tooltipId}"
        class="lv-chart__tooltip"
        role="tooltip"
        aria-live="off"
        data-chart-tooltip="${_chartId}"
      ></div>
    @endif
  @endif

  <%-- Static legend (below the SVG) --%>
  @if(showLegend)
    @if(isPielike)
      @template.lievit.chart.legend(names = effectiveLabels, colors = legendColors)
    @else
      @template.lievit.chart.legend(names = legendNames, colors = legendColors)
    @endif
  @endif
</figure>
