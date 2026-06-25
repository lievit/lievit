/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit.support;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.ConcurrentHashMap;

/**
 * The type-safe replacement for Filament's dynamic {@code Macroable} (issue #357 decision).
 *
 * <p><strong>Decision.</strong> Filament's {@code Macroable} adds methods to a class at runtime via
 * PHP's {@code __call} / {@code __callStatic} dispatch. Java has no runtime method injection, and
 * most of what {@code Macroable} is used for is already covered idiomatically here: a panel-wide
 * default is {@link ComponentConfiguration#configureUsing} (the {@code configureUsing} path), and a
 * plugin that needs new behavior subclasses the component or implements a default-method interface,
 * registering its contributions through {@link dev.lievit.kit.Plugin}. So the kit declines the
 * dynamic, untyped form on purpose.
 *
 * <p>What remains uncovered is the narrow "a plugin wants to offer adopters a NAMED fluent helper on
 * an existing component without subclassing it" case. For that the kit offers this explicit
 * named-extension registry instead of reflective dispatch: a plugin {@link #macro registers} a named
 * function for a component type (or a {@link #mixin bundle} of them), and an adopter {@link #invoke
 * invokes} it as {@code extensions.invoke(field, "name", args)}. The function returns the same
 * component, so the call chains like a native fluent method. Unlike PHP's silent {@code __call}, a
 * missing name is an explicit error.
 *
 * <p>Thread-safe (a shared application bean): registration and lookup go through a concurrent map.
 */
public final class ComponentExtensions {

    /**
     * A named extension function over a component: receives the instance and the call arguments,
     * returns the (same) instance so the call chains.
     *
     * @param <T> the component type
     */
    @FunctionalInterface
    public interface Macro<T> {
        /**
         * @param component the instance being extended
         * @param args the call arguments
         * @return the component, for chaining
         */
        T apply(T component, Object[] args);
    }

    /** The registration surface a {@link #mixin} bundle adds its helpers through. */
    public final class MixinRegistrar<T> {
        private final Class<T> type;

        private MixinRegistrar(Class<T> type) {
            this.type = type;
        }

        /**
         * Adds one named helper to the bundle.
         *
         * @param name the helper name
         * @param macro the helper function
         * @return this registrar, for chaining helpers
         */
        public MixinRegistrar<T> macro(String name, Macro<T> macro) {
            ComponentExtensions.this.macro(type, name, macro);
            return this;
        }
    }

    /** A bundle of helpers registered together (the Filament {@code mixin(object)}). */
    @FunctionalInterface
    public interface Mixin<T> {
        /**
         * @param registrar the surface to add the bundle's helpers through
         */
        void contribute(MixinRegistrar<T> registrar);
    }

    private final Map<Class<?>, Map<String, Macro<?>>> macros = new ConcurrentHashMap<>();

    /**
     * Registers a named extension for a component type. Last write wins.
     *
     * @param type the component class the helper applies to
     * @param name the helper name
     * @param macro the helper function (returns the component for chaining)
     * @param <T> the component type
     * @return this registry
     */
    public <T> ComponentExtensions macro(Class<T> type, String name, Macro<T> macro) {
        Objects.requireNonNull(type, "type");
        Objects.requireNonNull(name, "name");
        Objects.requireNonNull(macro, "macro");
        macros.computeIfAbsent(type, t -> new LinkedHashMap<>()).put(name, macro);
        return this;
    }

    /**
     * Registers a bundle of named extensions at once (the Filament {@code mixin}).
     *
     * @param type the component class the bundle applies to
     * @param mixin the bundle
     * @param <T> the component type
     * @return this registry
     */
    public <T> ComponentExtensions mixin(Class<T> type, Mixin<T> mixin) {
        Objects.requireNonNull(mixin, "mixin");
        mixin.contribute(new MixinRegistrar<>(type));
        return this;
    }

    /**
     * Invokes a named extension on a component, returning the (same) component so the call chains.
     *
     * @param component the instance to extend
     * @param name the helper name
     * @param args the call arguments
     * @param <T> the component type
     * @return the component, for chaining
     * @throws IllegalArgumentException if no helper of that name is registered for the component
     */
    @SuppressWarnings("unchecked")
    public <T> T invoke(T component, String name, Object... args) {
        Objects.requireNonNull(component, "component");
        Map<String, Macro<?>> forType = macros.get(component.getClass());
        Macro<T> macro = forType == null ? null : (Macro<T>) forType.get(name);
        if (macro == null) {
            throw new IllegalArgumentException(
                    "no extension '" + name + "' for " + component.getClass().getName());
        }
        return macro.apply(component, args);
    }

    /**
     * @param type a component class
     * @param name a helper name
     * @return whether a helper of that name is registered for the type
     */
    public boolean hasMacro(Class<?> type, String name) {
        Map<String, Macro<?>> forType = macros.get(type);
        return forType != null && forType.containsKey(name);
    }
}
