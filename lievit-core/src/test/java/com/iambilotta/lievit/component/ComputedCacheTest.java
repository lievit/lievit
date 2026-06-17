/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package com.iambilotta.lievit.component;

import static org.assertj.core.api.Assertions.assertThat;

import java.lang.reflect.Method;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;

import org.junit.jupiter.api.Test;

/**
 * Specifies the per-request memoization cache for {@code @LievitComputed} methods (ADR-0015):
 * a value is computed at most once per cache instance, null results are cached, and the cache is
 * independent across instances (no cross-request leakage). The ThreadLocal bind/clear contract is
 * exercised via the dispatcher in {@link ComputedCacheDispatcherInvariantTest}.
 */
class ComputedCacheTest {

    /** A simple target whose call count we can track. */
    static class CallCounter {
        final AtomicInteger callCount = new AtomicInteger();

        Object compute() {
            callCount.incrementAndGet();
            return callCount.get();
        }

        Object returnsNull() {
            callCount.incrementAndGet();
            return null;
        }
    }

    private Method method(String name) throws NoSuchMethodException {
        return CallCounter.class.getDeclaredMethod(name);
    }

    /**
     * @spec.given a ComputedCache and a method that increments a counter on each invocation
     * @spec.when  resolve() is called twice for the same method name
     * @spec.then  the method is invoked exactly once; the second call returns the cached value
     * @spec.adr   ADR-0015
     */
    @Test
    void resolve_memoizes_within_a_single_cache_instance() throws Exception {
        ComputedCache cache = new ComputedCache();
        CallCounter counter = new CallCounter();
        Method m = method("compute");
        m.setAccessible(true);

        Object first = cache.resolve(m, counter);
        Object second = cache.resolve(m, counter);

        assertThat(counter.callCount.get())
                .as("method must be invoked exactly once per cache instance")
                .isEqualTo(1);
        assertThat(first).isEqualTo(second).isEqualTo(1);
    }

    /**
     * @spec.given a ComputedCache and a method that returns null
     * @spec.when  resolve() is called twice for the same method
     * @spec.then  null is cached; the method is not called a second time
     * @spec.adr   ADR-0015
     */
    @Test
    void resolve_caches_a_null_result() throws Exception {
        ComputedCache cache = new ComputedCache();
        CallCounter counter = new CallCounter();
        Method m = method("returnsNull");
        m.setAccessible(true);

        Object first = cache.resolve(m, counter);
        Object second = cache.resolve(m, counter);

        assertThat(counter.callCount.get())
                .as("method must be invoked exactly once even when it returns null")
                .isEqualTo(1);
        assertThat(first).isNull();
        assertThat(second).isNull();
    }

    /**
     * @spec.given two separate ComputedCache instances representing two distinct wire requests
     * @spec.when  resolve() is called on each with the same method
     * @spec.then  the method is invoked once per cache (twice total): no cross-request leakage
     * @spec.adr   ADR-0015
     */
    @Test
    void two_cache_instances_do_not_share_memoized_state() throws Exception {
        ComputedCache first = new ComputedCache();
        ComputedCache second = new ComputedCache();
        CallCounter counter = new CallCounter();
        Method m = method("compute");
        m.setAccessible(true);

        first.resolve(m, counter);
        second.resolve(m, counter);

        assertThat(counter.callCount.get())
                .as("separate cache instances must each invoke the method independently")
                .isEqualTo(2);
    }

    /**
     * @spec.given a ComputedCache with one resolved value
     * @spec.when  snapshot() is called
     * @spec.then  the snapshot contains the resolved entry (for the template adapter)
     * @spec.adr   ADR-0015
     */
    @Test
    void snapshot_includes_all_resolved_values() throws Exception {
        ComputedCache cache = new ComputedCache();
        CallCounter counter = new CallCounter();
        Method m = method("compute");
        m.setAccessible(true);
        cache.resolve(m, counter);

        Map<String, Object> snapshot = cache.snapshot();

        assertThat(snapshot).containsKey("compute");
        assertThat(snapshot.get("compute")).isEqualTo(1);
    }
}
