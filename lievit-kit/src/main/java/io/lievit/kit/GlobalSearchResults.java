/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * Global-search hits grouped by their source category (the Filament {@code GlobalSearchResults}):
 * results are bucketed under a group label (typically the resource's plural label) so the topbar
 * dropdown can render them sectioned. Group order is insertion order.
 */
public final class GlobalSearchResults {

    private final Map<String, List<GlobalSearchResult>> groups = new LinkedHashMap<>();

    private GlobalSearchResults() {}

    /**
     * @return a new, empty result set
     */
    public static GlobalSearchResults create() {
        return new GlobalSearchResults();
    }

    /**
     * Adds a result under a group label.
     *
     * @param group the group label (for example a resource's plural label)
     * @param result the result
     * @return this result set
     */
    public GlobalSearchResults add(String group, GlobalSearchResult result) {
        groups.computeIfAbsent(Objects.requireNonNull(group, "group"), g -> new ArrayList<>())
                .add(Objects.requireNonNull(result, "result"));
        return this;
    }

    /**
     * Adds all results for a group at once.
     *
     * @param group the group label
     * @param results the results
     * @return this result set
     */
    public GlobalSearchResults addAll(String group, List<GlobalSearchResult> results) {
        Objects.requireNonNull(results, "results").forEach(r -> add(group, r));
        return this;
    }

    /**
     * @return the group labels, in insertion order
     */
    public List<String> groups() {
        return List.copyOf(groups.keySet());
    }

    /**
     * @param group the group label
     * @return the results in that group, as an unmodifiable snapshot (empty if no such group)
     */
    public List<GlobalSearchResult> resultsFor(String group) {
        return Collections.unmodifiableList(groups.getOrDefault(group, List.of()));
    }

    /**
     * @return the total number of results across all groups
     */
    public int totalCount() {
        return groups.values().stream().mapToInt(List::size).sum();
    }

    /**
     * @return whether there are no results at all
     */
    public boolean isEmpty() {
        return totalCount() == 0;
    }
}
