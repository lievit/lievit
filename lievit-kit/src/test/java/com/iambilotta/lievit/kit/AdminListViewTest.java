/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package com.iambilotta.lievit.kit;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.Test;

/**
 * Specifies {@link AdminListView}: it derives the heading, column headers, and one row per record
 * <strong>on the requested page</strong> from a resource (reading a bounded
 * {@link RecordRepository.Page}, never the whole table), and computes the pagination state the
 * template renders.
 */
class AdminListViewTest {

    record City(int id, String name) {}

    static RecordRepository<City> repoOf(int count) {
        List<City> all = new ArrayList<>();
        for (int i = 1; i <= count; i++) {
            all.add(new City(i, "City " + i));
        }
        return new RecordRepository<>() {
            @Override
            public Page<City> page(Query query) {
                int from = Math.min(query.offset(), all.size());
                int to = Math.min(from + query.limit(), all.size());
                return Page.of(all.subList(from, to), all.size());
            }

            @Override
            public Optional<City> findById(String id) {
                return all.stream().filter(c -> String.valueOf(c.id()).equals(id)).findFirst();
            }

            @Override
            public City create(City record) {
                return record;
            }

            @Override
            public City update(String id, City record) {
                return record;
            }

            @Override
            public void delete(String id) {}
        };
    }

    static Resource<City> resourceOf(RecordRepository<City> repo) {
        return new Resource<>(repo) {
            @Override
            public String slug() {
                return "cities";
            }

            @Override
            public String label() {
                return "Cities";
            }

            @Override
            public Table<City> table() {
                return Table.<City>create()
                        .id(c -> String.valueOf(c.id()))
                        .column("Name", City::name);
            }
        };
    }

    /**
     * @spec.given a resource over 5 records and a page size of 2
     * @spec.when  the second page's view is built
     * @spec.then  it carries the two rows of that window and the headers from the columns
     * @spec.adr   ADR-0008
     */
    @Test
    void builds_one_bounded_page_of_rows_with_headers() {
        AdminListView view = AdminListView.of(resourceOf(repoOf(5)), 2, 2);

        assertThat(view.headers()).containsExactly("Name");
        assertThat(view.rows()).extracting(AdminListView.Row::id).containsExactly("3", "4");
        assertThat(view.rows().get(0).cells()).containsExactly("City 3");
    }

    /**
     * @spec.given 5 records and a page size of 2
     * @spec.when  the pagination is computed for page 2
     * @spec.then  it reports 3 total pages, has both a previous and a next page
     * @spec.adr   ADR-0008
     */
    @Test
    void computes_pagination_across_pages() {
        AdminListView view = AdminListView.of(resourceOf(repoOf(5)), 2, 2);

        AdminListView.Pagination pagination = view.pagination();
        assertThat(pagination.page()).isEqualTo(2);
        assertThat(pagination.totalPages()).isEqualTo(3);
        assertThat(pagination.hasPrevious()).isTrue();
        assertThat(pagination.hasNext()).isTrue();
        assertThat(pagination.nextPage()).isEqualTo(3);
        assertThat(pagination.previousPage()).isEqualTo(1);
    }

    /**
     * @spec.given an empty resource
     * @spec.when  the first page's view is built
     * @spec.then  it has no rows and reports exactly one (empty) page, never zero
     * @spec.adr   ADR-0008
     */
    @Test
    void an_empty_resource_still_reports_one_page() {
        AdminListView view = AdminListView.of(resourceOf(repoOf(0)), 1, 10);

        assertThat(view.rows()).isEmpty();
        assertThat(view.pagination().totalPages()).isEqualTo(1);
        assertThat(view.pagination().hasNext()).isFalse();
    }

    /**
     * @spec.given a resource and a page number past the end
     * @spec.when  the view is built for that page
     * @spec.then  the pagination clamps the page to the last real page
     * @spec.adr   ADR-0008
     */
    @Test
    void clamps_a_page_past_the_end_to_the_last_page() {
        AdminListView view = AdminListView.of(resourceOf(repoOf(3)), 99, 2);

        assertThat(view.pagination().page()).isEqualTo(2);
    }
}
