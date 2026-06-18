/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit.schema.infolist;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

import org.jspecify.annotations.Nullable;

import io.lievit.kit.support.EvaluationContext;
import io.lievit.kit.support.EvaluationContext.Operation;

/**
 * A repeatable infolist entry (the filament-infolists {@code RepeatableEntry} carried over): loops a
 * child schema of {@link Entry}s over a list-valued attribute (a HasMany relation read or an array),
 * the read-only mirror of a {@link io.lievit.kit.schema.Repeater}. Each item resolves its child
 * entries against the item's own attributes, so a child entry at {@code name} reads {@code items.N}'s
 * {@code name}.
 */
public final class RepeatableEntry extends Entry<RepeatableEntry> {

    private final List<Entry<?>> childSchema = new ArrayList<>();
    private int columns = 1;

    private RepeatableEntry(String name) {
        super(name);
    }

    /**
     * @param name the record attribute holding the list of items
     * @return a new repeatable entry
     */
    public static RepeatableEntry make(String name) {
        return new RepeatableEntry(name);
    }

    /**
     * Declares the child entries repeated per item.
     *
     * @param entries the child entries in display order
     * @return this entry
     */
    public RepeatableEntry schema(Entry<?>... entries) {
        for (Entry<?> entry : entries) {
            childSchema.add(Objects.requireNonNull(entry, "entry"));
        }
        return this;
    }

    /**
     * @return the child entries in declaration order (unmodifiable)
     */
    public List<Entry<?>> childSchema() {
        return List.copyOf(childSchema);
    }

    /**
     * Lays each item's entries out in an {@code n}-column grid.
     *
     * @param columns the column count (at least 1)
     * @return this entry
     */
    public RepeatableEntry columns(int columns) {
        if (columns < 1) {
            throw new IllegalArgumentException("columns must be at least 1");
        }
        this.columns = columns;
        return this;
    }

    /**
     * @return the per-item column count (default 1)
     */
    public int columns() {
        return columns;
    }

    /**
     * Resolves each item to its child-entry label-to-display map, in list order. An item that is not
     * a map yields an empty per-item map; a missing/non-list attribute yields no items.
     *
     * @param context the live evaluation context (its {@code get} reads the list attribute)
     * @return one ordered label-to-display map per item, in order
     */
    @SuppressWarnings("unchecked")
    public List<Map<String, String>> resolveItems(EvaluationContext context) {
        List<Map<String, String>> out = new ArrayList<>();
        @Nullable Object raw = context.get(statePath());
        if (!(raw instanceof List<?> list)) {
            return out;
        }
        for (Object element : list) {
            Map<String, @Nullable Object> item =
                    element instanceof Map<?, ?> map ? (Map<String, @Nullable Object>) map : Map.of();
            EvaluationContext itemContext =
                    EvaluationContext.readOnly(null, item, Operation.VIEW, item);
            Map<String, String> resolved = new LinkedHashMap<>();
            for (Entry<?> child : childSchema) {
                if (child.isVisible()) {
                    resolved.put(child.label(), child.resolveDisplay(itemContext));
                }
            }
            out.add(resolved);
        }
        return out;
    }
}
