/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package com.iambilotta.lievit.kit;

import java.util.List;
import java.util.Optional;

/**
 * The persistence-agnostic data port for an {@link Resource} (the filament-internals.md lesson:
 * never hard-code {@code JdbcClient} or {@code JpaRepository}; the adopter wires the data).
 *
 * <p>Filament couples its whole data path to {@code getEloquentQuery()}; lievit-kit refuses that
 * coupling. A resource declares the row type {@code <T>} and the kit reads and writes rows only
 * through this interface, so the same admin works over JDBC, JPA, an HTTP backend, or an in-memory
 * list. The adopter provides the implementation as a bean and the resource holds a reference to it.
 *
 * <p>The read path is <strong>bounded</strong>: the list page reads a single {@link Page} through
 * {@link #page(Query)}, never the whole table at once (an unbounded {@code findAll} over a large
 * table is the classic admin foot-gun). The write path is {@link #create}, {@link #update},
 * {@link #delete}.
 *
 * @param <T> the row type the resource manages
 */
public interface RecordRepository<T> {

    /**
     * Reads one bounded page of rows for the table view.
     *
     * <p>This is the only read the list page issues: the kit never loads the whole table. The
     * implementation honours the {@link Query#offset()} / {@link Query#limit()} window and reports
     * the unfiltered (well, query-filtered) {@link Page#total()} so the kit can render pagination.
     *
     * @param query the page window (offset + limit)
     * @return the requested page (rows in the repository's natural order, plus the total count)
     */
    Page<T> page(Query query);

    /**
     * Looks up a single row by its string id (the value {@link Table#id(java.util.function.Function)}
     * derives from a row).
     *
     * @param id the row id
     * @return the row, or empty if no row has that id
     */
    Optional<T> findById(String id);

    /**
     * Persists a brand-new row.
     *
     * @param record the new row, built by the {@link Form} from validated form state
     * @return the persisted row (the implementation may enrich it, e.g. with a generated id)
     */
    T create(T record);

    /**
     * Persists changes to an existing row.
     *
     * @param id the id of the row being edited
     * @param record the new row state, built by the {@link Form} from validated form state
     * @return the persisted row
     */
    T update(String id, T record);

    /**
     * Deletes the row with the given id. A no-op if no such row exists (idempotent).
     *
     * @param id the row id
     */
    void delete(String id);

    /**
     * Reads all rows, unbounded.
     *
     * <p>Retained for the small, fixed-size relation case ({@link BelongsToField} option lists) and
     * for in-memory adopters. The table view does <strong>not</strong> call this; it pages through
     * {@link #page(Query)}. The default delegates to a single large page so an adopter that only
     * implements {@code page} still answers it.
     *
     * @return all rows, in the repository's natural order
     */
    default List<T> findAll() {
        return page(Query.of(0, Integer.MAX_VALUE)).rows();
    }

    /**
     * The read window for {@link #page(Query)}: a zero-based row offset and a maximum row count.
     *
     * <p>Deliberately minimal in v0.1 (offset + limit). Sort and filter ride here in a later slice;
     * keeping the query as its own type means adding them is not a signature break.
     *
     * @param offset the zero-based index of the first row to return (clamped to {@code >= 0})
     * @param limit the maximum number of rows to return (clamped to {@code >= 1})
     */
    record Query(int offset, int limit) {

        /** The default page size when a list page does not specify one. */
        public static final int DEFAULT_LIMIT = 25;

        /**
         * Compact constructor: clamps the window to a sane range so a hostile or empty page
         * parameter can never produce a negative offset or a non-positive limit.
         */
        public Query {
            if (offset < 0) {
                offset = 0;
            }
            if (limit < 1) {
                limit = 1;
            }
        }

        /**
         * @param offset the zero-based first-row index
         * @param limit the maximum row count
         * @return a query window
         */
        public static Query of(int offset, int limit) {
            return new Query(offset, limit);
        }

        /**
         * Builds the window for a one-based page number at the default page size.
         *
         * @param pageNumber the one-based page number ({@code 1} is the first page; lower values
         *     clamp to the first page)
         * @return the window for that page
         */
        public static Query page(int pageNumber) {
            return page(pageNumber, DEFAULT_LIMIT);
        }

        /**
         * Builds the window for a one-based page number at a given page size.
         *
         * @param pageNumber the one-based page number ({@code 1} is the first page)
         * @param size the page size
         * @return the window for that page
         */
        public static Query page(int pageNumber, int size) {
            int safeSize = size < 1 ? 1 : size;
            int safePage = pageNumber < 1 ? 1 : pageNumber;
            return new Query((safePage - 1) * safeSize, safeSize);
        }
    }

    /**
     * One bounded slice of rows plus the total row count, the shape the list page renders pagination
     * from.
     *
     * @param rows the rows in this window (size {@code <= } the query limit)
     * @param total the total number of rows the query matches across all pages
     * @param <T> the row type
     */
    record Page<T>(List<T> rows, long total) {

        /**
         * Compact constructor: defends the row list and rejects a negative total.
         */
        public Page {
            rows = List.copyOf(rows);
            if (total < 0) {
                throw new IllegalArgumentException("total must be >= 0, got: " + total);
            }
        }

        /**
         * @param rows the rows in this window
         * @param total the total matching row count
         * @param <T> the row type
         * @return a page
         */
        public static <T> Page<T> of(List<T> rows, long total) {
            return new Page<>(rows, total);
        }

        /** @return whether this page carries no rows */
        public boolean isEmpty() {
            return rows.isEmpty();
        }
    }
}
