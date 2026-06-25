/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.pagination;

import java.util.List;

import org.jspecify.annotations.Nullable;

/**
 * A cursor (keyset) page of results (issue #197, the Livewire {@code cursorPaginate()} analogue): the
 * items on the current page plus an opaque {@code nextCursor} / {@code previousCursor} the client
 * carries to walk forward / back. Keyset pagination does NOT compute a total or numbered pages: it
 * pages by "the rows after key K", whose cost is constant regardless of depth, which is why it is the
 * right tool for the gestionale's large legacy tables where {@code OFFSET} is a performance trap.
 *
 * <p>A cursor is an opaque token the data layer encodes from the last row's key columns (e.g. a
 * {@code created_at,id} pair); lievit does not interpret it. {@code null} means "no further page in
 * that direction" (the start / end of the set). Pure value, zero Spring and zero JDBC (ADR-0007).
 *
 * @param <T> the item type
 * @param items the items on the current page
 * @param nextCursor the cursor to fetch the next page, or {@code null} if this is the last page
 * @param previousCursor the cursor to fetch the previous page, or {@code null} if this is the first
 */
public record CursorPage<T>(
        List<T> items, @Nullable String nextCursor, @Nullable String previousCursor) {

    /**
     * @param items the current page's items (defensively copied)
     * @param nextCursor the forward cursor, or {@code null} at the end of the set
     * @param previousCursor the backward cursor, or {@code null} at the start of the set
     */
    public CursorPage {
        items = List.copyOf(items);
    }

    /**
     * @return true if there is a page after this one (a forward cursor exists)
     */
    public boolean hasNextPage() {
        return nextCursor != null && !nextCursor.isBlank();
    }

    /**
     * @return true if there is a page before this one (a backward cursor exists)
     */
    public boolean hasPreviousPage() {
        return previousCursor != null && !previousCursor.isBlank();
    }

    /**
     * @return true when this page has no items
     */
    public boolean isEmpty() {
        return items.isEmpty();
    }

    /**
     * The first page of a cursor walk (no previous cursor).
     *
     * @param items the first page's items
     * @param nextCursor the cursor to the next page, or {@code null} if the only page
     * @param <T> the item type
     * @return a first cursor page
     */
    public static <T> CursorPage<T> first(List<T> items, @Nullable String nextCursor) {
        return new CursorPage<>(items, nextCursor, null);
    }
}
