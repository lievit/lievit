/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.component;

import java.lang.reflect.Method;
import java.util.HashMap;
import java.util.Map;

import org.jspecify.annotations.Nullable;

/**
 * The per-request memoization cache for {@code @LievitComputed} methods (ADR-0015).
 *
 * <p>Lifecycle: bound by the {@link WireDispatcher} at the start of every {@code mount} or
 * {@code call} and cleared in the same {@code finally} block that clears {@link LievitEffects}.
 * Nothing survives between wire calls; a state change on the next request triggers a fresh
 * computation.
 *
 * <p>Thread-safety: one cache instance per {@link WireDispatcher} call, stored in a
 * {@link ThreadLocal}. Concurrent requests on different threads each hold their own cache
 * instance; there is no shared mutable state.
 *
 * <p>The cache key is the method name. A value of {@code null} is a valid computed result and is
 * cached as-is (distinguished from "not yet computed" by the {@code computed} set of already-run
 * names).
 */
public final class ComputedCache {

    private static final ThreadLocal<ComputedCache> CURRENT = new ThreadLocal<>();

    /** Names of methods whose result is already in {@code cache} (including null results). */
    private final Map<String, Boolean> computed = new HashMap<>();
    private final Map<String, @Nullable Object> cache = new HashMap<>();

    ComputedCache() {}

    /** Binds a fresh cache as the current-thread cache (called by the dispatcher). */
    static void bind(ComputedCache cache) {
        CURRENT.set(cache);
    }

    /** Returns the cache for the current thread (called by the dispatcher). */
    static @Nullable ComputedCache current() {
        return CURRENT.get();
    }

    /** Clears the current-thread cache (called by the dispatcher in a finally). */
    static void clear() {
        CURRENT.remove();
    }

    /**
     * Resolves the computed value for {@code method} on {@code instance}: returns the cached value
     * if already computed this call, or invokes the method, caches the result, and returns it.
     *
     * @param method the {@code @LievitComputed} method (already {@code setAccessible(true)})
     * @param instance the component instance
     * @return the computed (and memoized) return value; may be {@code null}
     */
    @Nullable Object resolve(Method method, Object instance) {
        String name = method.getName();
        if (computed.containsKey(name)) {
            return cache.get(name);
        }
        Object value = invoke(method, instance);
        computed.put(name, Boolean.TRUE);
        cache.put(name, value);
        return value;
    }

    /**
     * Returns a snapshot of all already-computed values in this cache. Used by the dispatcher to
     * populate the template model after all computed methods that were called have been resolved.
     *
     * @return an unmodifiable view of the current cache entries
     */
    Map<String, @Nullable Object> snapshot() {
        return Map.copyOf(cache);
    }

    private static @Nullable Object invoke(Method method, Object instance) {
        try {
            return method.invoke(instance);
        } catch (java.lang.reflect.InvocationTargetException e) {
            Throwable cause = e.getCause();
            if (cause instanceof RuntimeException re) {
                throw re;
            }
            throw new IllegalStateException(
                    "computed method " + method.getName() + " threw a checked exception", cause);
        } catch (IllegalAccessException e) {
            throw new IllegalStateException("cannot invoke computed method " + method.getName(), e);
        }
    }
}
