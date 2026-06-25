/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit.schema;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;

import org.jspecify.annotations.Nullable;

/**
 * A key-value map editor (the filament-forms {@code KeyValue} carried over): edits an associative
 * map of string keys to string values as a list of editable rows (add, delete, optionally reorder).
 * It binds an ORDERED {@link Map} ({@link LinkedHashMap}) so the row order round-trips; the cast
 * hydrates a raw map straight through and dehydrates a defensive ordered copy.
 *
 * <p>Custom row labels ({@code keyLabel}/{@code valueLabel}) and the add-button label are
 * presentation; reorderability and add/delete-ability are behavior flags.
 */
public final class KeyValue extends SchemaField<Map<String, String>, KeyValue> {

    private String keyLabel = "Key";
    private String valueLabel = "Value";
    private String addActionLabel = "Add row";
    private boolean reorderable;
    private boolean addable = true;
    private boolean deletable = true;

    private KeyValue(String name) {
        super(name);
        cast(mapCast());
    }

    /**
     * @param name the field name and state path
     * @return a new key-value editor bound to an ordered string map
     */
    public static KeyValue make(String name) {
        return new KeyValue(name);
    }

    /**
     * Sets the column header for the key column.
     *
     * @param keyLabel the key column label
     * @return this field
     */
    public KeyValue keyLabel(String keyLabel) {
        this.keyLabel = Objects.requireNonNull(keyLabel, "keyLabel");
        return this;
    }

    /**
     * @return the key column label (default {@code "Key"})
     */
    public String keyLabel() {
        return keyLabel;
    }

    /**
     * Sets the column header for the value column.
     *
     * @param valueLabel the value column label
     * @return this field
     */
    public KeyValue valueLabel(String valueLabel) {
        this.valueLabel = Objects.requireNonNull(valueLabel, "valueLabel");
        return this;
    }

    /**
     * @return the value column label (default {@code "Value"})
     */
    public String valueLabel() {
        return valueLabel;
    }

    /**
     * Sets the add-row button label.
     *
     * @param addActionLabel the button label
     * @return this field
     */
    public KeyValue addActionLabel(String addActionLabel) {
        this.addActionLabel = Objects.requireNonNull(addActionLabel, "addActionLabel");
        return this;
    }

    /**
     * @return the add-row button label (default {@code "Add row"})
     */
    public String addActionLabel() {
        return addActionLabel;
    }

    /**
     * Makes the rows drag-reorderable (the order is preserved by the ordered-map binding).
     *
     * @return this field
     */
    public KeyValue reorderable() {
        this.reorderable = true;
        return this;
    }

    /**
     * @return {@code true} if rows can be reordered
     */
    public boolean isReorderable() {
        return reorderable;
    }

    /**
     * Forbids adding rows (a fixed key set).
     *
     * @return this field
     */
    public KeyValue addable(boolean addable) {
        this.addable = addable;
        return this;
    }

    /**
     * @return {@code true} if rows can be added (default {@code true})
     */
    public boolean isAddable() {
        return addable;
    }

    /**
     * Forbids deleting rows.
     *
     * @param deletable whether rows can be deleted
     * @return this field
     */
    public KeyValue deletable(boolean deletable) {
        this.deletable = deletable;
        return this;
    }

    /**
     * @return {@code true} if rows can be deleted (default {@code true})
     */
    public boolean isDeletable() {
        return deletable;
    }

    /** A cast that round-trips an ordered string map; a null/non-map raw hydrates to an empty map. */
    static StateCast<Map<String, String>> mapCast() {
        return new StateCast<>() {
            @Override
            @SuppressWarnings("unchecked")
            public Map<String, String> hydrate(@Nullable Object raw) {
                Map<String, String> out = new LinkedHashMap<>();
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

            @Override
            public @Nullable Object dehydrate(@Nullable Map<String, String> value) {
                return value == null ? new LinkedHashMap<String, String>() : new LinkedHashMap<>(value);
            }
        };
    }
}
