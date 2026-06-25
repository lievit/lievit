/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit.schema;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

import org.jspecify.annotations.Nullable;

/**
 * The path-addressable state of a schema (the filament-schemas {@code HasState} state array carried
 * over): a nested map keyed by dot state paths, so a field at {@code items.1.qty} reads and writes
 * two levels into a repeater. This is the substrate the whole schemas engine sits on: every field's
 * {@code statePath} resolves against one of these, and the {@link dev.lievit.kit.support.EvaluationContext}
 * {@code get}/{@code set} bottom out here.
 *
 * <p>Path grammar: dot-separated segments; a numeric segment indexes into a {@link List} (a repeater
 * row), a non-numeric segment keys into a {@link Map} (a field or a nested container). Reading a
 * missing path yields {@code null}; writing a missing path creates the intermediate maps/lists.
 */
public final class SchemaState {

    private final Map<String, @Nullable Object> root;

    private SchemaState(Map<String, @Nullable Object> root) {
        this.root = root;
    }

    /**
     * @return a new, empty state
     */
    public static SchemaState empty() {
        return new SchemaState(new LinkedHashMap<>());
    }

    /**
     * Builds a state from an existing flat or nested map (defensively deep-ish copied at the top
     * level; nested maps/lists are taken as-is, the caller must not retain references it mutates).
     *
     * @param values the initial values
     * @return a state wrapping a copy of the values
     */
    public static SchemaState of(Map<String, @Nullable Object> values) {
        return new SchemaState(new LinkedHashMap<>(Objects.requireNonNull(values, "values")));
    }

    /**
     * Reads the value at a dot state path.
     *
     * @param path the dot path ({@code "country"}, {@code "items.1.qty"})
     * @return the value, or {@code null} if any segment is missing
     */
    public @Nullable Object get(String path) {
        Object node = root;
        for (String segment : segments(path)) {
            node = step(node, segment);
            if (node == null) {
                return null;
            }
        }
        return node;
    }

    /**
     * Reads the value at a path coerced to {@code String} (empty string when missing/null).
     *
     * @param path the dot path
     * @return the value as a non-null string
     */
    public String getString(String path) {
        @Nullable Object value = get(path);
        return value == null ? "" : String.valueOf(value);
    }

    /**
     * Writes a value at a dot state path, creating intermediate maps (for keys) and lists (for
     * numeric indices) as needed.
     *
     * @param path the dot path
     * @param value the value to write
     */
    @SuppressWarnings("unchecked")
    public void set(String path, @Nullable Object value) {
        List<String> segments = segments(path);
        Object node = root;
        for (int i = 0; i < segments.size() - 1; i++) {
            String segment = segments.get(i);
            boolean nextIsIndex = isIndex(segments.get(i + 1));
            Object child = step(node, segment);
            if (child == null || !containerMatches(child, nextIsIndex)) {
                child = nextIsIndex ? new ArrayList<>() : new LinkedHashMap<String, Object>();
                put(node, segment, child);
            }
            node = child;
        }
        put(node, segments.get(segments.size() - 1), value);
    }

    /**
     * @return a flat snapshot of every leaf path to its value (the dehydrated, persist-ready view)
     */
    public Map<String, @Nullable Object> flatten() {
        Map<String, @Nullable Object> out = new LinkedHashMap<>();
        flattenInto("", root, out);
        return out;
    }

    /**
     * @return the underlying nested map as an unmodifiable view (the structured form)
     */
    public Map<String, @Nullable Object> asMap() {
        return Map.copyOf(root);
    }

    private static List<String> segments(String path) {
        Objects.requireNonNull(path, "path");
        if (path.isEmpty()) {
            throw new IllegalArgumentException("state path must not be empty");
        }
        return List.of(path.split("\\."));
    }

    private static boolean isIndex(String segment) {
        if (segment.isEmpty()) {
            return false;
        }
        for (int i = 0; i < segment.length(); i++) {
            if (!Character.isDigit(segment.charAt(i))) {
                return false;
            }
        }
        return true;
    }

    private static boolean containerMatches(Object node, boolean wantList) {
        return wantList ? node instanceof List : node instanceof Map;
    }

    @SuppressWarnings("unchecked")
    private static @Nullable Object step(Object node, String segment) {
        if (node instanceof Map<?, ?> map) {
            return ((Map<String, Object>) map).get(segment);
        }
        if (node instanceof List<?> list && isIndex(segment)) {
            int idx = Integer.parseInt(segment);
            return idx >= 0 && idx < list.size() ? list.get(idx) : null;
        }
        return null;
    }

    @SuppressWarnings("unchecked")
    private static void put(Object node, String segment, @Nullable Object value) {
        if (node instanceof Map<?, ?> map) {
            ((Map<String, Object>) map).put(segment, value);
        } else if (node instanceof List<?> list && isIndex(segment)) {
            List<Object> typed = (List<Object>) list;
            int idx = Integer.parseInt(segment);
            while (typed.size() <= idx) {
                typed.add(null);
            }
            typed.set(idx, value);
        } else {
            throw new IllegalStateException("cannot write segment \"" + segment + "\" into " + node);
        }
    }

    @SuppressWarnings("unchecked")
    private static void flattenInto(String prefix, Object node, Map<String, @Nullable Object> out) {
        if (node instanceof Map<?, ?> map) {
            for (Map.Entry<String, Object> e : ((Map<String, Object>) map).entrySet()) {
                flattenInto(join(prefix, e.getKey()), e.getValue(), out);
            }
        } else if (node instanceof List<?> list) {
            for (int i = 0; i < list.size(); i++) {
                flattenInto(join(prefix, Integer.toString(i)), list.get(i), out);
            }
        } else {
            out.put(prefix, node);
        }
    }

    private static String join(String prefix, String segment) {
        return prefix.isEmpty() ? segment : prefix + "." + segment;
    }
}
