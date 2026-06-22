/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit;

/**
 * The adopter-provided port that counts how many rows match a {@link SavedView}'s filters: the
 * per-view "record count" badge on the switcher (the Salesforce list-view count). The kit cannot run
 * it itself ({@link FilterState} is carried, never executed), so the host implements a bounded
 * {@code count(*)}-style query over its repository.
 *
 * <p>Counting is the cost center (one query per switchable view per render), so it is opt-in: a host
 * that does not wire a counter simply renders no count badges. A future caching/async-badge strategy
 * is an implementation detail behind this same interface.
 */
@FunctionalInterface
public interface SavedViewCounter {

    /**
     * Counts the rows of a resource that match a view's filters.
     *
     * @param resourceKey the resource/table key (so one counter can serve several resources)
     * @param filters     the view's filter state
     * @return the number of matching rows
     */
    long count(String resourceKey, FilterState filters);
}
