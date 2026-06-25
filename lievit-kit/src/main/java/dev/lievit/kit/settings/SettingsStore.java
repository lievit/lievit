/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit.settings;

import java.util.Map;

import org.jspecify.annotations.Nullable;

/**
 * The persistence-agnostic store behind a {@link SettingsPage} (the spatie-settings repository,
 * abstracted). Settings live under a named group (one group per settings page) as a flat key→value
 * map; the kit ships {@link InMemorySettingsStore} and an adopter wires a durable one.
 */
public interface SettingsStore {

    /**
     * Loads a settings group as a flat key→value map (the page hydrates its schema from this).
     *
     * @param group the settings group name (one per page)
     * @return the stored values (empty if the group was never saved)
     */
    Map<String, @Nullable Object> load(String group);

    /**
     * Persists a settings group, replacing it wholesale with the given values (the page's dehydrated
     * state).
     *
     * @param group the settings group name
     * @param values the values to persist
     */
    void save(String group, Map<String, @Nullable Object> values);
}
