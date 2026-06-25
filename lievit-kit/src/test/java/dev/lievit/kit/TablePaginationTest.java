/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

/**
 * Specifies table pagination controls: the {@link Table} declares a default page size and the
 * page-size options, a {@link ListRequest} changes page/size while resetting to page 1 on a size
 * change, the "all" size maps to an unbounded window, and the view's controls surface the options
 * (the Filament {@code CanPaginateRecords}, wired to the bounded query).
 */
class TablePaginationTest {

    /**
     * @spec.given a table builder
     * @spec.when  a default page size and options are declared
     * @spec.then  the table exposes them
     */
    @Test
    void table_declares_page_size_and_options() {
        Table<String> table =
                Table.<String>create().defaultPaginationPageOption(25).paginationPageOptions(25, 50, 100);

        assertThat(table.defaultPageSize()).isEqualTo(25);
        assertThat(table.pageSizeOptions()).containsExactly(25, 50, 100);
    }

    /**
     * @spec.given a request on page 3
     * @spec.when  the page size is changed
     * @spec.then  the request resets to page 1 (the page count changed under it)
     */
    @Test
    void changing_the_page_size_resets_to_the_first_page() {
        ListRequest request = ListRequest.firstPage(10).withPage(3).withSize(50);

        assertThat(request.page()).isEqualTo(1);
        assertThat(request.size()).isEqualTo(50);
    }

    /**
     * @spec.given a request with a non-positive ("all") page size
     * @spec.when  the bounded query is built
     * @spec.then  the limit is the maximum window (the whole result set)
     */
    @Test
    void the_all_page_size_maps_to_an_unbounded_window() {
        RecordRepository.Query query = ListRequest.firstPage(0).toQuery();

        assertThat(query.limit()).isEqualTo(Integer.MAX_VALUE);
    }

    /**
     * @spec.given a total of 5 rows at a page size of 2
     * @spec.when  the pagination state is derived
     * @spec.then  it reports 3 pages with a working prev/next
     */
    @Test
    void pagination_reports_page_count_and_navigation() {
        AdminListView.Pagination pagination = AdminListView.Pagination.of(2, 2, 5);

        assertThat(pagination.totalPages()).isEqualTo(3);
        assertThat(pagination.hasPrevious()).isTrue();
        assertThat(pagination.hasNext()).isTrue();
        assertThat(pagination.nextPage()).isEqualTo(3);
        assertThat(pagination.previousPage()).isEqualTo(1);
    }

    /**
     * @spec.given a table declaring its page-size options
     * @spec.when  the list view is built
     * @spec.then  the controls surface those options for the page-size selector
     */
    @Test
    void controls_surface_the_page_size_options() {
        Resource<String> resource = resourceWithOptions();

        AdminListView view = AdminListView.of(resource, ListRequest.firstPage(25));

        assertThat(view.controls().pageSizeOptions()).containsExactly(25, 50);
    }

    private static Resource<String> resourceWithOptions() {
        RecordRepository<String> repo =
                new RecordRepository<>() {
                    @Override
                    public Page<String> page(Query query) {
                        return Page.of(java.util.List.of("a"), 1);
                    }

                    @Override
                    public java.util.Optional<String> findById(String id) {
                        return java.util.Optional.empty();
                    }

                    @Override
                    public String create(String record) {
                        return record;
                    }

                    @Override
                    public String update(String id, String record) {
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
            public Table<String> table() {
                return Table.<String>create().paginationPageOptions(25, 50).column("Value", s -> s);
            }
        };
    }
}
