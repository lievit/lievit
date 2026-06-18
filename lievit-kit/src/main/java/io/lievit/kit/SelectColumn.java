/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit;

import java.util.List;
import java.util.Objects;
import java.util.function.BiFunction;
import java.util.function.Function;

/**
 * An inline-editable select column (the Filament {@code SelectColumn}): the user edits the cell as a
 * dropdown over a fixed option set and the chosen value is applied to the row via the update
 * transform, then persisted by the page through the {@link RecordRepository}. Rounds out the inline
 * edit-in-place trio beside {@link TextInputColumn} (free text) and {@link ToggleColumn} (boolean).
 *
 * <p>An edit to a value outside the declared options is rejected by {@link #validate} (the closed
 * vocabulary the dropdown enforces client-side, re-checked server-side), so a tampered wire value
 * cannot smuggle an off-list value into the row.
 *
 * @param <T> the row type
 */
public final class SelectColumn<T> extends Column<T> implements EditableColumn<T> {

    private final List<SelectOption> options;
    private final BiFunction<T, String, T> updater;

    private SelectColumn(
            String label,
            Function<? super T, ?> extractor,
            List<SelectOption> options,
            BiFunction<T, String, T> updater) {
        super(label, extractor);
        this.options = List.copyOf(options);
        this.updater = updater;
    }

    /**
     * @param label the column header
     * @param extractor reads the current value from a row
     * @param options the closed option set the dropdown offers
     * @param onUpdate applies the chosen value to a row, returning the updated row
     * @param <T> the row type
     * @return a new select column
     */
    public static <T> SelectColumn<T> make(
            String label,
            Function<? super T, ?> extractor,
            List<SelectOption> options,
            BiFunction<T, String, T> onUpdate) {
        return new SelectColumn<>(
                label,
                extractor,
                Objects.requireNonNull(options, "options"),
                Objects.requireNonNull(onUpdate, "onUpdate"));
    }

    /**
     * @return the option set offered in the dropdown (unmodifiable)
     */
    public List<SelectOption> options() {
        return options;
    }

    /**
     * Validates a candidate value against the closed option set.
     *
     * @param value the submitted value
     * @return an error message if the value is not one of the options, or empty if valid
     */
    public java.util.Optional<String> validate(String value) {
        boolean known = options.stream().anyMatch(o -> o.value().equals(value));
        return known ? java.util.Optional.empty() : java.util.Optional.of("invalid option");
    }

    @Override
    public T applyEdit(T row, String newValue) {
        if (validate(newValue).isPresent()) {
            throw new IllegalArgumentException("value '" + newValue + "' is not a valid option");
        }
        return updater.apply(row, newValue);
    }
}
