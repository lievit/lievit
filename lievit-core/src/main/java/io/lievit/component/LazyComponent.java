/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.component;

import java.lang.reflect.Method;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import org.jspecify.annotations.Nullable;

import io.lievit.LievitLazy;

/**
 * The lazy/deferred metadata of a component (ADR-0036, Livewire {@code SupportLazyLoading} parity,
 * issue #147): whether it is {@code @LievitLazy}, whether it defers (loads on init) rather than
 * lazy-loads (loads on intersection), and the optional {@code placeholder()} method that renders the
 * placeholder HTML. Reflected once per class and cached.
 *
 * <p>The core only reflects the declaration and resolves the placeholder HTML for an instance; the
 * starter (the mount path) renders the placeholder in place of the real body on the first load and
 * stamps the client trigger ({@code l:lazy} for lazy, {@code l:init} for defer). A component without
 * {@code @LievitLazy} is {@link #isLazy()} {@code false} and the mount path renders normally.
 */
public final class LazyComponent {

    private static final Map<Class<?>, LazyComponent> CACHE = new ConcurrentHashMap<>();

    private final boolean lazy;
    private final boolean defer;
    private final @Nullable Method placeholderMethod;

    private LazyComponent(boolean lazy, boolean defer, @Nullable Method placeholderMethod) {
        this.lazy = lazy;
        this.defer = defer;
        this.placeholderMethod = placeholderMethod;
    }

    /**
     * Reflects (and caches) the lazy metadata of a component class.
     *
     * @param type the component class
     * @return its lazy metadata ({@link #isLazy()} is {@code false} when {@code @LievitLazy} is absent)
     */
    public static LazyComponent of(Class<?> type) {
        return CACHE.computeIfAbsent(type, LazyComponent::reflect);
    }

    private static LazyComponent reflect(Class<?> type) {
        LievitLazy annotation = type.getAnnotation(LievitLazy.class);
        if (annotation == null) {
            return new LazyComponent(false, false, null);
        }
        Method placeholder = null;
        if (!annotation.placeholder().isBlank()) {
            try {
                placeholder = type.getDeclaredMethod(annotation.placeholder());
                if (placeholder.getReturnType() != String.class) {
                    throw new IllegalArgumentException(
                            "@LievitLazy placeholder method "
                                    + type.getName()
                                    + "#"
                                    + annotation.placeholder()
                                    + " must return String");
                }
                placeholder.setAccessible(true);
            } catch (NoSuchMethodException e) {
                throw new IllegalArgumentException(
                        "@LievitLazy placeholder method not found: "
                                + type.getName()
                                + "#"
                                + annotation.placeholder(),
                        e);
            }
        }
        return new LazyComponent(true, annotation.defer(), placeholder);
    }

    /**
     * @return {@code true} if the component is {@code @LievitLazy}
     */
    public boolean isLazy() {
        return lazy;
    }

    /**
     * @return {@code true} if it defers (loads on init) rather than lazy-loads (loads on intersection)
     */
    public boolean defersOnInit() {
        return defer;
    }

    /**
     * Renders the placeholder HTML for an instance: the {@code placeholder()} method's return value if
     * one was declared, else a minimal built-in skeleton.
     *
     * @param instance the component instance (the placeholder method may read its state)
     * @return the placeholder HTML fragment
     */
    public String placeholderHtml(Object instance) {
        if (placeholderMethod == null) {
            return "<div class=\"lievit-lazy-placeholder\" aria-busy=\"true\"></div>";
        }
        try {
            Object html = placeholderMethod.invoke(instance);
            return html == null ? "" : html.toString();
        } catch (ReflectiveOperationException e) {
            throw new IllegalStateException(
                    "could not render the @LievitLazy placeholder for " + instance.getClass().getName(),
                    e);
        }
    }
}
