/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;

import org.jspecify.annotations.Nullable;

/**
 * A grouping of table rows by a key (the Filament {@code Grouping/Group} + {@code CanGroupRecords}):
 * rows that share the same key fold into one collapsible section with a header, a record count, and
 * optional per-group summaries.
 *
 * <p>The {@link #id() id} is the stable handle the runtime group-selector wires; the
 * {@link #keyOf(Object) key} extractor partitions the rows. Grouping is a pure, in-scope partition
 * of whatever row set the page hands it, so it composes with sort/filter/pagination unchanged: sort
 * orders the rows, the partition preserves that order within each group.
 *
 * @param <T> the row type
 */
public final class Group<T> {

    private final String id;
    private final Function<? super T, ?> key;
    private @Nullable String label;
    private boolean collapsible = true;

    private Group(String id, Function<? super T, ?> key) {
        this.id = Objects.requireNonNull(id, "id");
        this.key = Objects.requireNonNull(key, "key");
    }

    /**
     * Groups by a string property name, reading it reflectively-free: the adopter passes the
     * extractor so the kit never reflects.
     *
     * @param id the stable group id (also the default label)
     * @param key extracts the group key from a row
     * @param <T> the row type
     * @return a group
     */
    public static <T> Group<T> make(String id, Function<? super T, ?> key) {
        return new Group<>(id, key);
    }

    /**
     * Overrides the header label (defaults to the id).
     *
     * @param text the label
     * @return this group
     */
    public Group<T> label(String text) {
        this.label = Objects.requireNonNull(text, "text");
        return this;
    }

    /**
     * Sets whether the group sections can be collapsed (defaults to {@code true}).
     *
     * @param value whether collapsible
     * @return this group
     */
    public Group<T> collapsible(boolean value) {
        this.collapsible = value;
        return this;
    }

    /** @return the stable group id */
    public String id() {
        return id;
    }

    /** @return the header label (the id when not overridden) */
    public String label() {
        return label != null ? label : id;
    }

    /** @return whether the group sections can be collapsed */
    public boolean isCollapsible() {
        return collapsible;
    }

    /**
     * @param row the row
     * @return the group key for the row, rendered as a string ({@code "—"} for a null key)
     */
    public String keyOf(T row) {
        Object k = key.apply(row);
        return k == null ? "—" : String.valueOf(k);
    }

    /**
     * Partitions a set of in-scope rows into ordered sections, preserving the incoming row order
     * both across sections (first-seen key first) and within each section.
     *
     * @param rows the in-scope rows (already sorted/filtered by the page)
     * @return the sections, in first-seen-key order
     */
    public List<Section<T>> partition(List<? extends T> rows) {
        Map<String, List<T>> buckets = new LinkedHashMap<>();
        for (T row : rows) {
            buckets.computeIfAbsent(keyOf(row), k -> new ArrayList<>()).add(row);
        }
        List<Section<T>> sections = new ArrayList<>(buckets.size());
        buckets.forEach((k, rs) -> sections.add(new Section<>(k, List.copyOf(rs))));
        return List.copyOf(sections);
    }

    /**
     * One group section: the key shared by its rows, the rows, and a derived count.
     *
     * @param key the group key (the header title)
     * @param rows the rows in this section
     * @param <T> the row type
     */
    public record Section<T>(String key, List<T> rows) {

        /** Compact constructor: defends the row list. */
        public Section {
            rows = List.copyOf(rows);
        }

        /** @return the record count shown in the group header */
        public int count() {
            return rows.size();
        }
    }
}
