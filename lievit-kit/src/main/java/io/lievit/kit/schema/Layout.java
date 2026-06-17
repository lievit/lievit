/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit.schema;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

import org.jspecify.annotations.Nullable;

/**
 * The base of every layout container (the filament-schemas {@code HasContainerGridLayout} carried
 * over): a component that holds a {@code schema} of child components and arranges them in an
 * {@code n}-column grid. A layout holds no state of its own (its {@code statePath} stays
 * {@code null}); its children dehydrate normally, so a layout participates in the state engine as a
 * transparent wrapper.
 *
 * @param <SELF> the concrete layout type, for fluent returns
 */
public abstract class Layout<SELF extends Layout<SELF>>
        extends SchemaComponent<@Nullable Object, SELF> {

    private final List<SchemaComponent<?, ?>> children = new ArrayList<>();
    private int columns = 1;
    private @Nullable Integer columnSpan;
    private boolean columnSpanFull;

    /**
     * Adds child components to this container.
     *
     * @param components the children, in declaration order
     * @return this layout
     */
    public SELF schema(SchemaComponent<?, ?>... components) {
        for (SchemaComponent<?, ?> c : components) {
            children.add(Objects.requireNonNull(c, "component"));
        }
        return self();
    }

    /**
     * @return the child components in declaration order (unmodifiable)
     */
    public List<SchemaComponent<?, ?>> children() {
        return List.copyOf(children);
    }

    /**
     * Lays children out in an {@code n}-column grid.
     *
     * @param columns the column count (at least 1)
     * @return this layout
     */
    public SELF columns(int columns) {
        if (columns < 1) {
            throw new IllegalArgumentException("columns must be at least 1");
        }
        this.columns = columns;
        return self();
    }

    /**
     * @return the column count (default 1)
     */
    public int columns() {
        return columns;
    }

    /**
     * Sets how many grid columns this container spans within its own parent.
     *
     * @param columnSpan the span
     * @return this layout
     */
    public SELF columnSpan(int columnSpan) {
        if (columnSpan < 1) {
            throw new IllegalArgumentException("columnSpan must be at least 1");
        }
        this.columnSpan = columnSpan;
        this.columnSpanFull = false;
        return self();
    }

    /**
     * Makes this container span all of its parent's columns.
     *
     * @return this layout
     */
    public SELF columnSpanFull() {
        this.columnSpanFull = true;
        this.columnSpan = null;
        return self();
    }

    /**
     * @return the configured column span, or {@code null} when none/full
     */
    public @Nullable Integer columnSpan() {
        return columnSpan;
    }

    /**
     * @return {@code true} if this container spans all parent columns
     */
    public boolean isColumnSpanFull() {
        return columnSpanFull;
    }
}
