/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package com.iambilotta.lievit.kit;

import java.time.format.DateTimeFormatter;
import java.time.temporal.TemporalAccessor;
import java.util.Objects;
import java.util.function.Function;

import org.jspecify.annotations.Nullable;

/**
 * A date/datetime table column: renders a {@link java.time.temporal.TemporalAccessor} value as a
 * formatted date string.
 *
 * <p>If a {@link #format(String) formatter pattern} is declared the column applies
 * {@link DateTimeFormatter#ofPattern(String)} to the extracted value; otherwise it falls back to
 * the temporal's own {@code toString()}.
 *
 * @param <T> the row type
 */
public final class DateColumn<T> extends Column<T> {

    private final Function<? super T, ? extends TemporalAccessor> temporalExtractor;
    private @Nullable String pattern;

    /**
     * Creates a date column.
     *
     * @param label             the column header
     * @param temporalExtractor extracts the temporal value from a row
     * @param <T>               the row type
     * @return a new date column
     */
    public static <T> DateColumn<T> make(
            String label, Function<? super T, ? extends TemporalAccessor> temporalExtractor) {
        return new DateColumn<>(label, temporalExtractor);
    }

    private DateColumn(
            String label, Function<? super T, ? extends TemporalAccessor> temporalExtractor) {
        super(label, temporalExtractor::apply);
        this.temporalExtractor = Objects.requireNonNull(temporalExtractor, "temporalExtractor");
    }

    /**
     * Sets the {@link DateTimeFormatter} pattern used to render the date value.
     *
     * @param pattern a non-null formatter pattern string (e.g. {@code "dd/MM/yyyy"})
     * @return this column
     */
    public DateColumn<T> format(String pattern) {
        this.pattern = Objects.requireNonNull(pattern, "pattern");
        return this;
    }

    /**
     * @return the formatter pattern, or {@code null} if none was declared
     */
    public @Nullable String pattern() {
        return pattern;
    }

    /**
     * Renders the date value for a row.
     *
     * <p>Applies the declared formatter pattern if set; otherwise returns the temporal's
     * own {@code toString()}.
     *
     * @param row the row
     * @return the formatted date string
     */
    @Override
    public String cell(T row) {
        TemporalAccessor temporal = temporalExtractor.apply(row);
        if (temporal == null) {
            return "";
        }
        if (pattern != null) {
            return DateTimeFormatter.ofPattern(pattern).format(temporal);
        }
        return temporal.toString();
    }
}
