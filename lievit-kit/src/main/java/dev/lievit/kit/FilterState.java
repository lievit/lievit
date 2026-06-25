/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * The active state of a table's {@link Filter filters}: each entry maps a filter name to the
 * value(s) the user selected. Carried on the {@link RecordRepository.Query} so the adopter's
 * repository applies the filters; the kit never executes them.
 *
 * <p>A value list is used (not a single string) so a multi-select filter is the same shape as a
 * single-select one (a one-element list). An empty list (or an absent name) means the filter is
 * inactive. Immutable; builder methods return a new instance.
 */
public final class FilterState {

    /** The empty filter state (no filter active). */
    public static final FilterState EMPTY = new FilterState(Map.of());

    private final Map<String, List<String>> values;

    private FilterState(Map<String, List<String>> values) {
        Map<String, List<String>> copy = new LinkedHashMap<>();
        for (Map.Entry<String, List<String>> e : values.entrySet()) {
            List<String> v = List.copyOf(e.getValue());
            if (!v.isEmpty()) {
                copy.put(e.getKey(), v);
            }
        }
        this.values = Collections.unmodifiableMap(copy);
    }

    /**
     * @param raw the raw name→values map (empty value lists are dropped as inactive)
     * @return a filter state over the map
     */
    public static FilterState of(Map<String, List<String>> raw) {
        return raw.isEmpty() ? EMPTY : new FilterState(raw);
    }

    /**
     * Sets a single-value filter, returning a new state. A null or blank value clears the filter.
     *
     * @param name the filter name
     * @param value the selected value, or null/blank to clear
     * @return the new state
     */
    public FilterState with(String name, @org.jspecify.annotations.Nullable String value) {
        Objects.requireNonNull(name, "name");
        Map<String, List<String>> next = new LinkedHashMap<>(values);
        if (value == null || value.isBlank()) {
            next.remove(name);
        } else {
            next.put(name, List.of(value));
        }
        return new FilterState(next);
    }

    /**
     * Sets a multi-value filter, returning a new state. An empty list clears the filter.
     *
     * @param name the filter name
     * @param vals the selected values
     * @return the new state
     */
    public FilterState with(String name, List<String> vals) {
        Objects.requireNonNull(name, "name");
        Map<String, List<String>> next = new LinkedHashMap<>(values);
        if (vals.isEmpty()) {
            next.remove(name);
        } else {
            next.put(name, vals);
        }
        return new FilterState(next);
    }

    /**
     * Clears a single filter, returning a new state.
     *
     * @param name the filter name
     * @return the new state
     */
    public FilterState without(String name) {
        if (!values.containsKey(name)) {
            return this;
        }
        Map<String, List<String>> next = new LinkedHashMap<>(values);
        next.remove(name);
        return new FilterState(next);
    }

    /**
     * @param name a filter name
     * @return whether that filter currently has a value (is active)
     */
    public boolean isActive(String name) {
        return values.containsKey(name);
    }

    /**
     * @param name a filter name
     * @return the single value of that filter, or empty if inactive (first value for a multi-filter)
     */
    public java.util.Optional<String> value(String name) {
        List<String> v = values.get(name);
        return v == null || v.isEmpty() ? java.util.Optional.empty() : java.util.Optional.of(v.get(0));
    }

    /**
     * @param name a filter name
     * @return the values of that filter (empty list if inactive)
     */
    public List<String> values(String name) {
        return values.getOrDefault(name, List.of());
    }

    /** @return the active filter names, in insertion order */
    public java.util.Set<String> activeNames() {
        return values.keySet();
    }

    /** @return whether no filter is active */
    public boolean isEmpty() {
        return values.isEmpty();
    }

    @Override
    public boolean equals(Object o) {
        return o instanceof FilterState other && values.equals(other.values);
    }

    @Override
    public int hashCode() {
        return values.hashCode();
    }

    @Override
    public String toString() {
        return "FilterState" + values;
    }
}
