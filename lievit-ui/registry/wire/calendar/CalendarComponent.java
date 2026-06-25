/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.wire;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.format.TextStyle;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

import dev.lievit.LievitAction;
import dev.lievit.LievitComponent;
import dev.lievit.LievitProperty;
import dev.lievit.LievitRender;
import dev.lievit.Wire;

/**
 * {@code calendar}: the server-first WIRE replacement for the {@code <lv-calendar>} Lit island AND
 * for gest's heavier {@code ht-calendar} ({@code @event-calendar}) escape-hatch island (ADR-0012, R1
 * RESOLVED 2026-06-19: even the calendar goes server-first, no Lit, no {@code @event-calendar}). A
 * full event calendar whose month/week/day grid, the events placed in its cells, the visible
 * view, the anchor date and the filter all live here in typed Java; the server renders the grid as
 * plain HTML and the client morphs each re-render. This is the single heaviest piece of the refactor.
 *
 * <p>WHY server-state: the dropped island held the view, the visible range, the event list and the
 * selection in client reactive state and re-laid-out the grid in the browser, where a non-projected
 * render failed silently (the bug class the pivot exists to kill). Here every durable piece is a
 * {@code @Wire} field round-tripped in the signed snapshot: {@link #view} (month/week/day),
 * {@link #anchor} (the ISO date the visible range is built around), {@link #filter} (the debounced
 * search) and {@link #selected} (the clicked day). The events are a server-owned record list, NOT
 * serialized (a record list cannot round-trip the generic snapshot codec, the {@code listing-list}
 * pattern); a real adopter seeds {@link #allEvents} from a repository read keyed by the visible
 * range. The grid + the per-cell event placement are {@code serialize = false} views rebuilt every
 * render from the anchor + view + filtered events, exactly as {@code rich-select} rebuilds its
 * visible options: nothing can fail to project and the layout cannot drift.
 *
 * <p>The wire OPTIMIZATION toolkit (ADR-0012's R1 resolution) absorbs the round-trip latency a
 * server-rendered drag-resize grid would otherwise pay:
 * <ul>
 *   <li><b>Initial grid latency</b>: the template ships a skeleton and defers the real grid to a
 *       {@code l:init="load"} call (the {@code wire:init} parity) so the first paint is immediate;
 *       {@link #loaded} flips on {@link #load()} and the grid renders on the morph, with
 *       {@code l:loading} regions giving instant feedback while it resolves.
 *   <li><b>Filter / typeahead</b>: {@link #filter} binds {@code l:model.debounce.250ms} so there is
 *       NO round-trip per keystroke; the server re-filters the events a few hundred ms after the last
 *       key and re-renders only the narrowed cells.
 *   <li><b>Navigation</b>: {@code prev}/{@code next}/{@code today} + the view switch are
 *       {@code l:click} actions; the server resolves the adjacent period and re-renders the grid.
 * </ul>
 *
 * <p>The one irreducible client bit is event drag-resize / drag-create, which has no server-side
 * equivalent (the drop coordinates are a client gesture). A tiny CSP-clean typed-TS enhancer
 * ({@code calendar.ts}) captures the drop, writes the dragged event id + the target ISO date into
 * the {@link #dragEventId} / {@link #dragToDate} wire fields ({@code $set}) and invokes
 * {@link #moveEvent()}: the server is the single owner of the event store, it validates + moves the
 * event in Java and re-renders. NOT a Lit island, NOT {@code @event-calendar}: {@code addEventListener}
 * only. No {@code <slot>}: the cells + events are OWNED template markup driven by {@code @Wire} data.
 *
 * <p>Copied in by {@code lievit add calendar}: the adopter OWNS this class (seed {@link #allEvents}
 * from real data keyed by the visible range, add server-side authz on {@link #moveEvent()}) AND the
 * {@code calendar.jte} template + the {@code calendar.ts} drag enhancer.
 */
@LievitComponent(template = "lievit/calendar")
public class CalendarComponent {

    /** ISO week starts Monday; the grid + the Home/End edges follow this (mirrors the dropped island's default). */
    private static final DayOfWeek WEEK_START = DayOfWeek.MONDAY;

    /**
     * One calendar event. A server-owned data row placed into a day cell. A plain record: server-side
     * data, never serialized to the client (the catalog never ships to the browser).
     *
     * @param id the stable event id the drag enhancer round-trips to move it
     * @param title the visible event title (also the field the filter matches)
     * @param date the ISO day the event sits on ({@code YYYY-MM-DD})
     * @param color a token-or-CSS color for the event chip (empty = the default accent)
     */
    public record Event(String id, String title, String date, String color) {
        /**
         * @param id the event id
         * @param title the event title
         * @param date the ISO day
         * @return an event with the default accent color
         */
        public static Event of(String id, String title, String date) {
            return new Event(id, title, date, "");
        }

        /**
         * @return the color to render, falling back to the accent token when none is set
         */
        public String effectiveColor() {
            return color == null || color.isEmpty() ? "var(--lv-color-accent)" : color;
        }
    }

    /** One day cell in the rendered grid: its ISO date, the day-of-month label, and its events. */
    public record Cell(
            String date, int dayOfMonth, boolean inView, boolean isToday, boolean isSelected, List<Event> events) {}

    /** The visible view. Set via {@code $set('view', '...')} or the dedicated view actions. */
    @Wire
    public String view = "month";

    /** The ISO date the visible range is built around. Round-trips; nav actions move it. */
    @Wire
    public String anchor = LocalDate.now().toString();

    /** The live filter query. Bound by {@code l:model.debounce} so typing re-filters server-side. */
    @Wire
    public String filter = "";

    /** The clicked day (ISO), held server-side. Set via {@code $set('selected', '...')}. */
    @Wire
    public String selected = "";

    /**
     * Lazy-load flag: false on mount so the template ships a skeleton; {@link #load()} flips it true
     * on the {@code l:init} call so the real grid renders on the first morph (first-paint latency
     * toolkit). Round-trips so a re-render keeps the grid present.
     */
    @Wire
    public boolean loaded = false;

    /** The event id the drag enhancer is moving. Set by the enhancer via {@code $set} before {@link #moveEvent()}. */
    @Wire
    public String dragEventId = "";

    /** The ISO date the dragged event is dropped onto. Set by the enhancer before {@link #moveEvent()}. */
    @Wire
    public String dragToDate = "";

    /**
     * The full, authoritative event store. Server-held, NOT serialized: a real adopter replaces this
     * seed with a repository read keyed by the visible range ({@link #rangeStart()} ..
     * {@link #rangeEnd()}) in the constructor / a {@code @LievitRender} hook. It never rides the
     * snapshot, so the browser never holds the event store and cannot lay out the grid client-side.
     */
    @Wire
    @LievitProperty(serialize = false)
    public List<Event> allEvents =
            new ArrayList<>(
                    List.of(
                            Event.of("e1", "Standup", LocalDate.now().toString()),
                            Event.of("e2", "Review", LocalDate.now().plusDays(2).toString())));

    /**
     * The rendered grid: the rows of day cells (with their placed events) the template renders.
     * Derived from {@link #anchor} + {@link #view} + the filtered events on every render; NOT
     * serialized (a nested record list cannot round-trip the snapshot codec, and it is pure derived
     * state anyway). Rebuilt each render because it resets on every stateless re-hydration.
     */
    @Wire
    @LievitProperty(serialize = false)
    List<List<Cell>> weeks = List.of();

    /**
     * Re-builds the grid from the anchor, view and filtered events on mount and before every
     * re-render. A {@code @LievitRender} (not {@code @LievitMount}) because {@link #weeks} is
     * {@code serialize = false} and so resets on every stateless re-hydration: it must be rebuilt
     * each render, exactly as {@code rich-select} rebuilds its visible options.
     */
    @LievitRender
    void render() {
        if (!loaded) {
            this.weeks = List.of();
            return;
        }
        LocalDate start = rangeStart();
        LocalDate end = rangeEnd();
        List<Event> visible = filteredEvents();
        LocalDate today = LocalDate.now();
        YearMonth anchorMonth = YearMonth.from(parseAnchor());

        List<List<Cell>> built = new ArrayList<>();
        List<Cell> row = new ArrayList<>();
        for (LocalDate d = start; !d.isAfter(end); d = d.plusDays(1)) {
            List<Event> onDay = new ArrayList<>();
            String iso = d.toString();
            for (Event e : visible) {
                if (iso.equals(e.date())) {
                    onDay.add(e);
                }
            }
            boolean inView = "month".equals(view) ? YearMonth.from(d).equals(anchorMonth) : true;
            row.add(
                    new Cell(
                            iso,
                            d.getDayOfMonth(),
                            inView,
                            d.equals(today),
                            iso.equals(selected),
                            List.copyOf(onDay)));
            if (row.size() == 7) {
                built.add(List.copyOf(row));
                row = new ArrayList<>();
            }
        }
        if (!row.isEmpty()) {
            built.add(List.copyOf(row));
        }
        this.weeks = List.copyOf(built);
    }

    /** The events matching the current filter (case-insensitive title match); all when blank. */
    private List<Event> filteredEvents() {
        String q = filter == null ? "" : filter.trim().toLowerCase(Locale.ROOT);
        if (q.isEmpty()) {
            return List.copyOf(allEvents);
        }
        List<Event> matched = new ArrayList<>();
        for (Event e : allEvents) {
            if (e.title().toLowerCase(Locale.ROOT).contains(q)) {
                matched.add(e);
            }
        }
        return List.copyOf(matched);
    }

    /** The anchor parsed to a {@link LocalDate}, falling back to today on a malformed value. */
    private LocalDate parseAnchor() {
        try {
            return LocalDate.parse(anchor);
        } catch (RuntimeException ex) {
            return LocalDate.now();
        }
    }

    /**
     * The first ISO date of the visible range (inclusive): for month, the Monday on or before the
     * 1st of the anchor's month; for week, the Monday on or before the anchor; for day, the anchor.
     *
     * @return the inclusive range start
     */
    public LocalDate rangeStart() {
        LocalDate a = parseAnchor();
        return switch (view) {
            case "day" -> a;
            case "week" -> mondayOnOrBefore(a);
            default -> mondayOnOrBefore(a.withDayOfMonth(1));
        };
    }

    /**
     * The last ISO date of the visible range (inclusive): for month, the Sunday on or after the last
     * day of the month; for week, range start + 6; for day, the anchor.
     *
     * @return the inclusive range end
     */
    public LocalDate rangeEnd() {
        LocalDate a = parseAnchor();
        return switch (view) {
            case "day" -> a;
            case "week" -> rangeStart().plusDays(6);
            default -> {
                LocalDate lastOfMonth = a.withDayOfMonth(a.lengthOfMonth());
                yield sundayOnOrAfter(lastOfMonth);
            }
        };
    }

    /** The Monday on or before {@code d} (the grid's leading edge). */
    private LocalDate mondayOnOrBefore(LocalDate d) {
        int back = (d.getDayOfWeek().getValue() - WEEK_START.getValue() + 7) % 7;
        return d.minusDays(back);
    }

    /** The Sunday on or after {@code d} (the grid's trailing edge). */
    private LocalDate sundayOnOrAfter(LocalDate d) {
        int forward = (WEEK_START.plus(6).getValue() - d.getDayOfWeek().getValue() + 7) % 7;
        return d.plusDays(forward);
    }

    /**
     * The seven weekday header labels, starting at the configured week-start, in the host locale.
     *
     * @return the short weekday names (Mon..Sun)
     */
    public List<String> weekdayHeaders() {
        List<String> out = new ArrayList<>();
        for (int i = 0; i < 7; i++) {
            DayOfWeek dow = WEEK_START.plus(i);
            out.add(dow.getDisplayName(TextStyle.SHORT, Locale.getDefault()));
        }
        return out;
    }

    /**
     * The header label for the current view (the month + year, the week range, or the full day).
     *
     * @return the human period label rendered in the toolbar
     */
    public String periodLabel() {
        LocalDate a = parseAnchor();
        return switch (view) {
            case "day" ->
                    a.getDayOfMonth()
                            + " "
                            + a.getMonth().getDisplayName(TextStyle.FULL, Locale.getDefault())
                            + " "
                            + a.getYear();
            case "week" -> rangeStart() + " – " + rangeEnd();
            default ->
                    a.getMonth().getDisplayName(TextStyle.FULL, Locale.getDefault()) + " " + a.getYear();
        };
    }

    /**
     * The rendered grid rows, read by the template off the live instance ({@code _instance}) because
     * a nested record list cannot round-trip the snapshot codec.
     *
     * @return the weeks of day cells
     */
    public List<List<Cell>> weeks() {
        return weeks;
    }

    /** Flips the calendar to its loaded state so the real grid renders (the {@code l:init} target). */
    @LievitAction
    public void load() {
        this.loaded = true;
    }

    /** Moves the anchor to the previous period (month/week/day), re-rendering the grid. */
    @LievitAction
    public void prev() {
        this.anchor = step(-1).toString();
    }

    /** Moves the anchor to the next period (month/week/day), re-rendering the grid. */
    @LievitAction
    public void next() {
        this.anchor = step(1).toString();
    }

    /** Jumps the anchor back to today. */
    @LievitAction
    public void today() {
        this.anchor = LocalDate.now().toString();
    }

    /** Switches to the month view. */
    @LievitAction
    public void viewMonth() {
        this.view = "month";
    }

    /** Switches to the week view. */
    @LievitAction
    public void viewWeek() {
        this.view = "week";
    }

    /** Switches to the day view. */
    @LievitAction
    public void viewDay() {
        this.view = "day";
    }

    /** The anchor stepped by {@code dir} periods in the current view's unit. */
    private LocalDate step(int dir) {
        LocalDate a = parseAnchor();
        return switch (view) {
            case "day" -> a.plusDays(dir);
            case "week" -> a.plusWeeks(dir);
            default -> a.plusMonths(dir);
        };
    }

    /**
     * Moves the event {@link #dragEventId} onto the day {@link #dragToDate}, the two fields the drag
     * enhancer armed via {@code $set} before invoking this action. The server is the single owner of
     * the event store: it validates the target date and re-dates the event in {@link #allEvents}
     * (a real adopter persists the move + adds authz here), then clears the drag fields so a stray
     * re-render does not re-apply it. The grid re-renders the event in its new cell on the morph.
     */
    @LievitAction
    public void moveEvent() {
        if (dragEventId == null || dragEventId.isEmpty() || dragToDate == null || dragToDate.isEmpty()) {
            return;
        }
        LocalDate target;
        try {
            target = LocalDate.parse(dragToDate);
        } catch (RuntimeException ex) {
            this.dragEventId = "";
            this.dragToDate = "";
            return;
        }
        List<Event> updated = new ArrayList<>();
        for (Event e : allEvents) {
            if (e.id().equals(dragEventId)) {
                updated.add(new Event(e.id(), e.title(), target.toString(), e.color()));
            } else {
                updated.add(e);
            }
        }
        this.allEvents = updated;
        this.dragEventId = "";
        this.dragToDate = "";
    }

    /**
     * The number of days in the current visible range (a small helper the template uses to choose the
     * grid column count for the week/day single-row layouts).
     *
     * @return the inclusive day span of the range
     */
    public long rangeDays() {
        return ChronoUnit.DAYS.between(rangeStart(), rangeEnd()) + 1;
    }
}
