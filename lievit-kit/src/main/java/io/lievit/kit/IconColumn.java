/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit;

import java.util.Objects;
import java.util.function.Function;

import org.jspecify.annotations.Nullable;

/**
 * A column that renders the cell as an icon (the Filament {@code IconColumn}): the raw value maps to
 * an icon name and, optionally, a colour. The classic use is a boolean rendered as a check / cross,
 * or an enum rendered as a status glyph.
 *
 * @param <T> the row type
 */
public final class IconColumn<T> extends Column<T> {

    private @Nullable Function<Object, String> iconMapper;
    private @Nullable Function<Object, String> colorMapper;

    /**
     * @param label the column header
     * @param extractor extracts the raw value from a row
     * @param <T> the row type
     * @return a new icon column
     */
    public static <T> IconColumn<T> make(String label, Function<? super T, ?> extractor) {
        return new IconColumn<>(label, extractor);
    }

    private IconColumn(String label, Function<? super T, ?> extractor) {
        super(label, extractor);
    }

    /**
     * Maps the raw cell value to an icon name.
     *
     * @param mapper the value→icon-name function
     * @return this column
     */
    public IconColumn<T> icon(Function<Object, String> mapper) {
        this.iconMapper = Objects.requireNonNull(mapper, "mapper");
        return this;
    }

    /**
     * Maps the raw cell value to a semantic colour name (e.g. {@code "success"}, {@code "danger"}).
     *
     * @param mapper the value→colour function
     * @return this column
     */
    public IconColumn<T> color(Function<Object, String> mapper) {
        this.colorMapper = Objects.requireNonNull(mapper, "mapper");
        return this;
    }

    /**
     * Boolean convenience: render {@code trueIcon} when truthy, {@code falseIcon} otherwise.
     *
     * @param trueIcon the icon name for a true value
     * @param falseIcon the icon name for a false value
     * @return this column
     */
    public IconColumn<T> bool(String trueIcon, String falseIcon) {
        this.iconMapper = v -> Boolean.TRUE.equals(v) ? trueIcon : falseIcon;
        return this;
    }

    /**
     * @param row the row
     * @return the resolved icon name (empty if no mapper or the mapper yields null)
     */
    public String iconFor(T row) {
        if (iconMapper == null) {
            return "";
        }
        String icon = iconMapper.apply(rawValue(row));
        return icon == null ? "" : icon;
    }

    /**
     * @param row the row
     * @return the resolved colour name (empty if no mapper or the mapper yields null)
     */
    public String colorFor(T row) {
        if (colorMapper == null) {
            return "";
        }
        String color = colorMapper.apply(rawValue(row));
        return color == null ? "" : color;
    }
}
