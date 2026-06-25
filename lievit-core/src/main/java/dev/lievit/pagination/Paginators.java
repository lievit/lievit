/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.pagination;

import java.util.List;

import org.jspecify.annotations.Nullable;

/**
 * Builds {@link OffsetPage} / {@link CursorPage} results from an adopter's data layer (issue #197).
 * lievit assumes no ORM (JDBC / Flyway is the gestionale's rule), so a paginator is composed from two
 * small SPIs the adopter implements against its own query:
 *
 * <ul>
 *   <li>{@link OffsetSource} — {@code count()} + {@code slice(offset, limit)} for offset pagination;
 *   <li>{@link CursorSource} — {@code page(afterCursor, limit)} for keyset/cursor pagination.
 * </ul>
 *
 * The component holds {@code $page} (offset) or the current cursor (keyset) as a {@code @Wire} field
 * and calls {@link #offset} / {@link #cursor} in its render to produce the page the template walks.
 * Pure helper, zero Spring and zero JDBC (ADR-0007).
 */
public final class Paginators {

    private Paginators() {}

    /**
     * The offset-pagination data SPI: total count + a slice. The adopter implements it over its own
     * {@code SELECT ... LIMIT ? OFFSET ?} (and a {@code SELECT count(*)}).
     *
     * @param <T> the row type
     */
    public interface OffsetSource<T> {

        /**
         * @return the total number of rows across all pages (for the last-page / numbered links)
         */
        long count();

        /**
         * @param offset the 0-based row offset (the SQL {@code OFFSET})
         * @param limit the page size (the SQL {@code LIMIT})
         * @return the rows in that window
         */
        List<T> slice(long offset, int limit);
    }

    /**
     * The cursor-pagination data SPI: one keyset page. The adopter implements it over its own
     * {@code SELECT ... WHERE (key) > (cursor) ORDER BY key LIMIT ?} and encodes the next/previous
     * cursors from the page's boundary rows.
     *
     * @param <T> the row type
     */
    public interface CursorSource<T> {

        /**
         * Fetches one keyset page after a cursor.
         *
         * @param afterCursor the opaque cursor to page after, or {@code null} for the first page
         * @param limit the page size
         * @return the keyset page (items + next/previous cursors)
         */
        CursorPage<T> page(@Nullable String afterCursor, int limit);
    }

    /**
     * Builds an offset page for the current 1-based page number from the source.
     *
     * @param source the offset data source
     * @param page the current 1-based page number
     * @param perPage the page size
     * @param <T> the row type
     * @return the offset page (items + page metadata)
     */
    public static <T> OffsetPage<T> offset(OffsetSource<T> source, int page, int perPage) {
        if (page < 1) {
            throw new IllegalArgumentException("page is 1-based and must be >= 1");
        }
        long total = source.count();
        long offset = (long) (page - 1) * perPage;
        List<T> items = offset >= total ? List.of() : source.slice(offset, perPage);
        return new OffsetPage<>(items, page, perPage, total);
    }

    /**
     * Builds a cursor page after a cursor from the source.
     *
     * @param source the cursor data source
     * @param afterCursor the cursor to page after, or {@code null} for the first page
     * @param perPage the page size
     * @param <T> the row type
     * @return the cursor page (items + next/previous cursors)
     */
    public static <T> CursorPage<T> cursor(
            CursorSource<T> source, @Nullable String afterCursor, int perPage) {
        return source.page(afterCursor, perPage);
    }
}
