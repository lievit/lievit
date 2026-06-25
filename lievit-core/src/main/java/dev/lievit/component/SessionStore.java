/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.component;

import org.jspecify.annotations.Nullable;

/**
 * The minimal, Spring-free abstraction the {@link SessionListener} uses to read and write
 * {@code @LievitSession} property values (ADR-0031). The core stays Spring-free (ADR-0007): the
 * starter provides the {@code HttpSession}-backed implementation; tests use an in-memory map.
 *
 * <p>A {@code null} return from {@link #get} means "no value stored under this key" (so the field
 * keeps its mount default). The store is per HTTP session: it is the deliberate, opt-in exception to
 * lievit's stateless contract (ADR-0001), used only for {@code @LievitSession} fields.
 */
public interface SessionStore {

    /**
     * @param key the resolved session key
     * @return the stored value, or {@code null} if nothing is stored under the key
     */
    @Nullable Object get(String key);

    /**
     * Stores a value under a key (overwriting any prior value).
     *
     * @param key the resolved session key
     * @param value the value to store (may be {@code null} to clear)
     */
    void put(String key, @Nullable Object value);
}
