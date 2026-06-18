/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.component;

import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import org.jspecify.annotations.Nullable;

import io.lievit.LievitOn;

/**
 * The {@code @LievitOn} event listeners declared by a component (ADR-0030, Livewire {@code #[On]} /
 * {@code SupportEvents} parity): the receiving half of the {@code dispatch} effect. A method-level
 * {@code @LievitOn("name")} registers a handler; a class-level {@code @LievitOn("name")} registers a
 * bare {@code $refresh} listener (the event triggers a re-render, no handler method).
 *
 * <p>A listener name may embed a single-segment {@code {dotted.path}} placeholder; {@link
 * #resolve(Object)} interpolates it against the component's {@code @Wire} state, so a component
 * listening on {@code post.{post.id}.saved} matches {@code post.2.saved} when its {@code post.id} is
 * 2. The placeholder is resolved per instance (the state is only known at call time), so the
 * resolved name map is built per call, not cached.
 *
 * <p>The raw declaration (the name templates and their handler methods) IS cached per class; only
 * the placeholder interpolation runs per call. An {@code @LievitOn} method is never an
 * {@code @LievitAction}, so the client cannot invoke it as a direct action (ADR-0013): it is only
 * reachable as the framework-routed target of a dispatched event.
 */
public final class EventListenerMetadata {

    private static final Map<Class<?>, EventListenerMetadata> CACHE = new ConcurrentHashMap<>();

    /** Each declared listener: its name template and the handler method (null for a class-level $refresh). */
    public record Listener(String nameTemplate, @Nullable Method handler) {}

    private final List<Listener> listeners;

    private EventListenerMetadata(List<Listener> listeners) {
        this.listeners = listeners;
    }

    /**
     * Reflects (and caches) the {@code @LievitOn} listeners of a component class.
     *
     * @param type the component class
     * @return its event-listener metadata (empty if the class declares no {@code @LievitOn})
     */
    public static EventListenerMetadata of(Class<?> type) {
        return CACHE.computeIfAbsent(type, EventListenerMetadata::reflect);
    }

    private static EventListenerMetadata reflect(Class<?> type) {
        List<Listener> listeners = new ArrayList<>();
        // Class-level @LievitOn: a bare $refresh listener (no handler method).
        for (LievitOn on : type.getAnnotationsByType(LievitOn.class)) {
            for (String name : on.value()) {
                listeners.add(new Listener(name, null));
            }
        }
        // Method-level @LievitOn: the handler is the annotated method.
        for (Method method : type.getDeclaredMethods()) {
            LievitOn[] declared = method.getAnnotationsByType(LievitOn.class);
            if (declared.length == 0) {
                continue;
            }
            method.setAccessible(true);
            for (LievitOn on : declared) {
                for (String name : on.value()) {
                    listeners.add(new Listener(name, method));
                }
            }
        }
        return new EventListenerMetadata(List.copyOf(listeners));
    }

    /**
     * @return true if the component declares no {@code @LievitOn} listeners (the common case)
     */
    public boolean isEmpty() {
        return listeners.isEmpty();
    }

    /**
     * @return the raw listener declarations (name templates + handlers), in declaration order
     */
    public List<Listener> listeners() {
        return listeners;
    }

    /**
     * Resolves the listeners' names against a component instance's state, interpolating any
     * {@code {dotted.path}} placeholder, and returns a map from the resolved event name to its
     * handler ({@code null} handler = a class-level {@code $refresh} listener). When two listeners
     * resolve to the same name, the last declared wins.
     *
     * @param instance the component instance (read for placeholder values)
     * @return resolved event name → handler (or {@code null} for a bare refresh listener)
     */
    public Map<String, @Nullable Method> resolve(Object instance) {
        Map<String, @Nullable Method> resolved = new LinkedHashMap<>();
        for (Listener listener : listeners) {
            resolved.put(PlaceholderNames.interpolate(listener.nameTemplate(), instance),
                    listener.handler());
        }
        return resolved;
    }
}
