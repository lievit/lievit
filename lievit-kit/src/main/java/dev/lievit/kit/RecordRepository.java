/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit;

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
     * Reads up to {@code limit} rows whose {@code label} matches the search {@code term}, the
     * <strong>lazy</strong> read path of a searchable relation field ({@link BelongsToField} in
     * {@code searchable} + non-{@code preload} mode, roadmap K5). This is the server-side narrowing a
     * 10k-row {@code persone} / {@code immobili} relationship needs: typing a few characters in the
     * combobox queries the backend with a {@code LIMIT}, so the option catalog never loads all rows
     * every render (the {@code getSearchResultsUsing} closure of Filament's {@code Select}).
     *
     * <p>The default is correct but unbounded at the read: it filters {@link #findAll()} by a
     * case-insensitive {@code contains} on the {@code label} the field supplies, then caps the result
     * at {@code limit}. That keeps every existing repository working without a code change (small
     * sets are fine). A real adopter over a large table <strong>overrides</strong> this with a
     * {@code WHERE label ILIKE ? LIMIT ?} query so the database does the narrowing.
     *
     * <p>An empty / blank {@code term} returns the first {@code limit} rows (the preload-less combobox
     * shows a bounded head of the catalog before the user types).
     *
     * @param term the search term typed into the combobox (empty returns the bounded head)
     * @param limit the maximum number of rows to return (clamped to {@code >= 1})
     * @param label extracts the searchable label from a row (the text the {@code term} matches)
     * @return up to {@code limit} matching rows, in the repository's natural order
     */
    default List<T> search(
            String term, int limit, java.util.function.Function<T, String> label) {
        java.util.Objects.requireNonNull(label, "label");
        int cap = limit < 1 ? 1 : limit;
        String needle = term == null ? "" : term.trim().toLowerCase(java.util.Locale.ROOT);
        List<T> matched = new java.util.ArrayList<>(cap);
        for (T row : findAll()) {
            if (needle.isEmpty()
                    || label.apply(row).toLowerCase(java.util.Locale.ROOT).contains(needle)) {
                matched.add(row);
                if (matched.size() >= cap) {
                    break;
                }
            }
        }
        return List.copyOf(matched);
    }

    /**
     * The read window for {@link #page(Query)}: a zero-based row offset and a maximum row count,
     * plus the requested {@link Sort sort order}, global {@link #search() search term}, and active
     * {@link FilterState filters}. The kit never executes the sort/search/filter: it carries the
     * intent here so the adopter's repository translates it to SQL (or an in-memory operation).
     *
     * <p>The {@code offset}/{@code limit} factories ({@link #of}, {@link #page}) build a plain
     * paginated window with no sort/search/filter; the {@code with*} builders add those facets
     * without a signature break (this was always the design intent of keeping the query its own
     * type).
     *
     * @param offset the zero-based index of the first row to return (clamped to {@code >= 0})
     * @param limit the maximum number of rows to return (clamped to {@code >= 1})
     * @param sort the requested column sort order ({@link Sort#NONE} for the repository's natural
     *     order)
     * @param search the global search term applied across searchable columns (empty for none)
     * @param filters the active filter values ({@link FilterState#EMPTY} for none)
     */
    record Query(int offset, int limit, Sort sort, String search, FilterState filters) {

        /** The default page size when a list page does not specify one. */
        public static final int DEFAULT_LIMIT = 25;

        /**
         * Compact constructor: clamps the window to a sane range so a hostile or empty page
         * parameter can never produce a negative offset or a non-positive limit, and defends the
         * sort/search/filter facets against null.
         */
        public Query {
            if (offset < 0) {
                offset = 0;
            }
            if (limit < 1) {
                limit = 1;
            }
            sort = sort == null ? Sort.NONE : sort;
            search = search == null ? "" : search;
            filters = filters == null ? FilterState.EMPTY : filters;
        }

        /**
         * @param offset the zero-based first-row index
         * @param limit the maximum row count
         * @return a query window with no sort/search/filter
         */
        public static Query of(int offset, int limit) {
            return new Query(offset, limit, Sort.NONE, "", FilterState.EMPTY);
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
            return new Query(
                    (safePage - 1) * safeSize, safeSize, Sort.NONE, "", FilterState.EMPTY);
        }

        /**
         * @param newSort the requested sort order
         * @return a copy of this window with the given sort
         */
        public Query withSort(Sort newSort) {
            return new Query(offset, limit, newSort, search, filters);
        }

        /**
         * @param term the global search term
         * @return a copy of this window with the given search term
         */
        public Query withSearch(String term) {
            return new Query(offset, limit, sort, term, filters);
        }

        /**
         * @param newFilters the active filter values
         * @return a copy of this window with the given filters
         */
        public Query withFilters(FilterState newFilters) {
            return new Query(offset, limit, sort, search, newFilters);
        }

        /** @return whether a non-blank global search term is set */
        public boolean hasSearch() {
            return !search.isBlank();
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
