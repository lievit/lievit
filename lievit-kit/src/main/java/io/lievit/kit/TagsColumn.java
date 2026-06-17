/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collection;
import java.util.List;
import java.util.Objects;
import java.util.function.Function;

import org.jspecify.annotations.Nullable;

/**
 * A column that renders the cell as a list of tag chips (the Filament {@code TagsColumn}): the raw
 * value is a collection (or a separator-joined string) split into individual tags.
 *
 * @param <T> the row type
 */
public final class TagsColumn<T> extends Column<T> {

    private @Nullable String separator;

    /**
     * @param label the column header
     * @param extractor extracts the tags (a {@link Collection} or a separator-joined string)
     * @param <T> the row type
     * @return a new tags column
     */
    public static <T> TagsColumn<T> make(String label, Function<? super T, ?> extractor) {
        return new TagsColumn<>(label, extractor);
    }

    private TagsColumn(String label, Function<? super T, ?> extractor) {
        super(label, extractor);
    }

    /**
     * Treats a string cell value as a list of tags joined by the given separator.
     *
     * @param sep the separator
     * @return this column
     */
    public TagsColumn<T> separator(String sep) {
        this.separator = Objects.requireNonNull(sep, "sep");
        return this;
    }

    /**
     * Splits the raw value into the individual tags for rendering.
     *
     * @param row the row
     * @return the tags (never null; empty when the value is null/blank)
     */
    public List<String> tagsFor(T row) {
        Object raw = rawValue(row);
        if (raw == null) {
            return List.of();
        }
        if (raw instanceof Collection<?> c) {
            List<String> out = new ArrayList<>();
            for (Object o : c) {
                if (o != null) {
                    out.add(String.valueOf(o));
                }
            }
            return out;
        }
        String s = String.valueOf(raw);
        if (s.isBlank()) {
            return List.of();
        }
        if (separator != null) {
            return Arrays.stream(s.split(java.util.regex.Pattern.quote(separator)))
                    .map(String::trim)
                    .filter(t -> !t.isEmpty())
                    .toList();
        }
        return List.of(s);
    }
}
