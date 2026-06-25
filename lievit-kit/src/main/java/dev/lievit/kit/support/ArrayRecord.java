/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit.support;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;

/**
 * A plain map treated as a "record" (the filament-support {@code ArrayRecord} carried over): lets a
 * form or table run over transient, non-entity data without a persistent entity behind it.
 *
 * <p>This is what a settings page or a wizard holding in-flight values uses: there is no row in a
 * table, just a bag of keyed values the schema reads and writes. Immutable; {@link #with(String,
 * Object)} returns a new record so a configuration default or a state update never mutates a shared
 * instance. Insertion order is preserved so the keys round-trip in declaration order.
 */
public final class ArrayRecord {

    private final Map<String, Object> values;

    private ArrayRecord(Map<String, Object> values) {
        this.values = values;
    }

    /**
     * @param values the initial key/value pairs (defensively copied, order preserved)
     * @return an array record over a snapshot of the map
     */
    public static ArrayRecord of(Map<String, Object> values) {
        Objects.requireNonNull(values, "values");
        return new ArrayRecord(new LinkedHashMap<>(values));
    }

    /**
     * @return an empty array record (the transient-state starting point)
     */
    public static ArrayRecord empty() {
        return new ArrayRecord(new LinkedHashMap<>());
    }

    /**
     * @param key the value key
     * @return the value bound to the key, empty if absent
     */
    public Optional<Object> get(String key) {
        return Optional.ofNullable(values.get(key));
    }

    /**
     * @param key the value key to set
     * @param value the value to bind
     * @return a new record carrying the binding; this record is unchanged
     */
    public ArrayRecord with(String key, Object value) {
        Objects.requireNonNull(key, "key");
        Map<String, Object> next = new LinkedHashMap<>(values);
        next.put(key, value);
        return new ArrayRecord(next);
    }

    /**
     * @return an unmodifiable, insertion-ordered snapshot of the record's values
     */
    public Map<String, Object> asMap() {
        return Collections.unmodifiableMap(new LinkedHashMap<>(values));
    }
}
