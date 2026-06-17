/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit;

import java.util.Objects;
import java.util.function.BiFunction;
import java.util.function.Function;

import org.jspecify.annotations.Nullable;

/**
 * An inline-editable text column (the Filament {@code TextInputColumn}): the user edits the cell as
 * a text field and the new value is applied to the row via the update transform, then persisted by
 * the page. An optional validator rejects an invalid edit before the row is updated.
 *
 * @param <T> the row type
 */
public final class TextInputColumn<T> extends Column<T> implements EditableColumn<T> {

    private final BiFunction<T, String, T> updater;
    private @Nullable Function<String, @Nullable String> validator;

    private TextInputColumn(String label, Function<? super T, ?> extractor, BiFunction<T, String, T> updater) {
        super(label, extractor);
        this.updater = updater;
    }

    /**
     * @param label the column header
     * @param extractor reads the current text value from a row
     * @param onUpdate applies a new text value to a row, returning the updated row
     * @param <T> the row type
     * @return a new text-input column
     */
    public static <T> TextInputColumn<T> make(
            String label, Function<? super T, ?> extractor, BiFunction<T, String, T> onUpdate) {
        return new TextInputColumn<>(label, extractor, Objects.requireNonNull(onUpdate, "onUpdate"));
    }

    /**
     * Sets a validator: a function returning an error message for an invalid value, or {@code null}
     * if the value is valid.
     *
     * @param fn the validator
     * @return this column
     */
    public TextInputColumn<T> rule(Function<String, @Nullable String> fn) {
        this.validator = Objects.requireNonNull(fn, "fn");
        return this;
    }

    /**
     * Validates a candidate value.
     *
     * @param value the submitted value
     * @return the error message if invalid, or empty if valid
     */
    public java.util.Optional<String> validate(String value) {
        if (validator == null) {
            return java.util.Optional.empty();
        }
        return java.util.Optional.ofNullable(validator.apply(value));
    }

    @Override
    public T applyEdit(T row, String newValue) {
        return updater.apply(row, newValue);
    }
}
