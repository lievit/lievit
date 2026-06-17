/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package com.iambilotta.lievit.kit;

import java.util.ArrayList;
import java.util.List;

/**
 * The render view-model the kit derives from a {@link Resource} for the list page: the table
 * heading, the column headers, one {@link Row} per record on the current page, and the
 * {@link Pagination} state. Pure data, no engine knowledge: the JTE template iterates it and stamps
 * the row / create / delete actions against the {@link AdminRoutes}.
 *
 * <p>The read is <strong>bounded</strong>: the view reads a single {@link RecordRepository.Page}
 * through {@link RecordRepository#page}, never the whole table.
 *
 * @param heading the table heading
 * @param headers the column labels, in order
 * @param rows one row per record on the current page
 * @param pagination the page state (current / total pages, totals, prev / next)
 */
public record AdminListView(
        String heading, List<String> headers, List<Row> rows, Pagination pagination) {

    /** Compact constructor: defends the lists. */
    public AdminListView {
        headers = List.copyOf(headers);
        rows = List.copyOf(rows);
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
     * repository port and its columns through its table builder.
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
     * Builds the list view-model for a one-based page at a given page size.
     *
     * @param resource the admin resource
     * @param page the one-based page number to read
     * @param size the page size
     * @param <T> the row type
     * @return the view-model
     */
    public static <T> AdminListView of(Resource<T> resource, int page, int size) {
        Table<T> table = resource.table();
        List<Column<T>> columns = table.columns();

        List<String> headers = new ArrayList<>();
        for (Column<T> column : columns) {
            headers.add(column.label());
        }

        RecordRepository.Query query = RecordRepository.Query.page(page, size);
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
        Pagination pagination = Pagination.of(page, size, dataPage.total());
        return new AdminListView(heading, headers, rows, pagination);
    }
}
