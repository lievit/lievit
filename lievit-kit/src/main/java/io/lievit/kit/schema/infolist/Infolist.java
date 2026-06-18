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
 * A read-only infolist over a record (the filament-infolists {@code Infolist} schema carried over):
 * the View-page counterpart of a {@link io.lievit.kit.schema.SchemaForm}. It holds an ordered set of
 * {@link Entry}s and resolves each against a record's attributes under the {@link Operation#VIEW}
 * operation, producing the label-to-display map a renderer paints. Entries never dehydrate and are
 * never validated.
 *
 * <p>An entry resolves through an {@link EvaluationContext} whose {@code get} reads the record's
 * attributes by path, so an entry's {@code formatStateUsing} sees the raw attribute exactly as a
 * form field's closures see live state. The record is supplied as an attribute map (the common
 * case); a host with a domain object flattens it to a map at the boundary.
 */
public final class Infolist {

    private final List<Entry<?>> entries = new ArrayList<>();
    private int columns = 1;

    private Infolist() {}

    /**
     * @return a new, empty infolist
     */
    public static Infolist make() {
        return new Infolist();
    }

    /**
     * Adds entries to the infolist.
     *
     * @param toAdd the entries in display order
     * @return this infolist
     */
    public Infolist schema(Entry<?>... toAdd) {
        for (Entry<?> entry : toAdd) {
            entries.add(Objects.requireNonNull(entry, "entry"));
        }
        return this;
    }

    /**
     * @return the entries in display order (unmodifiable)
     */
    public List<Entry<?>> entries() {
        return List.copyOf(entries);
    }

    /**
     * Lays the entries out in an {@code n}-column grid.
     *
     * @param columns the column count (at least 1)
     * @return this infolist
     */
    public Infolist columns(int columns) {
        if (columns < 1) {
            throw new IllegalArgumentException("columns must be at least 1");
        }
        this.columns = columns;
        return this;
    }

    /**
     * @return the column count (default 1)
     */
    public int columns() {
        return columns;
    }

    /**
     * Builds the read-only {@link EvaluationContext} an entry resolves against, over the record's
     * attributes under the {@link Operation#VIEW} operation.
     *
     * @param record the record attributes keyed by path
     * @return the view context
     */
    public EvaluationContext contextOver(Map<String, @Nullable Object> record) {
        Objects.requireNonNull(record, "record");
        return EvaluationContext.readOnly(null, record, Operation.VIEW, record);
    }

    /**
     * Resolves every VISIBLE entry against a record, returning an ordered label-to-display map (the
     * placeholder is applied to empty values). This is the structured read a renderer paints.
     *
     * @param record the record attributes keyed by path
     * @return ordered label to display string for each visible entry
     */
    public Map<String, String> resolve(Map<String, @Nullable Object> record) {
        EvaluationContext context = contextOver(record);
        Map<String, String> out = new LinkedHashMap<>();
        for (Entry<?> entry : entries) {
            if (entry.isVisible()) {
                out.put(entry.label(), entry.resolveDisplay(context));
            }
        }
        return out;
    }
}
