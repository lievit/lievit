/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit;

import java.util.function.Function;

/**
 * A plain text table column: renders the extracted value as a string with no decoration.
 *
 * <p>This is the default column type and maps directly to the existing {@link Column} behaviour.
 * The additional capability over the base type is the {@link #sortable()} fluent flag, which
 * informs the template that this column should render a sort affordance.
 *
 * @param <T> the row type
 */
public final class TextColumn<T> extends Column<T> {

    /**
     * Creates a text column with an explicit extractor.
     *
     * @param label    the column header
     * @param extractor extracts the displayed value from a row
     * @param <T>      the row type
     * @return a new text column
     */
    public static <T> TextColumn<T> make(String label, Function<? super T, ?> extractor) {
        return new TextColumn<>(label, extractor);
    }

    private TextColumn(String label, Function<? super T, ?> extractor) {
        super(label, extractor);
    }

    /**
     * Marks this column as sortable in the table view (sort affordance is shown).
     *
     * <p>Shorthand for {@code sortable(true)}.
     *
     * @return this column
     */
    public TextColumn<T> makeSortable() {
        setSortable(true);
        return this;
    }

    /**
     * Sets the sortable flag explicitly.
     *
     * @param s {@code true} to show a sort affordance
     * @return this column
     */
    public TextColumn<T> sortable(boolean s) {
        setSortable(s);
        return this;
    }
}
