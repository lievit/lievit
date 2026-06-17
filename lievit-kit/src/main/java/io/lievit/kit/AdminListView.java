/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit;

import java.util.ArrayList;
import java.util.List;

import org.jspecify.annotations.Nullable;

/**
 * The render view-model the kit derives from a {@link Resource} for the list page: the table
 * heading, the column {@link Header headers} (label + sort affordance), one {@link Row} per record
 * on the current page, the {@link Pagination} state, and the {@link Controls} (active search / sort
 * / filters / page-size options / empty-state / striping). Pure data, no engine knowledge: the JTE
 * template iterates it and stamps the row / create / delete actions against the {@link AdminRoutes}.
 *
 * <p>The read is <strong>bounded</strong>: the view reads a single {@link RecordRepository.Page}
 * through {@link RecordRepository#page}, never the whole table.
 *
 * @param heading the table heading
 * @param headerCells the column headers, in order (label + sort key + sort state)
 * @param rows one row per record on the current page
 * @param pagination the page state (current / total pages, totals, prev / next)
 * @param controls the active list controls (search / sort / filters / page sizes / empty-state)
 */
public record AdminListView(
        String heading,
        List<Header> headerCells,
        List<Row> rows,
        Pagination pagination,
        Controls controls) {

    /** Compact constructor: defends the lists. */
    public AdminListView {
        headerCells = List.copyOf(headerCells);
        rows = List.copyOf(rows);
    }

    /**
     * @return the column labels in order (convenience over {@link #headerCells()} for the simplest
     *     template that only prints labels)
     */
    public List<String> headers() {
        List<String> labels = new ArrayList<>();
        for (Header h : headerCells) {
            labels.add(h.label());
        }
        return labels;
    }

    /**
     * One column header: its label, its stable sort key, whether it is sortable, and the direction
     * it is currently sorted in (if any), so the template can draw the asc/desc indicator and the
     * sort link without recomputing.
     *
     * @param label the column header label
     * @param sortKey the stable sort key (the value a sort link sends back)
     * @param sortable whether this column is sortable
     * @param sortDirection the active sort direction for this column, or {@code null} if not sorted
     */
    public record Header(
            String label, String sortKey, boolean sortable, @Nullable SortDirection sortDirection) {

        /** @return whether this column is the (a) currently sorted column */
        public boolean isSorted() {
            return sortDirection != null;
        }
    }

    /**
     * The active list controls, for the template to render the search box, the filter panel, the
     * page-size selector, and the empty state without re-reading the table builder.
     *
     * @param search the active global search term (empty for none)
     * @param searchable whether the table has any searchable column
     * @param sort the active sort order
     * @param filters the active filter values
     * @param pageSizeOptions the records-per-page options
     * @param striped whether rows are striped
     * @param emptyStateHeading the heading shown when no row matches
     * @param emptyStateDescription the description shown when no row matches (may be null)
     */
    public record Controls(
            String search,
            boolean searchable,
            Sort sort,
            FilterState filters,
            List<Integer> pageSizeOptions,
            boolean striped,
            String emptyStateHeading,
            @Nullable String emptyStateDescription) {

        /** Compact constructor: defends the page-size list. */
        public Controls {
            pageSizeOptions = List.copyOf(pageSizeOptions);
        }
    }

    /**
     * One rendered row: its route id plus the ordered cell strings.
     *
     * @param id the row id (from the table id function)
     * @param cells the cell values, aligned with {@link #headers()}
     */
    public record Row(String id, List<String> cells) {
        /** Compact constructor: defends the cell list. */
        public Row {
            cells = List.copyOf(cells);
        }
    }

    /**
     * The pagination state for the rendered page: enough for the template to draw "page X of Y" and
     * prev / next links without recomputing anything.
     *
     * @param page the one-based current page number
     * @param size the page size
     * @param total the total matching row count across all pages
     * @param totalPages the total number of pages (at least 1, even when empty)
     */
    public record Pagination(int page, int size, long total, int totalPages) {

        /**
         * Derives the pagination state from a window and a total.
         *
         * @param page the one-based current page number
         * @param size the page size
         * @param total the total matching row count
         * @return the pagination state
         */
        public static Pagination of(int page, int size, long total) {
            int safeSize = size < 1 ? 1 : size;
            int pages = total <= 0 ? 1 : (int) Math.ceil((double) total / safeSize);
            int safePage = Math.min(Math.max(page, 1), pages);
            return new Pagination(safePage, safeSize, total, pages);
        }

        /** @return whether a previous page exists */
        public boolean hasPrevious() {
            return page > 1;
        }

        /** @return whether a next page exists */
        public boolean hasNext() {
            return page < totalPages;
        }

        /** @return the previous page number (clamped to the first page) */
        public int previousPage() {
            return Math.max(1, page - 1);
        }

        /** @return the next page number (clamped to the last page) */
        public int nextPage() {
            return Math.min(totalPages, page + 1);
        }
    }

    /**
     * Builds the list view-model by reading one bounded page of the resource's rows through its
     * repository port and its columns through its table builder, at the default page size.
     *
     * @param resource the admin resource
     * @param page the one-based page number to read
     * @param <T> the row type
     * @return the view-model
     */
    public static <T> AdminListView of(Resource<T> resource, int page) {
        return of(resource, page, RecordRepository.Query.DEFAULT_LIMIT);
    }

    /**
     * Builds the list view-model for a one-based page at a given page size (no sort/search/filter).
     *
     * @param resource the admin resource
     * @param page the one-based page number to read
     * @param size the page size
     * @param <T> the row type
     * @return the view-model
     */
    public static <T> AdminListView of(Resource<T> resource, int page, int size) {
        return of(resource, new ListRequest(page, size, Sort.NONE, "", FilterState.EMPTY));
    }

    /**
     * Builds the list view-model for a full list request: the requested page/size, sort, global
     * search, and filters are all carried on the bounded {@link RecordRepository.Query} the
     * repository reads.
     *
     * @param resource the admin resource
     * @param request the user-driven list state
     * @param <T> the row type
     * @return the view-model
     */
    public static <T> AdminListView of(Resource<T> resource, ListRequest request) {
        Table<T> table = resource.table();
        List<Column<T>> columns = table.columns();

        Sort effectiveSort = request.sort().isEmpty() ? table.defaultSort() : request.sort();

        List<Header> headerCells = new ArrayList<>();
        for (Column<T> column : columns) {
            SortDirection dir = effectiveSort.directionOf(column.sortKey()).orElse(null);
            headerCells.add(new Header(column.label(), column.sortKey(), column.sortable(), dir));
        }

        RecordRepository.Query query = request.toQuery().withSort(effectiveSort);
        RecordRepository.Page<T> dataPage = resource.repository().page(query);

        List<Row> rows = new ArrayList<>();
        for (T record : dataPage.rows()) {
            List<String> cells = new ArrayList<>();
            for (Column<T> column : columns) {
                cells.add(column.cell(record));
            }
            rows.add(new Row(table.idOf(record), cells));
        }

        String heading = table.heading() == null ? resource.label() : table.heading();
        Pagination pagination = Pagination.of(request.page(), request.size(), dataPage.total());
        Controls controls =
                new Controls(
                        request.search(),
                        table.hasSearchableColumns(),
                        effectiveSort,
                        request.filters(),
                        table.pageSizeOptions(),
                        table.isStriped(),
                        table.emptyStateHeading(),
                        table.emptyStateDescription());
        return new AdminListView(heading, headerCells, rows, pagination, controls);
    }
}
