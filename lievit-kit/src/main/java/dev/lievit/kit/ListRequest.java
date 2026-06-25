/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit;

import java.util.Objects;

import org.jspecify.annotations.Nullable;

/**
 * The user-driven state of a list page: which page at what size, the active sort, the global search
 * term, and the active filters (the union of Filament's {@code CanPaginateRecords} /
 * {@code CanSortRecords} / {@code CanSearchRecords} / {@code HasFilters} Livewire properties).
 *
 * <p>A component holds these as {@code @Wire} fields (page, size, search, a serialized sort/filter)
 * and assembles a {@code ListRequest} to hand to {@link AdminListView#of(Resource, ListRequest)},
 * which turns it into the bounded {@link RecordRepository.Query}. Immutable; {@code with*} builders
 * return a new request so an action can toggle one facet without rebuilding the whole thing.
 *
 * @param page the one-based page number
 * @param size the page size (a non-positive value means "all", capped to a large window)
 * @param sort the active sort order
 * @param search the global search term (empty for none)
 * @param filters the active filter values
 */
public record ListRequest(int page, int size, Sort sort, String search, FilterState filters) {

    /** Compact constructor: clamps the page and defends the facets. */
    public ListRequest {
        if (page < 1) {
            page = 1;
        }
        sort = sort == null ? Sort.NONE : sort;
        search = search == null ? "" : search;
        filters = filters == null ? FilterState.EMPTY : filters;
    }

    /**
     * The default first-page request at a given size, no sort/search/filter.
     *
     * @param size the page size
     * @return the request
     */
    public static ListRequest firstPage(int size) {
        return new ListRequest(1, size, Sort.NONE, "", FilterState.EMPTY);
    }

    /**
     * @param newPage the one-based page number
     * @return a copy on that page
     */
    public ListRequest withPage(int newPage) {
        return new ListRequest(newPage, size, sort, search, filters);
    }

    /**
     * @param newSize the page size
     * @return a copy at that size, reset to the first page (the page count changed)
     */
    public ListRequest withSize(int newSize) {
        return new ListRequest(1, newSize, sort, search, filters);
    }

    /**
     * Toggles the single-column sort for a clicked header, resetting to the first page.
     *
     * @param column the clicked column sort key
     * @return a copy with the toggled sort, on page 1
     */
    public ListRequest toggleSort(String column) {
        return new ListRequest(1, size, sort.toggled(column), search, filters);
    }

    /**
     * @param term the global search term
     * @return a copy searching for that term, on page 1 (the result set changed)
     */
    public ListRequest withSearch(@Nullable String term) {
        return new ListRequest(1, size, sort, term == null ? "" : term, filters);
    }

    /**
     * @param newFilters the active filter values
     * @return a copy with those filters, on page 1
     */
    public ListRequest withFilters(FilterState newFilters) {
        return new ListRequest(1, size, sort, search, Objects.requireNonNull(newFilters, "newFilters"));
    }

    /**
     * Turns this request into the bounded repository query for the page.
     *
     * @return the query window with sort/search/filter applied
     */
    public RecordRepository.Query toQuery() {
        int effectiveSize = size < 1 ? Integer.MAX_VALUE : size;
        return RecordRepository.Query.page(page, effectiveSize)
                .withSort(sort)
                .withSearch(search)
                .withFilters(filters);
    }
}
