@import dev.lievit.component.ComponentMetadata
@import dev.lievit.wire.CalendarComponent
@import dev.lievit.wire.CalendarComponent.Cell
@import dev.lievit.wire.CalendarComponent.Event
@import java.util.List
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui calendar WIRE template -- a full event calendar (month/week/day) whose grid, the events
  placed in its cells, the view, the anchor and the filter all live SERVER-SIDE (ADR-0012, R1
  RESOLVED). Pairs with registry/wire/calendar/CalendarComponent.java + the calendar.ts drag enhancer.
  This is the single heaviest piece of the refactor: it retires both the <lv-calendar> Lit island AND
  gest's ht-calendar (@event-calendar) escape-hatch. There is NO Lit, NO @event-calendar, NO <slot>.

  TIER: WIRE. The grid is server-rendered HTML from the typed model (CalendarComponent.weeks()); the
  view switch + prev/next/today are l:click actions (the server re-renders the grid, the client morphs
  it); the filter is a @Wire string bound l:model.debounce.250ms so there is NO round-trip per
  keystroke. The wire OPTIMIZATION toolkit absorbs the round-trip latency a server-rendered drag-grid
  would otherwise pay:
    - Initial grid: when not yet loaded the template ships a SKELETON whose l:init="load" fires the
      `load` action right after bind (the wire:init parity), so first paint is immediate and the real
      grid arrives on the next morph; l:loading regions give instant feedback while a call resolves.
    - Filter/typeahead: l:model.debounce.250ms -> server re-filters a few hundred ms after the last key.
    - Navigation: l:click prev/next/today/viewMonth/viewWeek/viewDay re-render the resolved period.
  The one irreducible client bit -- event drag-resize/drag-create -- is the calendar.ts enhancer: on
  drop it $set's the dragged event id + the target ISO date into the wire and $call's `moveEvent`; the
  server owns the event store, moves the event in Java and re-renders. addEventListener only, CSP-clean.

  STRUCTURE (scientific decision rule): WAI-ARIA APG Grid pattern for the month layout (the same model
  the dropped island cited): the grid is a <table role="grid">, weekday headers are <th
  role="columnheader">, each day is a <td role="gridcell"> carrying aria-selected; today carries
  aria-current="date". A server-rendered grid + a tiny drop enhancer beats a client grid: the events
  and the layout are both server-held, so nothing can fail to project (the slot bug) and the layout
  cannot drift; the only client code is the irreducible drop gesture.

  A11y (WAI-ARIA APG Grid): table[role=grid][aria-label], th[role=columnheader], td[role=gridcell]
  [aria-selected], the today cell aria-current="date"; the toolbar buttons carry aria-labels; the
  filter input is a labelled searchbox; the loading region is aria-busy while a call is in flight.

  Params:
    view        String   the visible view ("month" | "week" | "day"; round-trips)
    anchor      String   the ISO date the visible range is built around (round-trips)
    filter      String   the live filter query (bound by l:model.debounce.250ms)
    selected    String   the clicked day ISO (server-owned; set via $set)
    loaded      boolean  false on mount (skeleton + l:init), true once `load` has fired
    dragEventId String   the event id the drag enhancer arms before moveEvent (round-trips)
    dragToDate  String   the ISO day the dragged event is dropped onto (round-trips)
    _instance   CalendarComponent   the live instance (reads the server-built grid + the period label)
    _component  ComponentMetadata   always-present wire metadata (the className anchor)

  Usage (copy this template in, seed allEvents in the component from real data keyed by the visible
  range, register the component as a PROTOTYPE @Bean, call enhanceCalendars(runtime) once from main.ts
  after startLievit() so a day-cell drop moves the event server-side):
    @template.lievit.calendar(...)  -- mounted by the wire pipeline.
--%>
@param String view
@param String anchor
@param String filter
@param String selected
@param boolean loaded
@param String dragEventId
@param String dragToDate
@param CalendarComponent _instance
@param ComponentMetadata _component
!{var cid = _component.className();}
!{var label = _instance.periodLabel();}
!{List<String> headers = _instance.weekdayHeaders();}
!{List<List<Cell>> weeks = _instance.weeks();}
<div data-lievit-component="${cid}" data-calendar data-calendar-view="${view}" style="display: block; font-family: var(--lv-font-sans); color: var(--lv-color-fg); background: var(--lv-color-bg); border: 1px solid var(--lv-color-border); border-radius: var(--lv-radius-md); padding: var(--lv-space-3);">

    <%-- Toolbar: period label + nav + view switch + the debounced filter. --%>
    <div data-calendar-toolbar style="display: flex; flex-wrap: wrap; align-items: center; gap: var(--lv-space-2); margin-bottom: var(--lv-space-3);">
        <div style="display: inline-flex; align-items: center; gap: var(--lv-space-1);">
            <button type="button" l:click="prev" aria-label="Previous period" data-calendar-prev
                style="display: inline-flex; align-items: center; justify-content: center; width: 2rem; height: 2rem; border: 1px solid var(--lv-color-border); border-radius: var(--lv-radius-sm); background: transparent; color: var(--lv-color-fg); cursor: pointer;">
                @template.icon(name = "chevron-left", size = "1rem")
            </button>
            <button type="button" l:click="today" data-calendar-today
                style="padding: var(--lv-space-1) var(--lv-space-3); border: 1px solid var(--lv-color-border); border-radius: var(--lv-radius-sm); background: transparent; color: var(--lv-color-fg); font-size: var(--lv-text-sm); cursor: pointer;">Today</button>
            <button type="button" l:click="next" aria-label="Next period" data-calendar-next
                style="display: inline-flex; align-items: center; justify-content: center; width: 2rem; height: 2rem; border: 1px solid var(--lv-color-border); border-radius: var(--lv-radius-sm); background: transparent; color: var(--lv-color-fg); cursor: pointer;">
                @template.icon(name = "chevron-right", size = "1rem")
            </button>
        </div>

        <span data-calendar-label aria-live="polite" style="font-size: var(--lv-text-base); font-weight: var(--lv-font-semibold); flex: 1; min-width: 8rem;">${label}</span>

        <%-- l:loading region: instant feedback while any wire call for this calendar is in flight. --%>
        <span data-calendar-loading l:loading aria-hidden="true" style="display: none; font-size: var(--lv-text-sm); color: var(--lv-color-muted);">Loading…</span>

        <div role="group" aria-label="View" data-calendar-views style="display: inline-flex; border: 1px solid var(--lv-color-border); border-radius: var(--lv-radius-sm); overflow: hidden;">
            <button type="button" l:click="viewMonth" aria-pressed="${"month".equals(view) ? "true" : "false"}" data-calendar-view-month
                style="padding: var(--lv-space-1) var(--lv-space-3); border: 0; background: ${"month".equals(view) ? "var(--lv-color-primary)" : "transparent"}; color: ${"month".equals(view) ? "var(--lv-color-primary-fg)" : "var(--lv-color-fg)"}; font-size: var(--lv-text-sm); cursor: pointer;">Month</button>
            <button type="button" l:click="viewWeek" aria-pressed="${"week".equals(view) ? "true" : "false"}" data-calendar-view-week
                style="padding: var(--lv-space-1) var(--lv-space-3); border: 0; border-left: 1px solid var(--lv-color-border); background: ${"week".equals(view) ? "var(--lv-color-primary)" : "transparent"}; color: ${"week".equals(view) ? "var(--lv-color-primary-fg)" : "var(--lv-color-fg)"}; font-size: var(--lv-text-sm); cursor: pointer;">Week</button>
            <button type="button" l:click="viewDay" aria-pressed="${"day".equals(view) ? "true" : "false"}" data-calendar-view-day
                style="padding: var(--lv-space-1) var(--lv-space-3); border: 0; border-left: 1px solid var(--lv-color-border); background: ${"day".equals(view) ? "var(--lv-color-primary)" : "transparent"}; color: ${"day".equals(view) ? "var(--lv-color-primary-fg)" : "var(--lv-color-fg)"}; font-size: var(--lv-text-sm); cursor: pointer;">Day</button>
        </div>

        <input type="search" role="searchbox" placeholder="Filter events" aria-label="Filter events"
            value="${filter}" l:model.debounce.250ms="filter" data-calendar-filter
            style="font-size: var(--lv-text-sm); color: var(--lv-color-fg); background: var(--lv-color-bg); border: 1px solid var(--lv-color-border); border-radius: var(--lv-radius-sm); padding: var(--lv-space-1) var(--lv-space-2); min-width: 10rem;" />
    </div>

    @if(!loaded)
        <%-- First-paint skeleton: l:init fires `load` right after bind so the real grid arrives on the
             next morph; the skeleton is what the user sees instantly (initial-latency toolkit). --%>
        <div data-calendar-skeleton l:init="load" aria-busy="true" aria-label="Loading calendar"
            style="display: grid; grid-template-columns: repeat(7, 1fr); gap: var(--lv-space-1);">
            @for(int i = 0; i < 35; i++)
                <div data-calendar-skeleton-cell style="height: 4rem; background: var(--lv-color-surface); border-radius: var(--lv-radius-sm); opacity: 0.6;"></div>
            @endfor
        </div>
    @else
        <table role="grid" aria-label="${label}" data-calendar-grid
            style="width: 100%; border-collapse: collapse; table-layout: fixed;">
            <thead>
                <tr>
                    @for(String h : headers)
                        <th role="columnheader" scope="col" data-calendar-dayheader
                            style="font-size: var(--lv-text-xs); color: var(--lv-color-muted-fg); font-weight: var(--lv-font-medium); padding: var(--lv-space-1); text-align: left;">${h}</th>
                    @endfor
                </tr>
            </thead>
            <tbody>
                @for(List<Cell> week : weeks)
                    <tr>
                        @for(Cell cell : week)
                            <td role="gridcell"
                                aria-selected="${cell.isSelected() ? "true" : "false"}"
                                aria-current="${cell.isToday() ? "date" : "false"}"
                                data-calendar-cell="${cell.date()}"
                                l:click="${"$set('selected', '" + cell.date() + "')"}"
                                style="vertical-align: top; height: 4.5rem; border: 1px solid var(--lv-color-border); padding: var(--lv-space-1); cursor: pointer; background: ${cell.isSelected() ? "var(--lv-color-surface)" : "var(--lv-color-bg)"}; opacity: ${cell.inView() ? "1" : "0.45"};">
                                <span data-calendar-daynum aria-hidden="${cell.inView() ? "false" : "true"}"
                                    style="display: inline-flex; align-items: center; justify-content: center; min-width: 1.5rem; height: 1.5rem; font-size: var(--lv-text-xs); border-radius: var(--lv-radius-full); ${cell.isToday() ? "background: var(--lv-color-primary); color: var(--lv-color-primary-fg); font-weight: var(--lv-font-semibold);" : ""}">${cell.dayOfMonth()}</span>
                                <div data-calendar-cell-events style="margin-top: var(--lv-space-1); display: flex; flex-direction: column; gap: 2px;">
                                    @for(Event ev : cell.events())
                                        <span role="button" tabindex="0" draggable="true"
                                            data-calendar-event="${ev.id()}"
                                            data-calendar-event-date="${ev.date()}"
                                            title="${ev.title()}"
                                            style="display: block; font-size: var(--lv-text-xs); color: var(--lv-color-accent-fg); background: ${ev.effectiveColor()}; border-radius: var(--lv-radius-sm); padding: 1px var(--lv-space-1); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; cursor: grab;">${ev.title()}</span>
                                    @endfor
                                </div>
                            </td>
                        @endfor
                    </tr>
                @endfor
            </tbody>
        </table>
    @endif

    <%-- The drag enhancer arms these over the wire ($set) before $call('moveEvent'); kept as hidden
         mirrors so a hand-built POST (JS off) can still move an event, and so the fields are visibly
         part of the owned template, not magic. --%>
    <input type="hidden" name="dragEventId" value="${dragEventId}" data-calendar-drag-event l:model="dragEventId" />
    <input type="hidden" name="dragToDate" value="${dragToDate}" data-calendar-drag-date l:model="dragToDate" />
</div>
