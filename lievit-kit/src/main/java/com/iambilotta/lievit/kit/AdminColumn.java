/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package com.iambilotta.lievit.kit;

import java.util.Objects;
import java.util.function.Function;

import org.jspecify.annotations.Nullable;

/**
 * One column of an {@link AdminTable}: a label plus a value extractor over the row type (the
 * filament-internals.md {@code TextColumn} carried over, minus the macro surface).
 *
 * @param <T> the row type
 */
public final class AdminColumn<T> {

    private final String label;
    private final Function<? super T, ?> value;

    /**
     * @param label the column header
     * @param value extracts the cell value from a row
     */
    AdminColumn(String label, Function<? super T, ?> value) {
        this.label = Objects.requireNonNull(label, "label");
        this.value = Objects.requireNonNull(value, "value");
    }

    /**
     * @return the column header
     */
    public String label() {
        return label;
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
