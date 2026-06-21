<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui chart partial -- a SERVER-rendered static bar chart as inline SVG (ADR-0012).
  The bars, axis labels and accessible title are all emitted from typed @param data; there is
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

  STRUCTURE (scientific decision rule): the simplest useful shape the island supported is the bar
  chart (its default type="bar"), and a bar is the one chart whose geometry is a trivial server
  computation (a rect per datum, height = value / max). shadcn's chart guidance and the WAI-ARIA
  img role agree: a static data graphic is a single role="img" with a text alternative, NOT a
  widget. So the partial is one <svg role="img"> with an <title>/aria-label for the accessible
  name, one <rect> per data point coloured by the --lv-color-chart-N tokens (the same token cascade
  the island used), a baseline, and per-bar category labels under the plot. Native SVG beats a
  bundled lib on every axis here: a11y (the title is the text alternative a screen reader reads),
  zero dependency, and SSR-native declarative markup.

  A11y (WAI-ARIA img): the <svg> carries role="img" + aria-label (the chart's accessible name) and
  an in-SVG <title> as the first child (the SVG-native text alternative). Each bar also carries an
  aria-label="<category>: <value>" so the individual data is reachable; the decorative axis text is
  aria-hidden so the value is not announced twice.

  Params:
    String   label                accessible name for the whole chart (role=img aria-label + <title>).
    String[] categories           x-axis labels, one per data point.
    int[]    values               bar values, aligned positionally with categories.
    String   color    = "var(--lv-color-chart-1)"  bar fill; defaults to the chart-1 token.
    int      width    = 600       SVG viewBox width.
    int      height   = 300       SVG viewBox height.
    boolean  showAxis = true      render the category labels under the plot.
    String   cssClass = ""        extra utility classes on the <svg>.

  Usage:
    @@template.lievit.chart(label = "Listings closed", categories = months, values = closed)
    @@template.lievit.chart(label = "Leads", categories = sources, values = leads, color = "var(--lv-color-chart-3)")
--%>
@param String label
@param String[] categories
@param int[] values
@param String color = "var(--lv-color-chart-1)"
@param int width = 600
@param int height = 300
@param boolean showAxis = true
@param String cssClass = ""

!{
  int padTop = 12;
  int padRight = 12;
  int padBottom = showAxis ? 28 : 12;
  int padLeft = 36;
  int plotW = width - padLeft - padRight;
  int plotH = height - padTop - padBottom;
  int n = Math.max(values.length, 1);
  double bandW = (double) plotW / n;
  double barW = bandW * 0.7;
  int max = 1;
  for (int v : values) if (v > max) max = v;
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

  <%-- baseline --%>
  !{int baseY = padTop + plotH;}
  <line x1="${padLeft}" y1="${baseY}" x2="${width - padRight}" y2="${baseY}" stroke="var(--lv-color-border)" stroke-width="1" />

  @for(int i = 0; i < values.length; i++)
    !{int v = values[i];}
    !{double bandX = padLeft + bandW * i;}
    !{int x = (int) Math.round(bandX + (bandW - barW) / 2.0);}
    !{int barH = (int) Math.round(plotH * ((double) v / max));}
    !{int y = baseY - barH;}
    !{int bw = (int) Math.round(barW);}
    !{String cat = i < categories.length ? categories[i] : String.valueOf(i);}
    <rect
      data-slot="chart-bar"
      x="${x}" y="${y}" width="${Math.max(bw, 1)}" height="${Math.max(barH, 0)}"
      rx="2"
      fill="${color}"
      role="img"
      aria-label="${cat}: ${v}"
    ></rect>
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
</svg>
