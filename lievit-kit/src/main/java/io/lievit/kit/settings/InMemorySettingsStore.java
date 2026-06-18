/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit.settings;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.ConcurrentHashMap;

import org.jspecify.annotations.Nullable;

/**
 * A thread-safe in-memory {@link SettingsStore}: the zero-config default so settings pages work out
 * of the box in dev and tests. Not durable across a restart; an adopter wires a JDBC-backed store
 * for production.
 */
public final class InMemorySettingsStore implements SettingsStore {

    private final Map<String, Map<String, @Nullable Object>> groups = new ConcurrentHashMap<>();

    @Override
    public Map<String, @Nullable Object> load(String group) {
        Objects.requireNonNull(group, "group");
        Map<String, @Nullable Object> values = groups.get(group);
        return values == null ? Map.of() : new LinkedHashMap<>(values);
    }

    @Override
    public void save(String group, Map<String, @Nullable Object> values) {
        Objects.requireNonNull(group, "group");
        Objects.requireNonNull(values, "values");
        groups.put(group, new LinkedHashMap<>(values));
    }
}
