/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit;

import java.util.Locale;
import java.util.Objects;
import java.util.function.Function;

import org.jspecify.annotations.Nullable;

/**
 * One column of an {@link Table}: a label plus a value extractor over the row type (the
 * filament-internals.md {@code TextColumn} carried over, minus the macro surface).
 *
 * <p>Beyond the value extractor a column carries the presentation/behaviour flags the table feature
 * builders read: whether it is {@link #sortable()} (clickable header wires to the
 * {@link RecordRepository.Query#sort() query sort}), {@link #searchable()} (folds into the global
 * search), and {@link #toggleable()} (user can hide it from the column manager), plus a responsive
 * {@link #hiddenFrom()} breakpoint. The {@link #sortKey()} is the stable name the
 * {@link RecordRepository} sorts/searches by, so a label rename does not change the SQL column.
 *
 * @param <T> the row type
 */
public class Column<T> {

    private final String label;
    private final Function<? super T, ?> value;
    private boolean sortable;
    private boolean searchable;
    private boolean toggleable;
    private boolean toggledHiddenByDefault;
    private @Nullable String sortKey;
    private @Nullable String hiddenFrom;

    /**
     * @param label the column header
     * @param value extracts the cell value from a row
     */
    Column(String label, Function<? super T, ?> value) {
        this(label, value, false);
    }

    /**
     * @param label    the column header
     * @param value    extracts the cell value from a row
     * @param sortable whether this column can be sorted in the table view
     */
    Column(String label, Function<? super T, ?> value, boolean sortable) {
        this.label = Objects.requireNonNull(label, "label");
        this.value = Objects.requireNonNull(value, "value");
        this.sortable = sortable;
    }

    /**
     * @return the column header
     */
    public String label() {
        return label;
    }

    /**
     * The stable sort/search key of this column: the explicit key if one was declared, otherwise a
     * snake_case slug of the label. The {@link RecordRepository} sorts/searches by this name, so it
     * survives a label rename.
     *
     * @return the sort key
     */
    public String sortKey() {
        return sortKey != null ? sortKey : slug(label);
    }

    /**
     * Declares an explicit sort/search key (e.g. the SQL column name) decoupled from the label.
     *
     * @param key the stable key
     */
    void setSortKey(String key) {
        this.sortKey = Objects.requireNonNull(key, "key");
    }

    /**
     * @return {@code true} if this column can be sorted in the table view
     */
    public boolean sortable() {
        return sortable;
    }

    /**
     * Sets the sortable flag. Package-private: called by typed-column fluent methods.
     *
     * @param sortable whether this column can be sorted
     */
    void setSortable(boolean sortable) {
        this.sortable = sortable;
    }

    /**
     * @return {@code true} if this column folds into the table's global search
     */
    public boolean isSearchable() {
        return searchable;
    }

    /**
     * Sets the searchable flag. Package-private: called by typed-column fluent methods.
     *
     * @param searchable whether this column is searched by the global search box
     */
    void setSearchable(boolean searchable) {
        this.searchable = searchable;
    }

    /**
     * @return {@code true} if the user can show/hide this column from the column manager
     */
    public boolean isToggleable() {
        return toggleable;
    }

    /**
     * @return {@code true} if a toggleable column starts hidden (the user opts it back in)
     */
    public boolean toggledHiddenByDefault() {
        return toggledHiddenByDefault;
    }

    /**
     * Sets the toggleable flags. Package-private: called by typed-column fluent methods.
     *
     * @param toggleable whether the user can hide this column
     * @param hiddenByDefault whether it starts hidden
     */
    void setToggleable(boolean toggleable, boolean hiddenByDefault) {
        this.toggleable = toggleable;
        this.toggledHiddenByDefault = hiddenByDefault;
    }

    /**
     * @return the breakpoint at which this column is hidden going smaller (e.g. {@code "md"}), or
     *     {@code null} if it is always visible
     */
    public @Nullable String hiddenFrom() {
        return hiddenFrom;
    }

    /**
     * Sets the responsive-hide breakpoint. Package-private: called by typed-column fluent methods.
     *
     * @param breakpoint the breakpoint name (e.g. {@code "md"}), or {@code null} to clear
     */
    void setHiddenFrom(@Nullable String breakpoint) {
        this.hiddenFrom = breakpoint;
    }

    /**
     * The raw, unstringified cell value for a row (the value the extractor returns). Summaries and
     * type-specific columns read this; {@link #cell(Object)} is its string projection.
     *
     * @param row the row
     * @return the extracted value, possibly {@code null}
     */
    public @Nullable Object rawValue(T row) {
        return value.apply(row);
    }

    /**
     * Renders the cell value for a row as text.
     *
     * @param row the row
     * @return the extracted value as a string, or the empty string if the extractor yields null
     */
    public String cell(T row) {
        @Nullable Object extracted = value.apply(row);
        return extracted == null ? "" : String.valueOf(extracted);
    }

    private static String slug(String label) {
        return label.trim().toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "_").replaceAll("^_|_$", "");
    }
}
