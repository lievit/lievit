/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.component;

import java.lang.reflect.Method;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import org.jspecify.annotations.Nullable;

/**
 * The full ordered lifecycle hook set of a component, resolved by naming convention (ADR-0030,
 * Livewire {@code SupportLifecycleHooks} parity). This is the component-author-facing lifecycle,
 * distinct from the framework-facing {@link LifecycleBus}: the {@link LifecycleHooksListener}
 * dispatches these user hooks through the bus at the matching phase.
 *
 * <p>The hooks beyond {@code @LievitMount} / {@code @LievitRender} (which keep their annotations,
 * ADR-0002) are resolved by <b>method name</b>, the Livewire convention:
 *
 * <ul>
 *   <li>{@code boot()} / {@code booted()} — once per request, before hydrate/mount and after.
 *   <li>{@code hydrate()} / {@code dehydrate()} — state rehydrated from / read back into the snapshot.
 *   <li>{@code updating()} (sees the old value) / {@code updated()} (sees the new value) — around an
 *       applied client update; per-property {@code updatingFoo(value)} / {@code updatedFoo(value)}
 *       fire for the {@code foo} field with the value as the single argument.
 *   <li>{@code rendering()} / {@code rendered()} — around the render.
 * </ul>
 *
 * <p>A hook method may be {@code private}/{@code protected} (it is {@code setAccessible}). Per-property
 * hooks take one parameter (the value); the plain hooks take none. None are reachable as a frontend
 * action: only an {@code @LievitAction} is in the call allowlist (ADR-0013), so naming a hook in
 * {@code _calls} is an {@code UNKNOWN_COMPONENT}.
 *
 * <p>Reflected once per class and cached (the reflection is not free, the lifecycle is hot).
 */
public final class LifecycleHooks {

    private static final Map<Class<?>, LifecycleHooks> CACHE = new ConcurrentHashMap<>();

    private final @Nullable Method boot;
    private final @Nullable Method booted;
    private final @Nullable Method hydrate;
    private final @Nullable Method dehydrate;
    private final @Nullable Method updating;
    private final @Nullable Method updated;
    private final @Nullable Method rendering;
    private final @Nullable Method rendered;
    /** Per-property {@code updatingFoo} by field name (the method takes the incoming value). */
    private final Map<String, Method> updatingProp;
    /** Per-property {@code updatedFoo} by field name (the method takes the applied value). */
    private final Map<String, Method> updatedProp;

    private LifecycleHooks(
            @Nullable Method boot,
            @Nullable Method booted,
            @Nullable Method hydrate,
            @Nullable Method dehydrate,
            @Nullable Method updating,
            @Nullable Method updated,
            @Nullable Method rendering,
            @Nullable Method rendered,
            Map<String, Method> updatingProp,
            Map<String, Method> updatedProp) {
        this.boot = boot;
        this.booted = booted;
        this.hydrate = hydrate;
        this.dehydrate = dehydrate;
        this.updating = updating;
        this.updated = updated;
        this.rendering = rendering;
        this.rendered = rendered;
        this.updatingProp = updatingProp;
        this.updatedProp = updatedProp;
    }

    /**
     * Reflects (and caches) the convention-named lifecycle hooks of a component class.
     *
     * @param type the component class
     * @return its lifecycle hooks (any absent hook is {@code null})
     */
    public static LifecycleHooks of(Class<?> type) {
        return CACHE.computeIfAbsent(type, LifecycleHooks::reflect);
    }

    private static LifecycleHooks reflect(Class<?> type) {
        Method boot = null;
        Method booted = null;
        Method hydrate = null;
        Method dehydrate = null;
        Method updating = null;
        Method updated = null;
        Method rendering = null;
        Method rendered = null;
        Map<String, Method> updatingProp = new LinkedHashMap<>();
        Map<String, Method> updatedProp = new LinkedHashMap<>();

        for (Method method : type.getDeclaredMethods()) {
            String name = method.getName();
            int params = method.getParameterCount();
            switch (name) {
                case "boot" -> boot = noArg(method, params);
                case "booted" -> booted = noArg(method, params);
                case "hydrate" -> hydrate = noArg(method, params);
                case "dehydrate" -> dehydrate = noArg(method, params);
                case "updating" -> updating = noArg(method, params);
                case "updated" -> updated = noArg(method, params);
                case "rendering" -> rendering = noArg(method, params);
                case "rendered" -> rendered = noArg(method, params);
                default -> {
                    String prop = perPropertyField(name, "updating", params);
                    if (prop != null) {
                        method.setAccessible(true);
                        updatingProp.put(prop, method);
                    }
                    prop = perPropertyField(name, "updated", params);
                    if (prop != null) {
                        method.setAccessible(true);
                        updatedProp.put(prop, method);
                    }
                }
            }
        }
        return new LifecycleHooks(
                boot, booted, hydrate, dehydrate, updating, updated, rendering, rendered,
                Map.copyOf(updatingProp), Map.copyOf(updatedProp));
    }

    private static @Nullable Method noArg(Method method, int params) {
        if (params != 0) {
            return null;
        }
        method.setAccessible(true);
        return method;
    }

    /**
     * Decodes {@code updatingFoo} / {@code updatedFoo} into the field name {@code foo}, requiring the
     * one-argument signature (the value). Returns null when the name is not a per-property hook of the
     * given prefix or the arity is wrong.
     */
    private static @Nullable String perPropertyField(String methodName, String prefix, int params) {
        if (params != 1 || methodName.length() <= prefix.length()) {
            return null;
        }
        if (!methodName.startsWith(prefix) || methodName.equals(prefix)) {
            return null;
        }
        // The char right after the prefix must be uppercase: updatingFoo, not updatingfoo / updated.
        char first = methodName.charAt(prefix.length());
        if (!Character.isUpperCase(first)) {
            return null;
        }
        return Character.toLowerCase(first) + methodName.substring(prefix.length() + 1);
    }

    @Nullable Method boot() {
        return boot;
    }

    @Nullable Method booted() {
        return booted;
    }

    @Nullable Method hydrate() {
        return hydrate;
    }

    @Nullable Method dehydrate() {
        return dehydrate;
    }

    @Nullable Method updating() {
        return updating;
    }

    @Nullable Method updated() {
        return updated;
    }

    @Nullable Method rendering() {
        return rendering;
    }

    @Nullable Method rendered() {
        return rendered;
    }

    @Nullable Method updatingProp(String field) {
        return updatingProp.get(field);
    }

    @Nullable Method updatedProp(String field) {
        return updatedProp.get(field);
    }

    /**
     * @return true if the class declares no lifecycle hooks at all (the listener can no-op fast)
     */
    public boolean isEmpty() {
        return boot == null && booted == null && hydrate == null && dehydrate == null
                && updating == null && updated == null && rendering == null && rendered == null
                && updatingProp.isEmpty() && updatedProp.isEmpty();
    }
}
