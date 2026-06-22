/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit;

import java.util.List;

import org.jspecify.annotations.Nullable;

/**
 * The pure apply/capture bridge between a {@link SavedView} and a {@link ListRequest}: turning a view
 * into the list state that renders it ({@link #apply}), and turning the current list state back into a
 * new view ({@link #capture}, the "save current as a view" path). No engine knowledge, trivially unit
 * testable; the kit never executes the resulting query, it hands the {@link ListRequest} to a host.
 */
public final class SavedViews {

    private SavedViews() {}

    /**
     * Turns a view into the first-page {@link ListRequest} that renders it: the view's page size (or
     * the supplied default when the view declares none), the view's sort, no search, the view's
     * filters, always on page 1 (switching a view resets paging, like a filter change).
     *
     * @param view        the view to apply
     * @param defaultSize the table's default page size, used when the view's {@code pageSize} is 0
     * @return the list request that renders the view
     */
    public static ListRequest apply(SavedView view, int defaultSize) {
        int size = view.pageSize() > 0 ? view.pageSize() : defaultSize;
        return new ListRequest(1, size, view.sort(), "", view.filters());
    }

    /**
     * Captures the current list state into a new user view (the "Quick Save" path): the request's
     * filters/sort/size plus the visible-column order, under a name, owned by {@code owner}. The
     * inverse of {@link #apply} (modulo paging + the global search, which a view does not persist).
     *
     * @param id             the stable handle for the new view (a fresh UUID string)
     * @param resourceKey    the resource/table this view belongs to
     * @param owner          the owning username
     * @param name           the display label
     * @param request        the current list state to capture
     * @param visibleColumns the current visible-column order (column sort keys); empty = table order
     * @param isDefault      whether to make this the owner's default
     * @return the captured user view
     */
    public static SavedView capture(
            String id,
            String resourceKey,
            String owner,
            String name,
            ListRequest request,
            List<String> visibleColumns,
            boolean isDefault) {
        return SavedView.user(
                id,
                resourceKey,
                owner,
                name,
                request.filters(),
                visibleColumns,
                request.sort(),
                request.size(),
                isDefault);
    }

    /**
     * Whether the current list state differs from what {@link #apply applying} the active view would
     * produce: the "this view has unsaved changes" indicator. Compares only the facets a view owns
     * (filters + sort + size); the page number and the global search are transient and ignored.
     *
     * @param active      the active view, or {@code null} when no view is active (then never dirty)
     * @param request     the current list state
     * @param defaultSize the table's default page size (to resolve a view's 0 page size)
     * @return whether the current state has drifted from the active view
     */
    public static boolean isDirty(@Nullable SavedView active, ListRequest request, int defaultSize) {
        if (active == null) {
            return false;
        }
        ListRequest applied = apply(active, defaultSize);
        return applied.size() != request.size()
                || !applied.sort().equals(request.sort())
                || !applied.filters().equals(request.filters());
    }
}
