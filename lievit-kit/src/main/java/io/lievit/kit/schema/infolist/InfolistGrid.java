/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit.schema.infolist;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

import io.lievit.kit.support.EvaluationContext;

/**
 * A bare columns container for infolist entries (the filament {@code Grid} layout carried onto the
 * View page): no chrome, just an {@code n}-column grid its children lay out in. The View-page mirror
 * of the form {@link io.lievit.kit.schema.Grid}; use it to override the column count for a span of
 * entries inside a wider section.
 */
public final class InfolistGrid implements InfolistComponent {

    private int columns;
    private int columnSpan = 1;
    private final List<InfolistComponent> children = new ArrayList<>();

    private InfolistGrid(int columns) {
        if (columns < 1) {
            throw new IllegalArgumentException("columns must be at least 1");
        }
        this.columns = columns;
    }

    /**
     * @param columns the column count (at least 1)
     * @return a new grid
     */
    public static InfolistGrid make(int columns) {
        return new InfolistGrid(columns);
    }

    /**
     * @return a new single-column grid (the filament {@code Grid::make()} default before {@code
     *     columns()})
     */
    public static InfolistGrid make() {
        return new InfolistGrid(1);
    }

    /**
     * Adds child components in declaration order.
     *
     * @param toAdd the children
     * @return this grid
     */
    public InfolistGrid schema(InfolistComponent... toAdd) {
        for (InfolistComponent c : toAdd) {
            children.add(Objects.requireNonNull(c, "component"));
        }
        return this;
    }

    /**
     * Sets the column count.
     *
     * @param columns the column count (at least 1)
     * @return this grid
     */
    public InfolistGrid columns(int columns) {
        if (columns < 1) {
            throw new IllegalArgumentException("columns must be at least 1");
        }
        this.columns = columns;
        return this;
    }

    /**
     * Sets how many parent grid columns this grid spans.
     *
     * @param columnSpan the span (at least 1)
     * @return this grid
     */
    public InfolistGrid columnSpan(int columnSpan) {
        if (columnSpan < 1) {
            throw new IllegalArgumentException("columnSpan must be at least 1");
        }
        this.columnSpan = columnSpan;
        return this;
    }

    /** @return the column count */
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
        return new ResolvedNode.GridNode(columns, columnSpan, resolved);
    }
}
