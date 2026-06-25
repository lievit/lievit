/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit;

import java.util.function.Function;

/**
 * A column that renders the cell value as a colour swatch (the Filament {@code ColorColumn}): the
 * extracted value is a CSS colour string (e.g. {@code "#ff0000"}, {@code "rgb(...)"}) shown as a
 * small block, optionally copyable.
 *
 * @param <T> the row type
 */
public final class ColorColumn<T> extends Column<T> {

    private boolean copyable;

    /**
     * @param label the column header
     * @param extractor extracts the CSS colour string from a row
     * @param <T> the row type
     * @return a new colour column
     */
    public static <T> ColorColumn<T> make(String label, Function<? super T, ?> extractor) {
        return new ColorColumn<>(label, extractor);
    }

    private ColorColumn(String label, Function<? super T, ?> extractor) {
        super(label, extractor);
    }

    /**
     * Renders a copy-to-clipboard affordance on the swatch.
     *
     * @return this column
     */
    public ColorColumn<T> copyable() {
        this.copyable = true;
        return this;
    }

    /** @return the CSS colour string for a row */
    public String colorFor(T row) {
        return cell(row);
    }

    /** @return whether the swatch copies its colour on click */
    public boolean isCopyable() {
        return copyable;
    }
}
