/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit;

import java.util.Objects;
import java.util.function.BiFunction;
import java.util.function.Function;

/**
 * An inline-editable boolean column rendered as a toggle (the Filament {@code ToggleColumn}): the
 * user flips it and the new value is applied to the row via the {@link #onUpdate} transform, then
 * persisted by the page through the {@link RecordRepository}.
 *
 * @param <T> the row type
 */
public final class ToggleColumn<T> extends Column<T> implements EditableColumn<T> {

    private final BiFunction<T, Boolean, T> updater;

    private ToggleColumn(String label, Function<? super T, ?> extractor, BiFunction<T, Boolean, T> updater) {
        super(label, extractor);
        this.updater = updater;
    }

    /**
     * @param label the column header
     * @param extractor reads the current boolean value from a row
     * @param onUpdate applies a new boolean to a row, returning the updated row
     * @param <T> the row type
     * @return a new toggle column
     */
    public static <T> ToggleColumn<T> make(
            String label, Function<? super T, Boolean> extractor, BiFunction<T, Boolean, T> onUpdate) {
        return new ToggleColumn<>(label, extractor, Objects.requireNonNull(onUpdate, "onUpdate"));
    }

    /**
     * @param row the row
     * @return the current boolean value of the cell
     */
    public boolean valueOf(T row) {
        return Boolean.TRUE.equals(rawValue(row));
    }

    @Override
    public T applyEdit(T row, String newValue) {
        boolean b = "true".equalsIgnoreCase(newValue) || "1".equals(newValue) || "on".equalsIgnoreCase(newValue);
        return updater.apply(row, b);
    }
}
