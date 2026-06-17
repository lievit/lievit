/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package com.iambilotta.lievit.kit;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Objects;
import java.util.function.Function;

import org.jspecify.annotations.Nullable;

/**
 * The table-view builder of an {@link Resource}: an ordered list of {@link Column columns}
 * plus a row-id function, built with a fluent DSL (the filament-internals.md Table builder, on the
 * shared {@link Schema} parent).
 *
 * <p>The id function is how a list row maps to its edit/view route; it defaults to the row's own
 * {@code toString} so the simplest case (a String row) needs no configuration.
 *
 * @param <T> the row type
 */
public final class Table<T> extends Schema<T, Table<T>> {

    private final List<Column<T>> columns = new ArrayList<>();
    private @Nullable Function<? super T, String> idFunction;

    private Table() {}

    /**
     * @param <T> the row type
     * @return a new, empty table builder
     */
    public static <T> Table<T> create() {
        return new Table<>();
    }

    /**
     * Adds a column.
     *
     * @param label the column header
     * @param value extracts the cell value from a row
     * @return this builder
     */
    public Table<T> column(String label, Function<? super T, ?> value) {
        columns.add(new Column<>(label, value));
        return this;
    }

    /**
     * Declares how a row maps to its string id (used in the row's edit/view route).
     *
     * @param idFunction extracts the id from a row
     * @return this builder
     */
    public Table<T> id(Function<? super T, String> idFunction) {
        this.idFunction = Objects.requireNonNull(idFunction, "idFunction");
        return this;
    }

    /**
     * @return the columns, in declaration order, as an unmodifiable snapshot
     */
    public List<Column<T>> columns() {
        return Collections.unmodifiableList(columns);
    }

    /**
     * Derives a row's id.
     *
     * @param row the row
     * @return the declared id, or the row's {@code toString} if no id function was declared
     */
    public String idOf(T row) {
        if (idFunction != null) {
            return idFunction.apply(row);
        }
        return String.valueOf(row);
    }
}
