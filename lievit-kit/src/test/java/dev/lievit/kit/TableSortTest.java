/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

/**
 * Specifies table sorting: a {@link Sort} carries one or more ordered column sorts, a header click
 * toggles a column's direction, the {@link RecordRepository.Query} carries the requested sort to
 * the repository, and {@link Table#defaultSort} seeds the initial order when the request has none
 * (the Filament {@code CanSortRecords} sort state, wired to the bounded query).
 */
class TableSortTest {

    /**
     * @spec.given a single ascending sort on a column
     * @spec.when  the direction for that column is read
     * @spec.then  it reports ascending
     */
    @Test
    void a_single_column_sort_reports_its_direction() {
        Sort sort = Sort.asc("city");

        assertThat(sort.directionOf("city")).contains(SortDirection.ASC);
        assertThat(sort.directionOf("ref")).isEmpty();
    }

    /**
     * @spec.given an ascending sort on a column
     * @spec.when  the same column header is toggled
     * @spec.then  the sort flips to descending on that column
     */
    @Test
    void toggling_a_sorted_header_flips_its_direction() {
        Sort sort = Sort.asc("city").toggled("city");

        assertThat(sort.directionOf("city")).contains(SortDirection.DESC);
    }

    /**
     * @spec.given a sort on one column
     * @spec.when  a different column header is toggled
     * @spec.then  the sort replaces it with that column ascending (single-column header click)
     */
    @Test
    void toggling_a_new_header_sorts_by_it_ascending() {
        Sort sort = Sort.desc("city").toggled("ref");

        assertThat(sort.directionOf("ref")).contains(SortDirection.ASC);
        assertThat(sort.directionOf("city")).isEmpty();
    }

    /**
     * @spec.given a primary sort
     * @spec.when  a secondary sort is appended with then(...)
     * @spec.then  both orders are kept, primary first (multi-column sort)
     */
    @Test
    void multi_column_sort_keeps_orders_primary_first() {
        Sort sort = Sort.asc("city").then("ref", SortDirection.DESC);

        assertThat(sort.orders())
                .extracting(Sort.Order::column)
                .containsExactly("city", "ref");
        assertThat(sort.orders().get(1).direction()).isEqualTo(SortDirection.DESC);
    }

    /**
     * @spec.given a request with no explicit sort and a table with a default sort
     * @spec.when  the list view is built
     * @spec.then  the default sort is applied and surfaced on the sorted column's header
     */
    @Test
    void default_sort_seeds_the_initial_order_when_request_has_none() {
        Resource<Row> resource = sortableResource();
        AdminListView view =
                AdminListView.of(resource, ListRequest.firstPage(10));

        AdminListView.Header city =
                view.headerCells().stream().filter(h -> h.sortKey().equals("city")).findFirst().orElseThrow();
        assertThat(city.isSorted()).isTrue();
        assertThat(city.sortDirection()).isEqualTo(SortDirection.DESC);
    }

    /**
     * @spec.given a sortable column and a request that toggles its sort
     * @spec.when  the list view is built
     * @spec.then  the query handed to the repository carries that sort direction
     */
    @Test
    void a_toggled_sort_reaches_the_repository_query() {
        java.util.concurrent.atomic.AtomicReference<RecordRepository.Query> seen =
                new java.util.concurrent.atomic.AtomicReference<>();
        Resource<Row> resource = capturingResource(seen);

        AdminListView.of(resource, ListRequest.firstPage(10).toggleSort("city"));

        assertThat(seen.get().sort().directionOf("city")).contains(SortDirection.ASC);
    }

    record Row(String city) {}

    private static Resource<Row> sortableResource() {
        return resource(
                q -> new RecordRepository.Page<>(java.util.List.of(new Row("Parma")), 1));
    }

    private static Resource<Row> capturingResource(
            java.util.concurrent.atomic.AtomicReference<RecordRepository.Query> seen) {
        return resource(
                q -> {
                    seen.set(q);
                    return new RecordRepository.Page<>(java.util.List.of(new Row("Parma")), 1);
                });
    }

    private static Resource<Row> resource(
            java.util.function.Function<RecordRepository.Query, RecordRepository.Page<Row>> pager) {
        RecordRepository<Row> repo =
                new RecordRepository<>() {
                    @Override
                    public Page<Row> page(Query query) {
                        return pager.apply(query);
                    }

                    @Override
                    public java.util.Optional<Row> findById(String id) {
                        return java.util.Optional.empty();
                    }

                    @Override
                    public Row create(Row record) {
                        return record;
                    }

                    @Override
                    public Row update(String id, Row record) {
                        return record;
                    }

                    @Override
                    public void delete(String id) {}
                };
        return new Resource<>(repo) {
            @Override
            public String slug() {
                return "rows";
            }

            @Override
            public String label() {
                return "Rows";
            }

            @Override
            public Table<Row> table() {
                return Table.<Row>create()
                        .defaultSort("city", SortDirection.DESC)
                        .column(TextColumn.make("City", Row::city).sortKey("city").makeSortable());
            }
        };
    }
}
