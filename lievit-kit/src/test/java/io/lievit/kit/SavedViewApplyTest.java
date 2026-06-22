/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import org.junit.jupiter.api.Test;

/**
 * Specifies the {@link SavedViews} apply/capture bridge: a view becomes the first-page list request
 * that renders it, the current list state captures back into a view, and the dirty check spots a
 * drift from the active view (the Salesforce "list view has unsaved changes" indicator).
 */
class SavedViewApplyTest {

    /**
     * @spec.given a view with filters, a sort and a page size
     * @spec.when  it is applied with a default size
     * @spec.then  the list request carries its sort/size/filters on page 1, no search
     */
    @Test
    void applying_a_view_builds_its_first_page_request() {
        FilterState filters = FilterState.EMPTY.with("status", "open");
        SavedView view =
                SavedView.user("v1", "activities", "ada", "Open", filters, List.of(),
                        Sort.desc("due"), 25, false);

        ListRequest request = SavedViews.apply(view, 10);

        assertThat(request.page()).isEqualTo(1);
        assertThat(request.size()).isEqualTo(25);
        assertThat(request.sort()).isEqualTo(Sort.desc("due"));
        assertThat(request.search()).isEmpty();
        assertThat(request.filters()).isEqualTo(filters);
    }

    /**
     * @spec.given a view with no page size declared (0)
     * @spec.when  it is applied with a default size
     * @spec.then  the request uses the supplied default size
     */
    @Test
    void applying_a_sizeless_view_falls_back_to_the_default_size() {
        SavedView view =
                SavedView.user("v1", "activities", "ada", "All", FilterState.EMPTY, List.of(),
                        Sort.NONE, 0, false);

        assertThat(SavedViews.apply(view, 50).size()).isEqualTo(50);
    }

    /**
     * @spec.given a list request with filters, a sort and a size
     * @spec.when  it is captured into a named user view with a column order
     * @spec.then  re-applying the captured view reproduces the same filters/sort/size (round-trip)
     */
    @Test
    void capture_then_apply_round_trips_the_facets() {
        FilterState filters = FilterState.EMPTY.with("kind", "call");
        ListRequest original = new ListRequest(3, 25, Sort.asc("name"), "ignored", filters);

        SavedView captured =
                SavedViews.capture("v9", "activities", "ada", "My view", original,
                        List.of("name", "kind"), false);

        assertThat(captured.name()).isEqualTo("My view");
        assertThat(captured.visibleColumns()).containsExactly("name", "kind");

        ListRequest reapplied = SavedViews.apply(captured, 10);
        assertThat(reapplied.size()).isEqualTo(25);
        assertThat(reapplied.sort()).isEqualTo(Sort.asc("name"));
        assertThat(reapplied.filters()).isEqualTo(filters);
    }

    /**
     * @spec.given a view applied verbatim
     * @spec.when  the dirty check compares that request to the view
     * @spec.then  it reports clean; changing a facet reports dirty; a null view is never dirty
     */
    @Test
    void dirty_spots_a_drift_from_the_active_view() {
        SavedView view =
                SavedView.user("v1", "activities", "ada", "Open",
                        FilterState.EMPTY.with("status", "open"), List.of(), Sort.desc("due"), 25,
                        false);

        ListRequest clean = SavedViews.apply(view, 10);
        assertThat(SavedViews.isDirty(view, clean, 10)).isFalse();

        ListRequest tweaked = clean.withFilters(FilterState.EMPTY.with("status", "closed"));
        assertThat(SavedViews.isDirty(view, tweaked, 10)).isTrue();

        assertThat(SavedViews.isDirty(null, clean, 10)).isFalse();
    }
}
