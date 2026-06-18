/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.wire.synth;

import java.util.LinkedHashMap;
import java.util.Map;

import org.jspecify.annotations.Nullable;

/**
 * A schemaless, open-shape {@code @Wire} property: the JVM analogue of the dynamic object Livewire
 * binds from a PHP {@code stdClass} (the {@code SupportStdClasses} feature, issue #137). It holds
 * ad-hoc form state with no declared class: a {@code l:model.live="obj.field"} update binds a dotted
 * path, {@link #set(String, Object)} creates the missing nested keys along the path, and the whole
 * object round-trips through dehydrate / hydrate as a plain String-keyed JSON map.
 *
 * <p>The backing store is a {@link LinkedHashMap} of plain JSON data (scalars, lists, and nested
 * {@code DynamicObject}s for intermediate path segments), so the value the wire carries is always
 * the ADR-0013 allowlisted shape: a dynamic object never smuggles a typed Java object. A nested key
 * is itself a {@code DynamicObject}, so {@code set("a.b.c", 1)} walks (and creates) {@code a} then
 * {@code b} as dynamic objects and writes {@code c} on the deepest one. Depth is bounded by the
 * {@link io.lievit.wire.PayloadGuard} nesting cap on the inbound update path (ADR-0013), so a
 * pathological deep set is refused before it reaches here.
 *
 * <p>Pure Java, zero Spring (ADR-0007). Not thread-safe: a component instance is per-request.
 */
public final class DynamicObject {

    /** Separates the segments of a dotted bind path ({@code "address.city"}). */
    private static final char PATH_SEPARATOR = '.';

    private final Map<String, @Nullable Object> backing;

    /** Creates an empty dynamic object (the common case: an as-yet-unfilled ad-hoc form). */
    public DynamicObject() {
        this.backing = new LinkedHashMap<>();
    }

    /**
     * Creates a dynamic object over an existing String-keyed map, deep-copying nested maps into their
     * own {@code DynamicObject}s so the dotted-path operations work uniformly at every level. Used by
     * the {@link io.lievit.wire.synth.builtin.DynamicObjectSynthesizer} on hydrate.
     *
     * @param source a plain JSON map (String keys, scalar / list / nested-map values)
     */
    public DynamicObject(Map<String, ?> source) {
        this.backing = new LinkedHashMap<>();
        for (Map.Entry<String, ?> e : source.entrySet()) {
            backing.put(e.getKey(), adopt(e.getValue()));
        }
    }

    /**
     * Reads the value at a dotted path, or {@code null} if any segment is absent.
     *
     * @param path a dotted bind path ({@code "address.city"}) or a plain key ({@code "name"})
     * @return the value at the path, or {@code null} when the path does not resolve
     */
    public @Nullable Object get(String path) {
        int dot = path.indexOf(PATH_SEPARATOR);
        if (dot < 0) {
            return backing.get(path);
        }
        String head = path.substring(0, dot);
        Object child = backing.get(head);
        if (child instanceof DynamicObject nested) {
            return nested.get(path.substring(dot + 1));
        }
        return null;
    }

    /**
     * Sets the value at a dotted path, creating any missing intermediate keys as nested dynamic
     * objects (the {@code stdClass} deep-set semantics: assigning {@code obj.a.b} on an empty object
     * materializes {@code a}). An intermediate segment whose current value is not a dynamic object is
     * overwritten with a fresh one, so the path always resolves to the requested depth.
     *
     * @param path a dotted bind path ({@code "a.b.c"}) or a plain key ({@code "name"})
     * @param value the plain JSON value to store at the leaf
     */
    public void set(String path, @Nullable Object value) {
        int dot = path.indexOf(PATH_SEPARATOR);
        if (dot < 0) {
            backing.put(path, value);
            return;
        }
        String head = path.substring(0, dot);
        Object child = backing.get(head);
        DynamicObject nested;
        if (child instanceof DynamicObject existing) {
            nested = existing;
        } else {
            // The segment is absent (or held a leaf value): materialize a fresh nested object so the
            // remaining path can be created under it. This is the create-missing-keys behavior.
            nested = new DynamicObject();
            backing.put(head, nested);
        }
        nested.set(path.substring(dot + 1), value);
    }

    /**
     * @param key a top-level key
     * @return true if the key is present at the top level
     */
    public boolean has(String key) {
        return backing.containsKey(key);
    }

    /**
     * @return true if the object holds no keys
     */
    public boolean isEmpty() {
        return backing.isEmpty();
    }

    /**
     * Renders this object (recursively) as a plain String-keyed JSON map: every nested
     * {@code DynamicObject} becomes a nested map. This is the wire form the synthesizer dehydrates,
     * and it is plain JSON data (ADR-0013), never a typed object.
     *
     * @return the plain JSON map form of this dynamic object
     */
    public Map<String, @Nullable Object> toMap() {
        Map<String, @Nullable Object> out = new LinkedHashMap<>();
        for (Map.Entry<String, @Nullable Object> e : backing.entrySet()) {
            Object v = e.getValue();
            out.put(e.getKey(), v instanceof DynamicObject nested ? nested.toMap() : v);
        }
        return out;
    }

    /** Deep-copies a String-keyed map value into a nested {@code DynamicObject}; leaves the rest. */
    private static @Nullable Object adopt(@Nullable Object value) {
        if (value instanceof Map<?, ?> map) {
            DynamicObject nested = new DynamicObject();
            for (Map.Entry<?, ?> e : map.entrySet()) {
                // Only String-keyed maps are valid JSON objects; a non-String key is left as-is so
                // the value is not silently coerced (it would not have passed the PayloadGuard anyway).
                if (e.getKey() instanceof String key) {
                    nested.backing.put(key, adopt(e.getValue()));
                } else {
                    return value;
                }
            }
            return nested;
        }
        return value;
    }

    @Override
    public boolean equals(@Nullable Object o) {
        return o instanceof DynamicObject other && backing.equals(other.backing);
    }

    @Override
    public int hashCode() {
        return backing.hashCode();
    }

    @Override
    public String toString() {
        return "DynamicObject" + backing;
    }
}
