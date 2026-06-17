/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit.support;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Consumer;

/**
 * The component configuration manager (the filament-support {@code ComponentManager} /
 * {@code Configurable} carried over): a registry of closures that mutate every instance of a
 * component type at construction, so an app says once "every text field defaults to maxlength 255"
 * or a plugin "my fields default to X", without subclassing.
 *
 * <p>Two-tier application: a normal {@link #configureUsing(Class, Consumer)} default and an
 * {@link #configureImportant(Class, Consumer)} one that runs LAST (wins). When a component is
 * configured ({@link #configure(Object)}), the manager walks the component's class up the parent
 * chain so a subclass also receives a parent's registered closures, applying superclass defaults
 * before subclass ones, normal before important.
 *
 * <p>{@link #configureUsing} returns an unregister handle; {@link #during(Class, Consumer, Runnable)}
 * applies a default only for the duration of a block (the scoped {@code during} form). The manager
 * is thread-safe (a shared application bean) but {@code during} mutates global state for the
 * calling thread's block, matching Filament's semantics.
 */
public final class ComponentConfiguration {

    private final Map<Class<?>, List<Consumer<?>>> normal = new ConcurrentHashMap<>();
    private final Map<Class<?>, List<Consumer<?>>> important = new ConcurrentHashMap<>();

    /** An undo handle returned by a registration. */
    @FunctionalInterface
    public interface Registration {
        /** Removes the registered configuration closure. */
        void unregister();
    }

    /**
     * Registers a normal default applied to every instance of {@code type} and its subclasses.
     *
     * @param type the component class the default applies to
     * @param configurator mutates a fresh instance at configure time
     * @param <T> the component type
     * @return an unregister handle
     */
    public <T> Registration configureUsing(Class<T> type, Consumer<? super T> configurator) {
        return add(normal, type, configurator);
    }

    /**
     * Registers an important default (runs after every normal one for the same instance, so it
     * wins on any conflicting setter).
     *
     * @param type the component class
     * @param configurator mutates a fresh instance
     * @param <T> the component type
     * @return an unregister handle
     */
    public <T> Registration configureImportant(Class<T> type, Consumer<? super T> configurator) {
        return add(important, type, configurator);
    }

    /**
     * Applies every registered default to a freshly built component: superclass defaults before
     * subclass defaults, all normal defaults before all important ones.
     *
     * @param component the component to configure
     * @param <T> the component type
     * @return the same component, configured
     */
    @SuppressWarnings("unchecked")
    public <T> T configure(T component) {
        Objects.requireNonNull(component, "component");
        List<Class<?>> chain = parentChain(component.getClass());
        // Superclass-first so a subclass default can override a parent default.
        for (int i = chain.size() - 1; i >= 0; i--) {
            for (Consumer<?> c : normal.getOrDefault(chain.get(i), List.of())) {
                ((Consumer<T>) c).accept(component);
            }
        }
        for (int i = chain.size() - 1; i >= 0; i--) {
            for (Consumer<?> c : important.getOrDefault(chain.get(i), List.of())) {
                ((Consumer<T>) c).accept(component);
            }
        }
        return component;
    }

    /**
     * Applies a default only for the duration of {@code block} (the scoped {@code during} form):
     * registers it, runs the block, then unregisters it even if the block throws.
     *
     * @param type the component class
     * @param configurator the scoped default
     * @param block the work to run with the default active
     * @param <T> the component type
     */
    public <T> void during(Class<T> type, Consumer<? super T> configurator, Runnable block) {
        Registration handle = configureUsing(type, configurator);
        try {
            block.run();
        } finally {
            handle.unregister();
        }
    }

    private <T> Registration add(
            Map<Class<?>, List<Consumer<?>>> target, Class<T> type, Consumer<? super T> configurator) {
        Objects.requireNonNull(type, "type");
        Objects.requireNonNull(configurator, "configurator");
        List<Consumer<?>> list = target.computeIfAbsent(type, t -> new ArrayList<>());
        synchronized (list) {
            list.add(configurator);
        }
        return () -> {
            synchronized (list) {
                list.remove(configurator);
            }
        };
    }

    private static List<Class<?>> parentChain(Class<?> type) {
        List<Class<?>> chain = new ArrayList<>();
        for (Class<?> c = type; c != null && c != Object.class; c = c.getSuperclass()) {
            chain.add(c);
        }
        return chain;
    }
}
