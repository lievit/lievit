@import dev.lievit.kit.DashboardWidget
@import dev.lievit.kit.StatWidget
@import dev.lievit.kit.ChartWidget
@import dev.lievit.kit.AccountWidget
@import dev.lievit.kit.ColumnSpan
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-kit :: kit.widget.grid - lays a dashboard's dev.lievit.kit.DashboardWidget list into a
  responsive grid and dispatches each widget to its per-widget render (kit.widget.stat / .chart /
  .account). This is the widget twin of kit.table: the canonical dashboard chrome, so a WidgetPage
  renders its widgets() through ONE template instead of hand-assembling a grid per page.

  The grid honours the DashboardWidget contract:
    canView()    -> a hidden widget (canView() == false) is filtered out (the host filters + sorts
                    before passing the list; this template renders what it is given, in order, and
                    also skips a !canView() widget defensively).
    columnSpan() -> the cell's grid span: ColumnSpan.full() spans every column; a fixed/responsive
                    span maps to the default-breakpoint count (the SVG/JTE render is single-breakpoint;
                    finer responsive spans are a host CSS concern, the per-breakpoint map is on the model).
    sort()       -> the display order; the host sorts the list by sort() ascending before rendering
                    (the grid renders in list order, it does not re-sort).

  Dispatch is by concrete widget type (StatWidget -> stat, ChartWidget -> chart, AccountWidget ->
  account). The cell root is a constant <div> with the inner render switching per branch (the JTE
  static-checker rejects an @if/@else that opens a DIFFERENT root tag per branch, so the conditional
  stays INSIDE the cell, never on the cell <div> itself).

  Server-first, token-driven, strict-CSP clean. Params:
    widgets - the dashboard widgets, in display order (host already filtered + sorted).
    columns - the grid column count (default 4, the Filament dashboard default).
--%>
@param java.util.List<DashboardWidget> widgets
@param int columns = 4
<div
  data-slot="kit-widget-grid"
  class="grid gap-[var(--lv-space-4)]"
  style="grid-template-columns:repeat(${Math.max(1, columns)}, minmax(0, 1fr));font-family:var(--lv-font-sans);"
>
  @for(DashboardWidget widget : widgets)
    @if(widget.canView())
      !{ColumnSpan span = widget.columnSpan();}
      !{int spanCols = span.isFull() ? Math.max(1, columns) : Math.min(Math.max(1, columns), span.at(ColumnSpan.DEFAULT_BREAKPOINT));}
      <div data-slot="kit-widget-grid-cell" style="grid-column:span ${spanCols} / span ${spanCols};">
        @if(widget instanceof StatWidget stat)
          @template.kit.widget.stat(stat = stat)
        @elseif(widget instanceof AccountWidget account)
          @template.kit.widget.account(account = account)
        @elseif(widget instanceof ChartWidget chart)
          @template.kit.widget.chart(chart = chart)
        @else
          <%-- Unknown widget type: render nothing rather than guess (a forward-compatible no-op). --%>
        @endif
      </div>
    @endif
  @endfor
</div>
