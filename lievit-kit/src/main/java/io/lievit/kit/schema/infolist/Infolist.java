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

    private final List<InfolistComponent> components = new ArrayList<>();
    private int columns = 1;

    private Infolist() {}

    /**
     * @return a new, empty infolist
     */
    public static Infolist make() {
        return new Infolist();
    }

    /**
     * Adds components to the infolist schema (entries AND layout: {@link InfolistSection},
     * {@link InfolistTabs}, {@link InfolistFieldset}, {@link InfolistGrid}). The carried-over
     * filament {@code schema()} accepts the same closed set of components a form does, so an infolist
     * can nest layout instead of being a flat list of entries.
     *
     * @param toAdd the components in display order
     * @return this infolist
     */
    public Infolist schema(InfolistComponent... toAdd) {
        for (InfolistComponent c : toAdd) {
            components.add(Objects.requireNonNull(c, "component"));
        }
        return this;
    }

    /**
     * @return the schema components in display order (unmodifiable)
     */
    public List<InfolistComponent> components() {
        return List.copyOf(components);
    }

    /**
     * @return the top-level entries in display order (unmodifiable); a convenience over the schema
     *     for a host that declared only entries (the back-compat flat case)
     */
    public List<Entry<?>> entries() {
        List<Entry<?>> out = new ArrayList<>();
        for (InfolistComponent c : components) {
            if (c instanceof Entry<?> entry) {
                out.add(entry);
            }
        }
        return List.copyOf(out);
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
        for (InfolistComponent c : components) {
            if (c instanceof Entry<?> entry && entry.isVisible()) {
                out.put(entry.label(), entry.resolveDisplay(context));
            }
        }
        return out;
    }

    /**
     * Resolves the WHOLE schema (layout included) into the structured {@link ResolvedNode} tree a
     * renderer paints: sections carry their children, tabs carry their tabs, a {@link KeyValueEntry}
     * carries its resolved map (the path that reaches {@link KeyValueEntry#resolveMap}, instead of
     * the flat {@link #resolve} that would flatten it to {@code String.valueOf(map)}). Hidden
     * components are skipped uniformly across leaves and containers.
     *
     * @param record the record attributes keyed by path
     * @return the resolved top-level nodes in display order
     */
    public List<ResolvedNode> resolveTree(Map<String, @Nullable Object> record) {
        EvaluationContext context = contextOver(record);
        List<ResolvedNode> out = new ArrayList<>();
        for (InfolistComponent c : components) {
            if (c.isVisibleComponent()) {
                out.add(c.resolveNode(context));
            }
        }
        return out;
    }

    /**
     * @return whether the schema declares any layout component (a {@link InfolistSection} /
     *     {@link InfolistTabs} / {@link InfolistFieldset} / {@link InfolistGrid}); a flat
     *     entries-only infolist can take the simple {@link #resolve} path
     */
    public boolean hasLayout() {
        for (InfolistComponent c : components) {
            if (!(c instanceof Entry<?>)) {
                return true;
            }
        }
        return false;
    }
}
