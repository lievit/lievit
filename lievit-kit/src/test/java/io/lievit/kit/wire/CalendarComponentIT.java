/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit.wire;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.TestPropertySource;

import io.lievit.spring.LievitWireService;
import io.lievit.spring.WireCallResult;

/**
 * The dedicated exit gate (R1 RESOLVED, ADR-0012) for the single heaviest piece of the refactor: the
 * calendar wire component driven through the REAL lievit runtime (codec + registry + dispatcher + JTE
 * adapter). A render-asserting IT (not a structural one): it asserts the RENDERED DOM, the lesson the
 * silent slot bug taught. It proves the server is the single owner of the grid + the event store, and
 * that the wire optimization toolkit (l:init first paint, l:model.debounce filter, l:click nav) works
 * end to end.
 *
 * <p>It boots a Spring context, so it is an {@code *IT} (the failsafe loop, ADR-0007).
 */
@SpringBootTest(classes = CalendarWireTestApp.class)
@TestPropertySource(
        properties = {"lievit.signing-key=test-signing-key-0123456789abcdef-0123456789"})
class CalendarComponentIT {

    @Autowired LievitWireService wireService;

    private static final String COMPONENT = CalendarComponent.class.getName();

    /** Mount, then flip to loaded (the l:init `load` call) so the real grid renders. */
    private WireCallResult mountLoaded() {
        WireCallResult mounted = wireService.mount(COMPONENT);
        return wireService.call(mounted.snapshot(), Map.of(), List.of("load"), "test-client");
    }

    /**
     * @spec.given the calendar wire component freshly mounted
     * @spec.when  it is rendered by JTE through the real runtime, before the l:init load fires
     * @spec.then  the first paint is the skeleton carrying l:init="load" (immediate feedback, the
     *     real grid is deferred): no grid is rendered yet
     * @spec.adr   ADR-0012
     */
    @Test
    void mounts_the_skeleton_with_l_init_before_the_grid_loads() {
        WireCallResult mounted = wireService.mount(COMPONENT);

        assertThat(mounted.html())
                .contains("data-calendar-skeleton")
                .contains("l:init=\"load\"")
                .doesNotContain("data-calendar-grid");
        assertThat(mounted.snapshot()).isNotBlank();
    }

    /**
     * @spec.given a mounted calendar
     * @spec.when  the l:init `load` action fires (the first-paint deferral resolving)
     * @spec.then  the real APG grid renders for the anchor's month: a role=grid with weekday
     *     columnheaders and gridcells, the skeleton gone
     * @spec.adr   ADR-0012
     */
    @Test
    void the_load_action_renders_the_real_grid_for_the_anchor_period() {
        WireCallResult loaded = mountLoaded();

        assertThat(loaded.html())
                .contains("role=\"grid\"")
                .contains("role=\"columnheader\"")
                .contains("role=\"gridcell\"")
                .doesNotContain("data-calendar-skeleton");
    }

    /**
     * @spec.given a loaded calendar anchored on a known month (June 2026)
     * @spec.when  the grid renders
     * @spec.then  the period label shows that month and the days of that month are present as cells
     *     (server-resolved range, no client layout)
     * @spec.adr   ADR-0012
     */
    @Test
    void renders_the_period_label_and_the_anchor_month_days() {
        WireCallResult mounted = wireService.mount(COMPONENT);
        WireCallResult loaded =
                wireService.call(
                        mounted.snapshot(),
                        Map.of("anchor", "2026-06-15", "loaded", true),
                        List.of(),
                        "test-client");

        assertThat(loaded.html())
                .contains("2026")
                .contains("data-calendar-cell=\"2026-06-15\"")
                .contains("data-calendar-cell=\"2026-06-01\"")
                .contains("data-calendar-cell=\"2026-06-30\"");
    }

    /**
     * @spec.given a loaded calendar in month view
     * @spec.when  the `next` navigation action fires
     * @spec.then  the grid re-renders the ADJACENT period (the next month's days appear, the previous
     *     anchor month's mid-days are gone): server-side navigation, the client morphs the result
     * @spec.adr   ADR-0012
     */
    @Test
    void next_re_renders_the_adjacent_period() {
        WireCallResult mounted = wireService.mount(COMPONENT);
        WireCallResult june =
                wireService.call(
                        mounted.snapshot(),
                        Map.of("anchor", "2026-06-15", "loaded", true),
                        List.of(),
                        "test-client");

        WireCallResult july =
                wireService.call(june.snapshot(), Map.of(), List.of("next"), "test-client");

        // July's days are now in the grid as in-view cells; June's mid-month day is no longer present.
        assertThat(july.html())
                .contains("data-calendar-cell=\"2026-07-15\"")
                .doesNotContain("data-calendar-cell=\"2026-06-15\"");
    }

    /**
     * @spec.given a loaded calendar in month view
     * @spec.when  the `viewWeek` action fires (the view switch)
     * @spec.then  the view re-renders as week: the toolbar marks Week pressed and the rendered range
     *     narrows to seven cells (a single week row), not a whole month
     * @spec.adr   ADR-0012
     */
    @Test
    void switching_month_to_week_re_renders_the_view() {
        WireCallResult mounted = wireService.mount(COMPONENT);
        WireCallResult month =
                wireService.call(
                        mounted.snapshot(),
                        Map.of("anchor", "2026-06-15", "loaded", true),
                        List.of(),
                        "test-client");
        assertThat(month.html()).contains("data-calendar-view=\"month\"");

        WireCallResult week =
                wireService.call(month.snapshot(), Map.of(), List.of("viewWeek"), "test-client");

        assertThat(week.html()).contains("data-calendar-view=\"week\"");
        // a week view renders exactly one row of seven day cells, far fewer than a month grid.
        assertThat(countOccurrences(week.html(), "data-calendar-cell=")).isEqualTo(7);
    }

    /**
     * @spec.given a loaded calendar whose seed events sit on today and today+2
     * @spec.when  the grid renders the current month
     * @spec.then  the seed event is PROJECTED into its day cell: the event chip text is present in the
     *     rendered HTML (the exact projection a non-rendered slot would have silently hidden)
     * @spec.adr   ADR-0012
     */
    @Test
    void an_event_in_the_model_is_present_in_its_rendered_cell() {
        // The seed events are anchored on today, which is always inside the current month's grid.
        String today = LocalDate.now().toString();
        WireCallResult loaded = mountLoaded();

        assertThat(loaded.html())
                // the event chip is a real draggable element carrying its id...
                .containsPattern("data-calendar-event=\"e1\"")
                // ...and its title is PROJECTED as visible text (the slot-bug regression guard)...
                .contains(">Standup</span>")
                // ...inside the cell for the day it sits on.
                .contains("data-calendar-cell=\"" + today + "\"");
    }

    /**
     * @spec.given a loaded calendar with two seed events (Standup, Review)
     * @spec.when  the filter field is set over the wire (the debounced l:model send), filtering
     *     server-side
     * @spec.then  the re-rendered grid NARROWS to only the matching event (no client filtering):
     *     "stand" leaves Standup, Review is gone from every cell
     * @spec.adr   ADR-0012
     */
    @Test
    void the_filter_narrows_the_rendered_events_server_side() {
        WireCallResult loaded = mountLoaded();
        assertThat(loaded.html()).contains(">Standup</span>").contains(">Review</span>");

        WireCallResult filtered =
                wireService.call(
                        loaded.snapshot(), Map.of("filter", "stand"), List.of(), "test-client");

        assertThat(filtered.html())
                .contains(">Standup</span>")
                .doesNotContain(">Review</span>")
                .contains("data-calendar-event=\"e1\"")
                .doesNotContain("data-calendar-event=\"e2\"");
    }

    /**
     * @spec.given a loaded calendar whose Standup event (e1) sits on today
     * @spec.when  the drag enhancer arms the dragged id + a target date ($set) and fires moveEvent in
     *     one wire call
     * @spec.then  the server re-dates the event in its store and re-renders it in the NEW cell within
     *     that same response: the e1 chip now sits under the target date, NOT under today (the server
     *     is the single owner of the event store; the drop is the only client gesture). The move is
     *     in-memory here because the seed store is serialize=false (resets per stateless call); a real
     *     adopter persists it to a repository, so the assertion is within the call that performs it.
     * @spec.adr   ADR-0012
     */
    @Test
    void move_event_re_dates_the_event_server_side() {
        String today = LocalDate.now().toString();
        // Pick a deterministic target inside the same month grid as today (a different day).
        LocalDate todayDate = LocalDate.now();
        LocalDate targetDate = todayDate.getDayOfMonth() == 1 ? todayDate.plusDays(1) : todayDate.minusDays(1);
        String target = targetDate.toString();

        WireCallResult loaded = mountLoaded();
        assertThat(extractCellOf(loaded.html(), "e1")).isEqualTo(today);

        WireCallResult moved =
                wireService.call(
                        loaded.snapshot(),
                        Map.of("dragEventId", "e1", "dragToDate", target),
                        List.of("moveEvent"),
                        "test-client");

        // the server re-dated e1 onto the target day within this very call and re-rendered it there.
        assertThat(extractCellOf(moved.html(), "e1")).isEqualTo(target);
    }

    /** Counts non-overlapping occurrences of {@code needle} in {@code haystack}. */
    private static int countOccurrences(String haystack, String needle) {
        int count = 0;
        int from = 0;
        while (true) {
            int i = haystack.indexOf(needle, from);
            if (i < 0) {
                break;
            }
            count++;
            from = i + needle.length();
        }
        return count;
    }

    /**
     * Reads the ISO date of the cell that contains the event with {@code eventId} by scanning back
     * from the event chip to the nearest preceding {@code data-calendar-cell="..."} attribute. A
     * render assertion: it proves WHERE in the rendered grid the event landed.
     */
    private static String extractCellOf(String html, String eventId) {
        int chip = html.indexOf("data-calendar-event=\"" + eventId + "\"");
        assertThat(chip).as("event chip %s present in the rendered grid", eventId).isGreaterThan(0);
        String marker = "data-calendar-cell=\"";
        int cell = html.lastIndexOf(marker, chip);
        assertThat(cell).as("a cell precedes event chip %s", eventId).isGreaterThan(0);
        int start = cell + marker.length();
        int end = html.indexOf('"', start);
        return html.substring(start, end);
    }
}
