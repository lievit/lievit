/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit.schema.infolist;

import java.util.LinkedHashMap;
import java.util.Map;

import org.jspecify.annotations.Nullable;

import dev.lievit.kit.support.EvaluationContext;

/**
 * A key-value infolist entry (the filament-infolists {@code KeyValueEntry} carried over): renders
 * the record's map attribute as a two-column read-only table, the View mirror of a
 * {@link dev.lievit.kit.schema.KeyValue} field. Custom column headers are presentation.
 */
public final class KeyValueEntry extends Entry<KeyValueEntry> {

    private String keyLabel = "Key";
    private String valueLabel = "Value";

    private KeyValueEntry(String name) {
        super(name);
    }

    /**
     * @param name the record attribute holding the map
     * @return a new key-value entry
     */
    public static KeyValueEntry make(String name) {
        return new KeyValueEntry(name);
    }

    /**
     * Sets the key column header.
     *
     * @param keyLabel the header
     * @return this entry
     */
    public KeyValueEntry keyLabel(String keyLabel) {
        this.keyLabel = java.util.Objects.requireNonNull(keyLabel, "keyLabel");
        return this;
    }

    /**
     * @return the key column header (default {@code "Key"})
     */
    public String keyLabel() {
        return keyLabel;
    }

    /**
     * Sets the value column header.
     *
     * @param valueLabel the header
     * @return this entry
     */
    public KeyValueEntry valueLabel(String valueLabel) {
        this.valueLabel = java.util.Objects.requireNonNull(valueLabel, "valueLabel");
        return this;
    }

    /**
     * @return the value column header (default {@code "Value"})
     */
    public String valueLabel() {
        return valueLabel;
    }

    /**
     * Resolves the record's attribute as an ordered string map (an empty map when the value is
     * absent or not a map).
     *
     * @param context the live evaluation context
     * @return the ordered key-value map
     */
    @SuppressWarnings("unchecked")
    public Map<String, String> resolveMap(EvaluationContext context) {
        Map<String, String> out = new LinkedHashMap<>();
        @Nullable Object raw = context.get(statePath());
        if (raw instanceof Map<?, ?> map) {
            for (Map.Entry<?, ?> e : ((Map<Object, Object>) map).entrySet()) {
                if (e.getKey() != null) {
                    out.put(
                            String.valueOf(e.getKey()),
                            e.getValue() == null ? "" : String.valueOf(e.getValue()));
                }
            }
        }
        return out;
    }

    /** @return {@code "keyvalue"}: this entry resolves as a key-value table, not a flat field. */
    @Override
    public String kind() {
        return "keyvalue";
    }

    /**
     * Resolves into a {@link ResolvedNode.KeyValue} carrying the ordered key-value pairs, the path
     * that finally invokes {@link #resolveMap} (the audit's "unwired" correctness fix: the structured
     * resolve reaches the map instead of flattening it to {@code String.valueOf(map)}).
     *
     * @param context the live evaluation context
     * @return the resolved key-value node
     */
    @Override
    public ResolvedNode resolveNode(EvaluationContext context) {
        return new ResolvedNode.KeyValue(label(), resolveMap(context), keyLabel(), valueLabel());
    }
}
