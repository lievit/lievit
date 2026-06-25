/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Objects;

import org.jspecify.annotations.Nullable;

/**
 * A header grouping of adjacent table columns under one shared super-header (the Filament
 * {@code ColumnGroup::make()}): the columns keep their own headers, and a second header row spans a
 * single labelled cell over the whole group (for example "Address" arching over Street / City / Zip).
 *
 * <p>The group is a presentation construct over the table's columns: it carries its label, an
 * optional {@link #alignment(String) alignment}, and the member columns in order. The list
 * view-model reads the registered groups to emit the grouped super-header row with the right
 * {@code colspan}; the data cells are unchanged. Ungrouped columns sit under an empty spanning cell
 * so the two header rows stay aligned.
 *
 * @param <T> the row type
 */
public final class ColumnGroup<T> {

    private final String label;
    private final List<Column<T>> columns = new ArrayList<>();
    private @Nullable String alignment;

    private ColumnGroup(String label) {
        this.label = Objects.requireNonNull(label, "label");
        if (label.isBlank()) {
            throw new IllegalArgumentException("column group label must be non-blank");
        }
    }

    /**
     * Creates a column group with the given super-header label.
     *
     * @param label the group super-header
     * @param <T>   the row type
     * @return a new, empty column group
     */
    public static <T> ColumnGroup<T> make(String label) {
        return new ColumnGroup<>(label);
    }

    /**
     * Creates a column group already populated with its member columns (the common case).
     *
     * @param label   the group super-header
     * @param columns the member columns, in order
     * @param <T>     the row type
     * @return a new column group over the given columns
     */
    @SafeVarargs
    public static <T> ColumnGroup<T> make(String label, Column<T>... columns) {
        ColumnGroup<T> group = new ColumnGroup<>(label);
        for (Column<T> column : columns) {
            group.columns.add(Objects.requireNonNull(column, "column"));
        }
        return group;
    }

    /**
     * Adds a member column to this group.
     *
     * @param column the column
     * @return this group
     */
    public ColumnGroup<T> column(Column<T> column) {
        columns.add(Objects.requireNonNull(column, "column"));
        return this;
    }

    /**
     * Sets the super-header alignment (the Filament {@code ->alignment(Alignment::Center)}); a
     * presentation hint the template reads (for example {@code "center"}, {@code "end"}).
     *
     * @param value the alignment token
     * @return this group
     */
    public ColumnGroup<T> alignment(String value) {
        this.alignment = Objects.requireNonNull(value, "value");
        return this;
    }

    /** @return the super-header label */
    public String label() {
        return label;
    }

    /** @return the member columns, in order, as an unmodifiable snapshot */
    public List<Column<T>> columns() {
        return Collections.unmodifiableList(columns);
    }

    /** @return the number of columns the super-header spans */
    public int span() {
        return columns.size();
    }

    /** @return the alignment token, or {@code null} for the default */
    public @Nullable String alignment() {
        return alignment;
    }
}
