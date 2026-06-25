/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.pagination;

import java.util.List;

/**
 * An offset (LIMIT/OFFSET) page of results (issue #197, the Livewire {@code paginate()} analogue):
 * the items on the current page plus enough metadata to render pagination links. The page number is
 * 1-based (page 1 is the first), matching Livewire's {@code $page}. Offset pagination knows the
 * total, so it can render numbered links and a last page; its cost grows with the offset, which is
 * why a large/legacy table prefers {@link CursorPage} instead.
 *
 * <p>Pure value, zero Spring and zero JDBC (ADR-0007): the adopter's data layer produces the items
 * + total (via {@link Paginator}); this records the result. The window of numbered links to render is
 * derived by {@link #window(int)}.
 *
 * @param <T> the item type
 * @param items the items on the current page
 * @param page the current page number (1-based)
 * @param perPage the page size
 * @param total the total number of items across all pages
 */
public record OffsetPage<T>(List<T> items, int page, int perPage, long total) {

    /**
     * @param items the current page's items (defensively copied)
     * @param page the 1-based page number (must be &ge; 1)
     * @param perPage the page size (must be &ge; 1)
     * @param total the total item count (must be &ge; 0)
     */
    public OffsetPage {
        if (page < 1) {
            throw new IllegalArgumentException("page is 1-based and must be >= 1");
        }
        if (perPage < 1) {
            throw new IllegalArgumentException("perPage must be >= 1");
        }
        if (total < 0) {
            throw new IllegalArgumentException("total must be >= 0");
        }
        items = List.copyOf(items);
    }

    /**
     * @return the number of pages (at least 1, even when empty: page 1 of an empty list exists)
     */
    public int lastPage() {
        return total == 0 ? 1 : (int) ((total + perPage - 1) / perPage);
    }

    /**
     * @return true if there is a page after this one
     */
    public boolean hasNextPage() {
        return page < lastPage();
    }

    /**
     * @return true if there is a page before this one
     */
    public boolean hasPreviousPage() {
        return page > 1;
    }

    /**
     * @return the 0-based offset of the first item on this page (the SQL {@code OFFSET})
     */
    public long offset() {
        return (long) (page - 1) * perPage;
    }

    /**
     * @return true when this page has no items
     */
    public boolean isEmpty() {
        return items.isEmpty();
    }

    /**
     * The window of page numbers to render as links, centered on the current page (the
     * "1 ... 4 5 [6] 7 8 ... 20" pattern a pagination-link template walks). Always includes page 1 and
     * the last page; the caller renders gaps as ellipses.
     *
     * @param eachSide how many page links to show on each side of the current page
     * @return the page numbers to render, ascending, deduplicated, clamped to [1, lastPage]
     */
    public List<Integer> window(int eachSide) {
        int last = lastPage();
        java.util.TreeSet<Integer> pages = new java.util.TreeSet<>();
        pages.add(1);
        pages.add(last);
        for (int p = page - eachSide; p <= page + eachSide; p++) {
            if (p >= 1 && p <= last) {
                pages.add(p);
            }
        }
        return List.copyOf(pages);
    }
}
