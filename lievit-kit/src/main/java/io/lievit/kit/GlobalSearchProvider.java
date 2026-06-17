/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit;

import java.util.Objects;

/**
 * Runs a global-search query across a {@link Panel}'s searchable resources and groups the hits (the
 * Filament {@code GlobalSearchProvider} / {@code DefaultGlobalSearchProvider}). Each searchable
 * resource contributes its hits under its own group (the resource label), so the topbar dropdown
 * renders results sectioned by resource.
 *
 * <p>This is the default provider; an adopter can supply a custom one (for example to back search
 * with a search engine) by implementing the same {@link #search(Panel, String)} shape.
 */
@FunctionalInterface
public interface GlobalSearchProvider {

    /**
     * Searches the panel for a query.
     *
     * @param panel the panel whose resources are searched
     * @param query the search query
     * @return the grouped results
     */
    GlobalSearchResults search(Panel panel, String query);

    /**
     * @return the default provider, which asks each globally-searchable resource of the panel to
     *     match the query and groups the hits under each resource's label
     */
    static GlobalSearchProvider defaultProvider() {
        return (panel, query) -> {
            Objects.requireNonNull(panel, "panel");
            GlobalSearchResults results = GlobalSearchResults.create();
            if (query == null || query.isBlank()) {
                return results;
            }
            for (Resource<?> resource : panel.resources()) {
                if (!resource.isGloballySearchable()) {
                    continue;
                }
                var hits = searchResource(resource, query, panel.path());
                if (!hits.isEmpty()) {
                    results.addAll(resource.label(), hits);
                }
            }
            return results;
        };
    }

    /** Captures the wildcard so {@code globalSearch} typechecks against the resource's row type. */
    private static <T> java.util.List<GlobalSearchResult> searchResource(
            Resource<T> resource, String query, String panelPath) {
        return resource.globalSearch(query, panelPath);
    }
}
