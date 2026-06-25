/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.component;

import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import org.jspecify.annotations.Nullable;

/**
 * The optional {@code with()} extra-view-data method of a component (ADR-0041, #65, Livewire
 * {@code with()} parity): a no-argument method named {@code with} returning a {@code Map} of derived
 * view variables that reach the template model without being persisted {@code @Wire} state.
 *
 * <p>Resolved by <b>method name</b> (the Livewire convention, like the lifecycle hooks of
 * {@link LifecycleHooks}), so it adds no annotation to the ADR-0002 surface. The method may be
 * {@code private}/{@code protected} (it is {@code setAccessible}); it must take no parameters and
 * return a {@code Map} (any other {@code with} overload is ignored). Reflected once per class and
 * cached.
 *
 * <p>{@code with()} is invoked during the render phase, AFTER the action(s) ran and AFTER computed
 * resolution, so it sees the post-action state. Its entries are merged into the template model after
 * the {@code @Wire} state, so a {@code with()} key takes precedence over a same-named public
 * property (Livewire's precedence). The returned values are never signed into the snapshot.
 */
public final class WithMethodMetadata {

    private static final Map<Class<?>, WithMethodMetadata> CACHE = new ConcurrentHashMap<>();

    private static final WithMethodMetadata ABSENT = new WithMethodMetadata(null);

    private final @Nullable Method with;

    private WithMethodMetadata(@Nullable Method with) {
        this.with = with;
    }

    /**
     * Reflects (and caches) the {@code with()} method of a component class.
     *
     * @param type the component class
     * @return its {@code with()} metadata (absent if the class declares no eligible {@code with()})
     */
    public static WithMethodMetadata of(Class<?> type) {
        return CACHE.computeIfAbsent(type, WithMethodMetadata::reflect);
    }

    private static WithMethodMetadata reflect(Class<?> type) {
        for (Method method : type.getDeclaredMethods()) {
            if (!method.getName().equals("with")) {
                continue;
            }
            if (method.getParameterCount() != 0) {
                continue;
            }
            if (!Map.class.isAssignableFrom(method.getReturnType())) {
                continue;
            }
            method.setAccessible(true);
            return new WithMethodMetadata(method);
        }
        return ABSENT;
    }

    /**
     * @return true if the component declares no eligible {@code with()} method (the common case)
     */
    public boolean isEmpty() {
        return with == null;
    }

    /**
     * Invokes the {@code with()} method against a component instance and returns its view data, or
     * an empty map when the component has no {@code with()} method or it returns {@code null}.
     *
     * @param instance the component instance (read for the derived view variables)
     * @return the extra view variables to merge into the template model (never {@code null})
     */
    public Map<String, @Nullable Object> resolve(Object instance) {
        if (with == null) {
            return Map.of();
        }
        Object result = invoke(instance);
        if (!(result instanceof Map<?, ?> map)) {
            return Map.of();
        }
        Map<String, @Nullable Object> data = new LinkedHashMap<>();
        for (Map.Entry<?, ?> entry : map.entrySet()) {
            data.put(String.valueOf(entry.getKey()), entry.getValue());
        }
        return Collections.unmodifiableMap(data);
    }

    private @Nullable Object invoke(Object instance) {
        try {
            return with.invoke(instance);
        } catch (IllegalAccessException e) {
            throw new IllegalStateException("cannot invoke with() on " + instance.getClass(), e);
        } catch (InvocationTargetException e) {
            Throwable cause = e.getCause();
            if (cause instanceof RuntimeException re) {
                throw re;
            }
            throw new IllegalStateException("with() threw a checked exception", cause);
        }
    }
}
