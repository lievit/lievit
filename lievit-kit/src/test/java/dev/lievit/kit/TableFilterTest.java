/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;

/**
 * Specifies the table filter family: {@link FilterState} carries name→value(s) immutably,
 * {@link SelectFilter} reads its selection back, {@link TernaryFilter} resolves a tri-state boolean,
 * and {@link TrashedFilter} resolves a soft-delete scope (the Filament {@code tables/Filters/*} +
 * {@code HasFilters}, carried on the bounded query for the repository to apply).
 */
class TableFilterTest {

    /**
     * @spec.given an empty filter state
     * @spec.when  a single value is set then read back
     * @spec.then  the filter is active and the value is returned (immutably, a new state)
     */
    @Test
    void filter_state_sets_and_reads_a_single_value() {
        FilterState state = FilterState.EMPTY.with("status", "active");

        assertThat(state.isActive("status")).isTrue();
        assertThat(state.value("status")).contains("active");
        assertThat(FilterState.EMPTY.isActive("status")).isFalse();
    }

    /**
     * @spec.given a filter state with a value
     * @spec.when  the filter is cleared with a blank value
     * @spec.then  the filter becomes inactive
     */
    @Test
    void filter_state_clears_a_filter_with_a_blank_value() {
        FilterState state = FilterState.EMPTY.with("status", "active").with("status", "");

        assertThat(state.isActive("status")).isFalse();
        assertThat(state.isEmpty()).isTrue();
    }

    /**
     * @spec.given a select filter with options
     * @spec.when  a state selecting one option is read
     * @spec.then  the filter reports the selected value
     */
    @Test
    void select_filter_reads_its_selection() {
        SelectFilter filter =
                SelectFilter.make("status").options(Map.of("active", "Active", "draft", "Draft"));
        FilterState state = FilterState.EMPTY.with("status", "active");

        assertThat(filter.selected(state)).containsExactly("active");
        assertThat(filter.options()).containsKeys("active", "draft");
    }

    /**
     * @spec.given a multi-select filter
     * @spec.when  several values are selected
     * @spec.then  all selected values are returned
     */
    @Test
    void multi_select_filter_carries_several_values() {
        SelectFilter filter = SelectFilter.make("tags").multiple();
        FilterState state = FilterState.EMPTY.with("tags", List.of("a", "b"));

        assertThat(filter.isMultiple()).isTrue();
        assertThat(filter.selected(state)).containsExactly("a", "b");
    }

    /**
     * @spec.given a ternary filter
     * @spec.when  the state is true, false, or absent
     * @spec.then  it resolves to Optional of true / false / empty (the "all" state)
     */
    @Test
    void ternary_filter_resolves_a_tri_state_boolean() {
        TernaryFilter filter = TernaryFilter.make("verified");

        assertThat(filter.resolve(FilterState.EMPTY.with("verified", TernaryFilter.TRUE)))
                .contains(Boolean.TRUE);
        assertThat(filter.resolve(FilterState.EMPTY.with("verified", TernaryFilter.FALSE)))
                .contains(Boolean.FALSE);
        assertThat(filter.resolve(FilterState.EMPTY)).isEmpty();
    }

    /**
     * @spec.given a trashed filter
     * @spec.when  the state is absent, "with", or "only"
     * @spec.then  it resolves without-trashed (default) / with-trashed / only-trashed
     */
    @Test
    void trashed_filter_resolves_a_soft_delete_scope() {
        TrashedFilter filter = TrashedFilter.make();

        assertThat(filter.scope(FilterState.EMPTY)).isEqualTo(TrashedFilter.Scope.WITHOUT_TRASHED);
        assertThat(filter.scope(FilterState.EMPTY.with(TrashedFilter.DEFAULT_NAME, "with")))
                .isEqualTo(TrashedFilter.Scope.WITH_TRASHED);
        assertThat(filter.scope(FilterState.EMPTY.with(TrashedFilter.DEFAULT_NAME, "only")))
                .isEqualTo(TrashedFilter.Scope.ONLY_TRASHED);
    }

    /**
     * @spec.given a list request with active filters
     * @spec.when  the bounded query is built
     * @spec.then  the filter state reaches the query for the repository to apply
     */
    @Test
    void filters_reach_the_bounded_query() {
        FilterState filters = FilterState.EMPTY.with("status", "active");
        RecordRepository.Query query =
                ListRequest.firstPage(10).withFilters(filters).toQuery();

        assertThat(query.filters().value("status")).contains("active");
    }

    /**
     * @spec.given a table builder
     * @spec.when  filters are registered
     * @spec.then  the table exposes them in declaration order
     */
    @Test
    void table_registers_filters_in_order() {
        Table<String> table =
                Table.<String>create()
                        .filters(SelectFilter.make("status"), TernaryFilter.make("verified"));

        assertThat(table.filters()).extracting(Filter::name).containsExactly("status", "verified");
    }
}
