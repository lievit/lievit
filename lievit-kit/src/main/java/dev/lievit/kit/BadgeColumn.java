/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit;

import java.util.Objects;
import java.util.function.Function;

import org.jspecify.annotations.Nullable;

/**
 * A badge column: renders the extracted value inside a styled badge element.
 *
 * <p>An optional {@link #color(Function) colour mapper} maps the raw cell value to a CSS class
 * name (for example {@code "badge-green"}, {@code "badge-red"}). The mapping function receives
 * the same {@code Object} that {@link #cell(Object)} returns — i.e., the string representation
 * — so callers can pattern-match on status strings without needing the full row type.
 *
 * @param <T> the row type
 */
public final class BadgeColumn<T> extends Column<T> {

    private @Nullable Function<String, String> colorMapper;
    private boolean dot;

    /**
     * Creates a badge column.
     *
     * @param label     the column header
     * @param extractor extracts the badge text from a row
     * @param <T>       the row type
     * @return a new badge column
     */
    public static <T> BadgeColumn<T> make(String label, Function<? super T, ?> extractor) {
        return new BadgeColumn<>(label, extractor);
    }

    private BadgeColumn(String label, Function<? super T, ?> extractor) {
        super(label, extractor);
    }

    /**
     * Sets a function that maps the cell's string value to a CSS class applied to the badge
     * element (for example status → colour class).
     *
     * @param mapper a non-null function from cell value to CSS class name
     * @return this column
     */
    public BadgeColumn<T> color(Function<String, String> mapper) {
        this.colorMapper = Objects.requireNonNull(mapper, "mapper");
        return this;
    }

    /**
     * Derives the CSS class for a row's badge, using the registered colour mapper.
     *
     * @param row the row
     * @return the CSS class, or an empty string if no mapper was registered
     */
    public String colorFor(T row) {
        if (colorMapper == null) {
            return "";
        }
        return colorMapper.apply(cell(row));
    }

    /**
     * Renders every badge in this column with a small leading status dot (the badge partial's
     * {@code dot=true} affordance), e.g. for a "soft" status pill that reads as tint + dot + label.
     *
     * @return this column
     */
    public BadgeColumn<T> dot() {
        this.dot = true;
        return this;
    }

    /**
     * @return whether this column's badges render a leading status dot
     */
    public boolean hasDot() {
        return dot;
    }

    /**
     * Renders a {@link Cell.Badge} carrying the cell text and the {@linkplain #colorFor(Object)
     * colour mapper}'s variant (so the template stamps the badge partial's
     * {@code <span class="lv-badge lv-badge--<variant>">}). A declared
     * {@link #url(java.util.function.Function) url mapper} still wraps it as a {@link Cell.Link}.
     */
    @Override
    public Cell cellFor(T row) {
        return linkify(row, new Cell.Badge(cell(row), colorFor(row), dot));
    }
}
