/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit;

import java.util.Objects;
import java.util.function.Function;

/**
 * A boolean/icon table column: renders a boolean property as a named icon rather than the strings
 * {@code "true"} / {@code "false"}.
 *
 * <p>The icon names ({@link #trueIcon}/{@link #falseIcon}) are opaque to the kit; the template
 * resolves them to the icon set it uses (for example Web Awesome or Heroicons). Defaults:
 * {@value #DEFAULT_TRUE_ICON} / {@value #DEFAULT_FALSE_ICON}.
 *
 * <p>{@link #cell(Object)} returns the appropriate icon name so the template only needs one
 * expression per cell.
 *
 * @param <T> the row type
 */
public final class BooleanColumn<T> extends Column<T> {

    /** Default icon name returned when the property is {@code true}. */
    public static final String DEFAULT_TRUE_ICON = "check";

    /** Default icon name returned when the property is {@code false}. */
    public static final String DEFAULT_FALSE_ICON = "x";

    private final Function<? super T, Boolean> boolExtractor;
    private String trueIcon = DEFAULT_TRUE_ICON;
    private String falseIcon = DEFAULT_FALSE_ICON;

    /**
     * Creates a boolean column.
     *
     * @param label         the column header
     * @param boolExtractor extracts the boolean flag from a row
     * @param <T>           the row type
     * @return a new boolean column
     */
    public static <T> BooleanColumn<T> make(String label, Function<? super T, Boolean> boolExtractor) {
        return new BooleanColumn<>(label, boolExtractor);
    }

    private BooleanColumn(String label, Function<? super T, Boolean> boolExtractor) {
        // The base column's cell() path via the Function<T,?> constructor is intentionally
        // bypassed: BooleanColumn overrides cell() to return icon names. We supply a
        // sentinel extractor to satisfy the base constructor's non-null check.
        super(label, boolExtractor::apply);
        this.boolExtractor = Objects.requireNonNull(boolExtractor, "boolExtractor");
    }

    /**
     * Sets the icon name used when the boolean property is {@code true}.
     *
     * @param trueIcon a non-null, non-empty icon name
     * @return this column
     */
    public BooleanColumn<T> trueIcon(String trueIcon) {
        this.trueIcon = Objects.requireNonNull(trueIcon, "trueIcon");
        return this;
    }

    /**
     * Sets the icon name used when the boolean property is {@code false}.
     *
     * @param falseIcon a non-null icon name
     * @return this column
     */
    public BooleanColumn<T> falseIcon(String falseIcon) {
        this.falseIcon = Objects.requireNonNull(falseIcon, "falseIcon");
        return this;
    }

    /**
     * @return the icon name for the {@code true} state (default {@value #DEFAULT_TRUE_ICON})
     */
    public String trueIcon() {
        return trueIcon;
    }

    /**
     * @return the icon name for the {@code false} state (default {@value #DEFAULT_FALSE_ICON})
     */
    public String falseIcon() {
        return falseIcon;
    }

    /**
     * Returns the icon name for the row's boolean value.
     *
     * @param row the row
     * @return {@link #trueIcon} if the property is {@code true}, {@link #falseIcon} otherwise
     */
    @Override
    public String cell(T row) {
        Boolean value = boolExtractor.apply(row);
        return Boolean.TRUE.equals(value) ? trueIcon : falseIcon;
    }
}
