/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * A select filter: narrows the table to rows whose value is one of a fixed option set (the Filament
 * {@code SelectFilter}). Single-select by default; {@link #multiple()} lets the user pick several,
 * and {@link #searchable()} hints the control to filter its options as the user types.
 *
 * <p>The options are an ordered value→label map. The selected value(s) ride the {@link FilterState}
 * under {@link #name()}; the repository maps the name to its column and the value(s) to a WHERE / IN
 * clause.
 */
public final class SelectFilter extends Filter {

    private final Map<String, String> options = new LinkedHashMap<>();
    private boolean multiple;
    private boolean searchable;
    private boolean relationship;

    private SelectFilter(String name) {
        super(name);
    }

    /**
     * @param name the filter name (the {@link FilterState} key and, by default, the column)
     * @return a select filter
     */
    public static SelectFilter make(String name) {
        return new SelectFilter(name);
    }

    /**
     * Sets the selectable options as an ordered value→label map.
     *
     * @param opts the value→label map
     * @return this filter
     */
    public SelectFilter options(Map<String, String> opts) {
        options.clear();
        options.putAll(Objects.requireNonNull(opts, "opts"));
        return this;
    }

    /**
     * Allows the user to select several options (the value rides as a multi-value filter state).
     *
     * @return this filter
     */
    public SelectFilter multiple() {
        this.multiple = true;
        return this;
    }

    /**
     * Hints the control to filter its options as the user types.
     *
     * @return this filter
     */
    public SelectFilter searchable() {
        this.searchable = true;
        return this;
    }

    /**
     * Marks this filter as relationship-backed (the repository resolves the values against a related
     * table). A presentation/intent flag; the kit does not run the relationship query.
     *
     * @return this filter
     */
    public SelectFilter relationship() {
        this.relationship = true;
        return this;
    }

    /** @return the options, value→label, in declaration order */
    public Map<String, String> options() {
        return java.util.Collections.unmodifiableMap(options);
    }

    /** @return whether several options may be selected */
    public boolean isMultiple() {
        return multiple;
    }

    /** @return whether the option list is searchable */
    public boolean isSearchable() {
        return searchable;
    }

    /** @return whether this filter is relationship-backed */
    public boolean isRelationship() {
        return relationship;
    }

    /**
     * The selected option values from the given state.
     *
     * @param state the active filter state
     * @return the selected values (a one-element list for single-select, empty if inactive)
     */
    public List<String> selected(FilterState state) {
        return state.values(name());
    }
}
