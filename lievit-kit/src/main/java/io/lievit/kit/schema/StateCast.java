/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit.schema;

import org.jspecify.annotations.Nullable;

/**
 * A typed boundary conversion applied to a field's value on hydrate and dehydrate (the
 * filament-schemas {@code StateCast} contract carried over). A cast is where data-corruption bugs
 * live (a toggle that should round-trip a boolean, a select an enum key, a date an ISO string), so
 * each cast pins {@code hydrate(dehydrate(x)) == x} in a round-trip test.
 *
 * <p>Direction: {@link #hydrate} runs when state flows INTO the component (form data to the typed
 * in-memory value, on mount); {@link #dehydrate} runs when state flows OUT (the typed value to the
 * persist-ready form data, on submit).
 *
 * @param <T> the in-memory (hydrated) type
 */
public interface StateCast<T extends @Nullable Object> {

    /**
     * Converts a raw persisted value into the in-memory typed value (on mount).
     *
     * @param raw the raw value from the persisted/submitted state
     * @return the typed in-memory value
     */
    @Nullable T hydrate(@Nullable Object raw);

    /**
     * Converts the in-memory typed value back into the persist-ready raw value (on submit).
     *
     * @param value the in-memory typed value
     * @return the raw value to persist
     */
    @Nullable Object dehydrate(@Nullable T value);
}
