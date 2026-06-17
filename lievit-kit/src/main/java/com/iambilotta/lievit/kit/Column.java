/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package com.iambilotta.lievit.kit;

import java.util.Objects;
import java.util.function.Function;

import org.jspecify.annotations.Nullable;

/**
 * One column of an {@link Table}: a label plus a value extractor over the row type (the
 * filament-internals.md {@code TextColumn} carried over, minus the macro surface).
 *
 * @param <T> the row type
 */
public class Column<T> {

    private final String label;
    private final Function<? super T, ?> value;
    private boolean sortable;

    /**
     * @param label the column header
     * @param value extracts the cell value from a row
     */
    Column(String label, Function<? super T, ?> value) {
        this(label, value, false);
    }

    /**
     * @param label    the column header
     * @param value    extracts the cell value from a row
     * @param sortable whether this column can be sorted in the table view
     */
    Column(String label, Function<? super T, ?> value, boolean sortable) {
        this.label = Objects.requireNonNull(label, "label");
        this.value = Objects.requireNonNull(value, "value");
        this.sortable = sortable;
    }

    /**
     * @return the column header
     */
    public String label() {
        return label;
    }

    /**
     * @return {@code true} if this column can be sorted in the table view
     */
    public boolean sortable() {
        return sortable;
    }

    /**
     * Sets the sortable flag. Package-private: called by typed-column fluent methods.
     *
     * @param sortable whether this column can be sorted
     */
    void setSortable(boolean sortable) {
        this.sortable = sortable;
    }

    /**
     * Renders the cell value for a row as text.
     *
     * @param row the row
     * @return the extracted value as a string, or the empty string if the extractor yields null
     */
    public String cell(T row) {
        @Nullable Object extracted = value.apply(row);
        return extracted == null ? "" : String.valueOf(extracted);
    }
}
