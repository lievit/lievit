/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.pagination;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.stream.IntStream;

import org.junit.jupiter.api.Test;

/**
 * Specifies the pagination primitives (issue #197): an offset paginator computes pages + numbered
 * links + the SQL offset; a cursor paginator walks a large set by keyset cursors with no OFFSET; the
 * {@code $page} state navigates, resets on a filter change, and supports named pages for two
 * paginators on one screen.
 */
class PaginationTest {

    /** An offset source over an in-memory list (the adopter's SELECT ... LIMIT/OFFSET analogue). */
    private static Paginators.OffsetSource<Integer> listSource(List<Integer> all) {
        return new Paginators.OffsetSource<>() {
            @Override
            public long count() {
                return all.size();
            }

            @Override
            public List<Integer> slice(long offset, int limit) {
                int from = (int) Math.min(offset, all.size());
                int to = (int) Math.min(offset + limit, all.size());
                return all.subList(from, to);
            }
        };
    }

    /**
     * @spec.given 23 rows paginated 10 per page on page 2
     * @spec.when  the offset page is built
     * @spec.then  it holds rows 11..20, reports 3 pages, has next + previous, and the SQL offset 10
     */
    @Test
    void offset_paginate_navigates_pages_with_correct_metadata() {
        List<Integer> all = IntStream.rangeClosed(1, 23).boxed().toList();

        OffsetPage<Integer> page2 = Paginators.offset(listSource(all), 2, 10);

        assertThat(page2.items()).containsExactly(11, 12, 13, 14, 15, 16, 17, 18, 19, 20);
        assertThat(page2.lastPage()).isEqualTo(3);
        assertThat(page2.hasNextPage()).isTrue();
        assertThat(page2.hasPreviousPage()).isTrue();
        assertThat(page2.offset()).isEqualTo(10);
    }

    /**
     * @spec.given an empty result set
     * @spec.when  page 1 is built
     * @spec.then  there is exactly one (empty) page; no next, no previous (no negative/zero pages)
     */
    @Test
    void offset_paginate_handles_an_empty_set() {
        OffsetPage<Integer> page = Paginators.offset(listSource(List.of()), 1, 10);

        assertThat(page.isEmpty()).isTrue();
        assertThat(page.lastPage()).isEqualTo(1);
        assertThat(page.hasNextPage()).isFalse();
        assertThat(page.hasPreviousPage()).isFalse();
    }

    /**
     * @spec.given 20 pages on page 10
     * @spec.when  the numbered-link window of 1-each-side is computed
     * @spec.then  it includes page 1, the last page, and the current ± 1 (the ellipsis pattern)
     */
    @Test
    void offset_link_window_spans_first_current_and_last() {
        OffsetPage<Integer> page = new OffsetPage<>(List.of(0), 10, 10, 200);

        assertThat(page.window(1)).containsExactly(1, 9, 10, 11, 20);
    }

    /**
     * @spec.given a cursor source that walks a large set 2 at a time without OFFSET
     * @spec.when  the first page and then the page after its next cursor are fetched
     * @spec.then  the walk advances by keyset (no offset arithmetic), exposing next/previous cursors
     */
    @Test
    void cursor_paginate_walks_a_large_set_without_offset() {
        // Keyset over the integers 1..1000: the cursor IS the last id seen, so depth has no cost.
        Paginators.CursorSource<Integer> source =
                (afterCursor, limit) -> {
                    int after = afterCursor == null ? 0 : Integer.parseInt(afterCursor);
                    List<Integer> items =
                            IntStream.rangeClosed(after + 1, Math.min(after + limit, 1000)).boxed().toList();
                    String next = items.isEmpty() || items.get(items.size() - 1) >= 1000
                            ? null
                            : String.valueOf(items.get(items.size() - 1));
                    String prev = after == 0 ? null : String.valueOf(after);
                    return new CursorPage<>(items, next, prev);
                };

        CursorPage<Integer> first = Paginators.cursor(source, null, 2);
        assertThat(first.items()).containsExactly(1, 2);
        assertThat(first.hasPreviousPage()).isFalse();
        assertThat(first.hasNextPage()).isTrue();

        CursorPage<Integer> second = Paginators.cursor(source, first.nextCursor(), 2);
        assertThat(second.items()).containsExactly(3, 4);
        assertThat(second.hasPreviousPage()).isTrue();
    }

    /**
     * @spec.given a default page state
     * @spec.when  nextPage, then previousPage, then gotoPage(5) run
     * @spec.then  the page tracks the navigation and never goes below 1
     */
    @Test
    void page_state_navigates_and_clamps_at_one() {
        PageState state = new PageState();
        assertThat(state.page()).isEqualTo(1);

        state.nextPage();
        assertThat(state.page()).isEqualTo(2);

        state.previousPage();
        state.previousPage(); // already at 1, must not go to 0
        assertThat(state.page()).isEqualTo(1);

        state.gotoPage(5);
        assertThat(state.page()).isEqualTo(5);
    }

    /**
     * @spec.given a page state on page 7
     * @spec.when  a bound filter changes and resetAll runs
     * @spec.then  the paginator jumps back to page 1 (page-reset-on-filter-change)
     */
    @Test
    void changing_a_filter_resets_to_page_one() {
        PageState state = new PageState();
        state.gotoPage(7);

        state.resetAll();

        assertThat(state.page()).isEqualTo(1);
    }

    /**
     * @spec.given two named paginators on one screen
     * @spec.when  each is navigated independently
     * @spec.then  they track separate page numbers (named pages)
     */
    @Test
    void named_pages_track_two_paginators_independently() {
        PageState state = new PageState();
        state.gotoPage("postsPage", 3);
        state.gotoPage("commentsPage", 5);

        assertThat(state.page("postsPage")).isEqualTo(3);
        assertThat(state.page("commentsPage")).isEqualTo(5);
        assertThat(state.page()).isEqualTo(1); // the default is untouched
    }
}
