/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.pagination;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * The {@code $page} state for one or more paginators on a screen (issue #197): a 1-based page number
 * per paginator name, with {@code nextPage} / {@code previousPage} / {@code gotoPage} mutations and a
 * {@code resetAll} for the page-reset-on-filter-change rule (when a bound filter changes, the list
 * jumps back to page 1 so the user is not stranded on an out-of-range page). A single-paginator screen
 * uses the default name; multiple paginators on one screen each carry their own name (Livewire's named
 * pages, e.g. {@code postsPage}, {@code commentsPage}).
 *
 * <p>This is the offset-pagination state; cursor pagination carries an opaque cursor instead and does
 * not use page numbers. A component holds a {@code PageState} (or a single {@code @Wire @LievitUrl int
 * page} for the simple case) and binds it to the query string via {@code @LievitUrl} so the page
 * survives a reload and the back button (the URL sync rides the existing {@code url} effect, no new
 * wire marker). Pure value, zero Spring (ADR-0007). Not thread-safe (a component instance is per-call).
 */
public final class PageState {

    /** The paginator name used when a screen has a single, unnamed paginator. */
    public static final String DEFAULT = "page";

    private final Map<String, Integer> pages = new LinkedHashMap<>();

    /** A page state with the default paginator on page 1. */
    public PageState() {
        pages.put(DEFAULT, 1);
    }

    /**
     * @return the current page number of the default paginator (1-based)
     */
    public int page() {
        return page(DEFAULT);
    }

    /**
     * @param name the paginator name
     * @return the current page number of that paginator (1-based; 1 if never set)
     */
    public int page(String name) {
        return pages.getOrDefault(name, 1);
    }

    /**
     * Goes to a specific page of the default paginator.
     *
     * @param page the 1-based target page (clamped to &ge; 1)
     */
    public void gotoPage(int page) {
        gotoPage(DEFAULT, page);
    }

    /**
     * Goes to a specific page of a named paginator.
     *
     * @param name the paginator name
     * @param page the 1-based target page (clamped to &ge; 1)
     */
    public void gotoPage(String name, int page) {
        pages.put(name, Math.max(1, page));
    }

    /** Advances the default paginator by one page. */
    public void nextPage() {
        nextPage(DEFAULT);
    }

    /**
     * Advances a named paginator by one page.
     *
     * @param name the paginator name
     */
    public void nextPage(String name) {
        gotoPage(name, page(name) + 1);
    }

    /** Moves the default paginator back one page (never below page 1). */
    public void previousPage() {
        previousPage(DEFAULT);
    }

    /**
     * Moves a named paginator back one page (never below page 1).
     *
     * @param name the paginator name
     */
    public void previousPage(String name) {
        gotoPage(name, page(name) - 1);
    }

    /**
     * Resets every paginator to page 1 (the page-reset-on-filter-change rule). A component calls this
     * from an {@code updated{filter}} hook (or its filter setter) so changing a bound filter jumps
     * back to the first page instead of stranding the user on a now-out-of-range page.
     */
    public void resetAll() {
        for (String name : pages.keySet()) {
            pages.put(name, 1);
        }
    }

    /**
     * Resets one named paginator to page 1.
     *
     * @param name the paginator name
     */
    public void reset(String name) {
        pages.put(name, 1);
    }
}
