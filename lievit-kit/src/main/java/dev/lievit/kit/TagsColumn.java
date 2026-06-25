/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit;

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

    private @Nullable Integer limit;

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
     * Caps the number of tags rendered (the Filament {@code TagsColumn::limit()}): the column shows
     * the first {@code n} tags and a {@code "+K"} overflow badge for the rest, instead of all tags.
     * Without it, every tag renders.
     *
     * @param n the maximum number of tags to render before the overflow badge (at least 1)
     * @return this column
     */
    public TagsColumn<T> limit(int n) {
        if (n < 1) {
            throw new IllegalArgumentException("limit must be >= 1, got: " + n);
        }
        this.limit = n;
        return this;
    }

    /** @return the configured render limit, or {@code null} if every tag renders */
    public @Nullable Integer limit() {
        return limit;
    }

    /**
     * The tags actually rendered for a row, honouring {@link #limit(int)}: the first {@code limit}
     * tags (or all of them when no limit is set, or the row has fewer than the limit).
     *
     * @param row the row
     * @return the visible tags (never null)
     */
    public List<String> visibleTagsFor(T row) {
        List<String> all = tagsFor(row);
        if (limit == null || all.size() <= limit) {
            return all;
        }
        return List.copyOf(all.subList(0, limit));
    }

    /**
     * The overflow count for a row (the {@code K} in the {@code "+K"} badge): how many tags the limit
     * hides. Zero when no limit is set or the row fits within the limit.
     *
     * @param row the row
     * @return the number of tags beyond the limit (never negative)
     */
    public int overflowCountFor(T row) {
        if (limit == null) {
            return 0;
        }
        return Math.max(0, tagsFor(row).size() - limit);
    }

    /**
     * @param row the row
     * @return whether the row's tags overflow the limit (so the {@code "+K"} badge renders)
     */
    public boolean hasOverflowFor(T row) {
        return overflowCountFor(row) > 0;
    }

    /**
     * Renders a {@link Cell.Tags} carrying the {@linkplain #visibleTagsFor(Object) visible tags} and
     * the {@linkplain #overflowCountFor(Object) overflow count} (the {@code "+K"} badge), with the
     * flat comma-joined projection of all tags as the no-CSS fallback. A declared
     * {@link #url(java.util.function.Function) url mapper} still wraps it as a {@link Cell.Link}.
     */
    @Override
    public Cell cellFor(T row) {
        return linkify(
                row,
                new Cell.Tags(
                        visibleTagsFor(row),
                        overflowCountFor(row),
                        String.join(", ", tagsFor(row))));
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
