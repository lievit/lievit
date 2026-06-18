/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.component;

import java.lang.reflect.Field;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import io.lievit.LievitSession;
import io.lievit.Wire;

/**
 * The {@code @LievitSession} fields of a component (ADR-0031, Livewire {@code #[Session]} parity):
 * the {@code @Wire} fields whose value is persisted into the HTTP session and restored on mount.
 * Reflected once per class and cached.
 *
 * <p>Each entry carries the field and its key template; {@link #resolveKey} derives the runtime key,
 * defaulting to {@code <component-fqn>.<field>} and interpolating a {@code {dotted.path}} placeholder
 * against component state when an explicit {@code key} is set.
 */
public final class SessionFields {

    private static final Map<Class<?>, SessionFields> CACHE = new ConcurrentHashMap<>();

    /** One session-persisted field: its {@link WireField} and the explicit key template (or empty). */
    public record Entry(WireField field, String keyTemplate) {}

    private final Class<?> type;
    private final List<Entry> entries;

    private SessionFields(Class<?> type, List<Entry> entries) {
        this.type = type;
        this.entries = entries;
    }

    /**
     * Reflects (and caches) the {@code @LievitSession} fields of a component class.
     *
     * @param type the component class
     * @return its session fields (empty when none are annotated)
     */
    public static SessionFields of(Class<?> type) {
        return CACHE.computeIfAbsent(type, SessionFields::reflect);
    }

    private static SessionFields reflect(Class<?> type) {
        ComponentMetadata metadata = ComponentMetadata.of(type);
        List<Entry> entries = new ArrayList<>();
        for (Field field : type.getDeclaredFields()) {
            LievitSession session = field.getAnnotation(LievitSession.class);
            if (session == null) {
                continue;
            }
            if (!field.isAnnotationPresent(Wire.class)) {
                throw new IllegalArgumentException(
                        type.getName() + "." + field.getName()
                                + " is @LievitSession but not @Wire: only a bound field can be"
                                + " session-persisted (ADR-0031)");
            }
            WireField wireField = metadata.wireFields().get(field.getName());
            entries.add(new Entry(wireField, session.key().strip()));
        }
        return new SessionFields(type, List.copyOf(entries));
    }

    /**
     * @return true if the component declares no {@code @LievitSession} fields (the common case)
     */
    public boolean isEmpty() {
        return entries.isEmpty();
    }

    /**
     * @return the session-persisted field entries, in declaration order
     */
    public List<Entry> entries() {
        return entries;
    }

    /**
     * Resolves the runtime session key for an entry against a component instance: the explicit key
     * template (with any {@code {dotted.path}} placeholder interpolated), or the derived default
     * {@code <component-fqn>.<field>}.
     *
     * @param entry the session field entry
     * @param instance the component instance (read for placeholder values)
     * @return the resolved session key
     */
    public String resolveKey(Entry entry, Object instance) {
        if (entry.keyTemplate().isEmpty()) {
            return type.getName() + "." + entry.field().name();
        }
        return PlaceholderNames.interpolate(entry.keyTemplate(), instance);
    }
}
