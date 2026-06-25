/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit;

import java.util.Objects;
import java.util.function.Function;

import org.jspecify.annotations.Nullable;

/**
 * A column that renders the cell as a "coloured dot + neutral text" pair (the status-dot pattern):
 * a small filled circle whose colour is mapped from the raw value, followed by the plain cell text.
 * The classic use is a category / type column where each value carries its own hue but reads as
 * plain text, not a saturated pill (the mock's Tipo column).
 *
 * <p>Domain-agnostic: the adopter supplies a value→colour-slug mapper and the value→text projection;
 * this column carries no business meaning. A declared {@link #url(java.util.function.Function) url
 * mapper} still wraps the cell as a {@link Cell.Link}.
 *
 * @param <T> the row type
 */
public final class DotTextColumn<T> extends Column<T> {

    private @Nullable Function<Object, @Nullable String> colorMapper;

    /**
     * @param label the column header
     * @param extractor extracts the raw value from a row
     * @param <T> the row type
     * @return a new dot-text column
     */
    public static <T> DotTextColumn<T> make(String label, Function<? super T, ?> extractor) {
        return new DotTextColumn<>(label, extractor);
    }

    private DotTextColumn(String label, Function<? super T, ?> extractor) {
        super(label, extractor);
    }

    /**
     * Maps the raw cell value to a dot colour slug (a lievit intent: {@code "info"},
     * {@code "success"}, {@code "warning"}, {@code "danger"}, or any {@code --lv-color-<slug>}).
     *
     * @param mapper the value→colour function
     * @return this column
     */
    public DotTextColumn<T> color(Function<Object, @Nullable String> mapper) {
        this.colorMapper = Objects.requireNonNull(mapper, "mapper");
        return this;
    }

    /**
     * @param row the row
     * @return the resolved dot colour slug (empty if no mapper or the mapper yields null)
     */
    public String colorFor(T row) {
        if (colorMapper == null) {
            return "";
        }
        String color = colorMapper.apply(rawValue(row));
        return color == null ? "" : color;
    }

    /**
     * Renders a {@link Cell.DotText} carrying the cell text and the
     * {@linkplain #colorFor(Object) resolved colour}. A declared {@link #url(java.util.function.Function)
     * url mapper} still wraps it as a {@link Cell.Link}.
     */
    @Override
    public Cell cellFor(T row) {
        return linkify(row, new Cell.DotText(cell(row), colorFor(row)));
    }
}
