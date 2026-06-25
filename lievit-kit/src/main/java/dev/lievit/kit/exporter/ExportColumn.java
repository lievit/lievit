/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit.exporter;

import java.util.Objects;
import java.util.function.Function;

import org.jspecify.annotations.Nullable;

/**
 * One column of an {@link Exporter} (the Filament {@code ExportColumn}): a stable name, a human
 * label (the header cell), a value extractor that maps a row to its raw value, and an optional
 * formatter that turns that value into the exported cell string (the Filament {@code formatStateUsing}
 * / {@code enabledByDefault}). A column can be off by default, so the modal offers it unchecked.
 *
 * @param <T> the row type
 */
public final class ExportColumn<T> {

    private final String name;
    private final Function<? super T, ?> value;

    private @Nullable String label;
    private Function<@Nullable Object, String> formatter = v -> v == null ? "" : String.valueOf(v);
    private boolean enabledByDefault = true;

    private ExportColumn(String name, Function<? super T, ?> value) {
        this.name = Objects.requireNonNull(name, "name");
        this.value = Objects.requireNonNull(value, "value");
    }

    /**
     * Declares an export column.
     *
     * @param name the stable column name
     * @param value extracts the raw value from a row
     * @param <T> the row type
     * @return the column
     */
    public static <T> ExportColumn<T> of(String name, Function<? super T, ?> value) {
        return new ExportColumn<>(name, value);
    }

    /**
     * Sets the header label (defaults to the name).
     *
     * @param label the header label
     * @return this column
     */
    public ExportColumn<T> label(String label) {
        this.label = Objects.requireNonNull(label, "label");
        return this;
    }

    /**
     * Sets how the extracted value is rendered into the exported cell (the Filament
     * {@code formatStateUsing}).
     *
     * @param formatter maps the raw value (possibly null) to the cell string
     * @return this column
     */
    public ExportColumn<T> format(Function<@Nullable Object, String> formatter) {
        this.formatter = Objects.requireNonNull(formatter, "formatter");
        return this;
    }

    /**
     * Marks the column off by default in the column-selection modal (the Filament
     * {@code enabledByDefault(false)}).
     *
     * @return this column
     */
    public ExportColumn<T> disabledByDefault() {
        this.enabledByDefault = false;
        return this;
    }

    /** @return the stable column name */
    public String name() {
        return name;
    }

    /** @return the header label */
    public String label() {
        return label != null ? label : name;
    }

    /** @return whether the column is selected by default */
    public boolean isEnabledByDefault() {
        return enabledByDefault;
    }

    /**
     * Renders a row's cell for this column: extract then format.
     *
     * @param row the row
     * @return the exported cell string
     */
    public String cell(T row) {
        return formatter.apply(value.apply(row));
    }
}
