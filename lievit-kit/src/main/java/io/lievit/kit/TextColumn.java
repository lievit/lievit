/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit;

import java.util.Objects;
import java.util.function.Function;

import org.jspecify.annotations.Nullable;

/**
 * A plain text table column: renders the extracted value as a string, optionally formatted, limited,
 * linked, copyable, with a secondary description and a tooltip.
 *
 * <p>This is the default column type and the carrier of the shared presentation surface (the
 * Filament {@code CanFormatState} / {@code CanOpenUrl} / {@code CanBeCopied} / {@code HasDescription}
 * / {@code HasTooltip} concerns). It also exposes the table-behaviour fluent flags
 * ({@link #sortable()}, {@link #searchable()}, {@link #toggleable()}, {@link #hiddenFrom(String)}).
 *
 * @param <T> the row type
 */
public final class TextColumn<T> extends Column<T> {

    private @Nullable Function<Object, String> formatter;
    private int limit = -1;
    private @Nullable Function<? super T, String> url;
    private boolean copyable;
    private @Nullable Function<? super T, String> description;
    private @Nullable Function<? super T, String> tooltip;

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
     * Marks this column as sortable in the table view (sort affordance is shown, header click wires
     * to the query sort).
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

    /**
     * Marks this column searchable: it folds into the table's global search.
     *
     * @return this column
     */
    public TextColumn<T> searchable() {
        setSearchable(true);
        return this;
    }

    /**
     * Declares an explicit sort/search key decoupled from the label (e.g. the SQL column name).
     *
     * @param key the stable key
     * @return this column
     */
    public TextColumn<T> sortKey(String key) {
        setSortKey(key);
        return this;
    }

    /**
     * Lets the user hide/show this column from the column manager; visible by default.
     *
     * @return this column
     */
    public TextColumn<T> toggleable() {
        setToggleable(true, false);
        return this;
    }

    /**
     * Lets the user hide/show this column from the column manager.
     *
     * @param hiddenByDefault whether it starts hidden (the user opts it back in)
     * @return this column
     */
    public TextColumn<T> toggleable(boolean hiddenByDefault) {
        setToggleable(true, hiddenByDefault);
        return this;
    }

    /**
     * Hides this column below the given responsive breakpoint (e.g. {@code "md"}).
     *
     * @param breakpoint the breakpoint name
     * @return this column
     */
    public TextColumn<T> hiddenFrom(String breakpoint) {
        setHiddenFrom(breakpoint);
        return this;
    }

    /**
     * Formats the raw cell value before rendering (the {@code formatStateUsing} concern).
     *
     * @param fn maps the raw value (possibly null) to the displayed string
     * @return this column
     */
    public TextColumn<T> formatStateUsing(Function<Object, String> fn) {
        this.formatter = Objects.requireNonNull(fn, "fn");
        return this;
    }

    /**
     * Formats the cell as a money amount in the given currency (a convenience over
     * {@link #formatStateUsing}).
     *
     * @param currencyCode an ISO 4217 currency code (e.g. {@code "EUR"})
     * @return this column
     */
    public TextColumn<T> money(String currencyCode) {
        java.util.Currency currency = java.util.Currency.getInstance(currencyCode);
        this.formatter =
                v -> {
                    if (v == null) {
                        return "";
                    }
                    java.text.NumberFormat nf = java.text.NumberFormat.getCurrencyInstance();
                    nf.setCurrency(currency);
                    return nf.format(toAmount(v));
                };
        return this;
    }

    /**
     * Coerces a raw cell value to a numeric amount for {@link #money(String)}. Accepts any
     * {@link Number} directly and a numeric {@link String} by parsing it. Any other type, or a
     * String that is not a number, yields a clear {@link IllegalArgumentException} instead of the
     * raw {@link ClassCastException} a blind {@code (Number) v} cast would throw at render time.
     */
    private static double toAmount(Object v) {
        if (v instanceof Number number) {
            return number.doubleValue();
        }
        if (v instanceof String s) {
            try {
                return Double.parseDouble(s.trim());
            } catch (NumberFormatException e) {
                throw new IllegalArgumentException(
                        "money() column value is not a number: \"" + s + "\"", e);
            }
        }
        throw new IllegalArgumentException(
                "money() column value must be a Number or a numeric String, got "
                        + v.getClass().getName());
    }

    /**
     * Truncates the rendered string to at most {@code n} characters, appending an ellipsis.
     *
     * @param n the maximum length (a non-positive value disables truncation)
     * @return this column
     */
    public TextColumn<T> limit(int n) {
        this.limit = n;
        return this;
    }

    /**
     * Makes the cell a link to the URL derived from the row.
     *
     * @param fn maps a row to its URL
     * @return this column
     */
    public TextColumn<T> url(Function<? super T, String> fn) {
        this.url = Objects.requireNonNull(fn, "fn");
        return this;
    }

    /**
     * Renders a copy-to-clipboard affordance on the cell.
     *
     * @return this column
     */
    public TextColumn<T> copyable() {
        this.copyable = true;
        return this;
    }

    /**
     * Adds secondary descriptive text under the cell value.
     *
     * @param fn maps a row to its description
     * @return this column
     */
    public TextColumn<T> description(Function<? super T, String> fn) {
        this.description = Objects.requireNonNull(fn, "fn");
        return this;
    }

    /**
     * Adds a hover tooltip to the cell.
     *
     * @param fn maps a row to its tooltip text
     * @return this column
     */
    public TextColumn<T> tooltip(Function<? super T, String> fn) {
        this.tooltip = Objects.requireNonNull(fn, "fn");
        return this;
    }

    /** @return whether this column links its cells */
    public boolean hasUrl() {
        return url != null;
    }

    /**
     * @param row the row
     * @return the cell's link URL, or empty if this column is not linked
     */
    public java.util.Optional<String> urlFor(T row) {
        return url == null
                ? java.util.Optional.empty()
                : java.util.Optional.ofNullable(url.apply(row));
    }

    /** @return whether the cell is copyable */
    public boolean isCopyable() {
        return copyable;
    }

    /**
     * @param row the row
     * @return the cell's secondary description, or empty if none
     */
    public java.util.Optional<String> descriptionFor(T row) {
        return description == null
                ? java.util.Optional.empty()
                : java.util.Optional.ofNullable(description.apply(row));
    }

    /**
     * @param row the row
     * @return the cell's tooltip, or empty if none
     */
    public java.util.Optional<String> tooltipFor(T row) {
        return tooltip == null
                ? java.util.Optional.empty()
                : java.util.Optional.ofNullable(tooltip.apply(row));
    }

    @Override
    public String cell(T row) {
        String text;
        if (formatter != null) {
            text = formatter.apply(rawValue(row));
        } else {
            text = super.cell(row);
        }
        if (limit > 0 && text.length() > limit) {
            text = text.substring(0, limit) + "…";
        }
        return text;
    }
}
