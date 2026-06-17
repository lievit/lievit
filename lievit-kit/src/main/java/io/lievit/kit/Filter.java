/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit;

import java.util.Objects;

/**
 * A table filter: a named control that narrows the {@link RecordRepository.Query} the list page
 * issues (the Filament {@code tables/Filters/Filter} family). A filter contributes its selected
 * value(s) to the {@link FilterState} carried on the query; the adopter's repository reads that
 * state and applies the WHERE clause.
 *
 * <p>This base type is the simplest filter: a boolean toggle named by {@link #name()}. The richer
 * variants ({@link SelectFilter}, {@link TernaryFilter}, {@link TrashedFilter}) extend it with
 * options and ternary semantics. The kit never executes the filter; it carries the intent and the
 * presentation (label + options), so a filter is unit-testable without a database.
 */
public class Filter {

    /** The filter-state value a boolean filter sets when on. */
    public static final String ON = "1";

    private final String name;
    private String label;

    /**
     * @param name the filter name (the {@link FilterState} key, stable id)
     */
    protected Filter(String name) {
        this.name = Objects.requireNonNull(name, "name");
        if (name.isBlank()) {
            throw new IllegalArgumentException("filter name must be non-blank");
        }
        this.label = humanize(name);
    }

    /**
     * @param name the filter name
     * @return a boolean toggle filter
     */
    public static Filter make(String name) {
        return new Filter(name);
    }

    /**
     * Sets the human label shown on the filter control.
     *
     * @param label the label
     * @return this filter
     */
    public Filter label(String label) {
        this.label = Objects.requireNonNull(label, "label");
        return this;
    }

    /** @return the filter name (the {@link FilterState} key) */
    public final String name() {
        return name;
    }

    /** @return the human label */
    public final String label() {
        return label;
    }

    /**
     * @param state the active filter state
     * @return whether this filter is currently active in that state
     */
    public boolean isActive(FilterState state) {
        return state.isActive(name);
    }

    private static String humanize(String name) {
        String spaced = name.replace('_', ' ').replace('-', ' ').trim();
        if (spaced.isEmpty()) {
            return name;
        }
        return Character.toUpperCase(spaced.charAt(0)) + spaced.substring(1);
    }
}
