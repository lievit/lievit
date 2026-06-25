/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit.schema.infolist;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

import dev.lievit.kit.support.EvaluationContext;

/**
 * A labelled, bordered group of infolist entries (the filament {@code Fieldset} layout carried onto
 * the View page): a legend plus a grid of child components, lighter than a {@link InfolistSection}
 * (no description / collapse / actions). The View-page mirror of the form
 * {@link dev.lievit.kit.schema.Fieldset}.
 */
public final class InfolistFieldset implements InfolistComponent {

    private final String label;
    private int columns = 2;
    private int columnSpan = 1;
    private final List<InfolistComponent> children = new ArrayList<>();

    private InfolistFieldset(String label) {
        this.label = Objects.requireNonNull(label, "label");
    }

    /**
     * @param label the fieldset legend
     * @return a new fieldset
     */
    public static InfolistFieldset make(String label) {
        return new InfolistFieldset(label);
    }

    /**
     * Adds child components in declaration order.
     *
     * @param toAdd the children
     * @return this fieldset
     */
    public InfolistFieldset schema(InfolistComponent... toAdd) {
        for (InfolistComponent c : toAdd) {
            children.add(Objects.requireNonNull(c, "component"));
        }
        return this;
    }

    /**
     * Lays children out in an {@code n}-column grid (filament default 2).
     *
     * @param columns the column count (at least 1)
     * @return this fieldset
     */
    public InfolistFieldset columns(int columns) {
        if (columns < 1) {
            throw new IllegalArgumentException("columns must be at least 1");
        }
        this.columns = columns;
        return this;
    }

    /**
     * Sets how many parent grid columns this fieldset spans.
     *
     * @param columnSpan the span (at least 1)
     * @return this fieldset
     */
    public InfolistFieldset columnSpan(int columnSpan) {
        if (columnSpan < 1) {
            throw new IllegalArgumentException("columnSpan must be at least 1");
        }
        this.columnSpan = columnSpan;
        return this;
    }

    /** @return the legend */
    public String label() {
        return label;
    }

    /** @return the column count (default 2) */
    public int columns() {
        return columns;
    }

    /** @return the parent column span (default 1) */
    public int columnSpan() {
        return columnSpan;
    }

    /** @return the children in declaration order (unmodifiable) */
    public List<InfolistComponent> children() {
        return List.copyOf(children);
    }

    @Override
    public ResolvedNode resolveNode(EvaluationContext context) {
        List<ResolvedNode> resolved = new ArrayList<>();
        for (InfolistComponent child : children) {
            if (child.isVisibleComponent()) {
                resolved.add(child.resolveNode(context));
            }
        }
        return new ResolvedNode.FieldsetNode(label, columns, columnSpan, resolved);
    }
}
