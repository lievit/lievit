/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.function.Function;
import java.util.stream.Collectors;

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
    private @Nullable Function<? super T, String> url;
    private boolean urlNewTab;
    private final List<Summarizer> summarizers = new ArrayList<>();

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
     * Attaches a footer/group summary to this column (the Filament {@code CanBeSummarized}). A
     * column may carry several summarizers (e.g. a {@link Summarizer#sum()} and a
     * {@link Summarizer#count()}); they render in declaration order under the column.
     *
     * @param summarizer the aggregate, must not be null
     * @return this column
     */
    public Column<T> summarize(Summarizer summarizer) {
        summarizers.add(Objects.requireNonNull(summarizer, "summarizer"));
        return this;
    }

    /**
     * Makes every cell of this column a link to the URL derived from the row (the Filament
     * {@code ->url(...)}). The list view-model turns a column with a URL mapper into a
     * {@link Cell.Link} so the template renders a real {@code <a href>} instead of escaped text.
     * Lives on the base column so any column type (text, badge, icon) can be linked.
     *
     * @param fn maps a row to its URL (a null/blank result leaves the cell un-linked)
     * @return this column
     */
    public Column<T> url(Function<? super T, String> fn) {
        return url(fn, false);
    }

    /**
     * Makes every cell of this column a link, opening in a new tab when {@code newTab} is true (the
     * Filament {@code ->url($url, shouldOpenInNewTab: true)}). A new-tab link renders with
     * {@code target="_blank"} + {@code rel="noopener noreferrer"}.
     *
     * @param fn maps a row to its URL (a null/blank result leaves the cell un-linked)
     * @param newTab whether the link opens in a new browser tab
     * @return this column
     */
    public Column<T> url(Function<? super T, String> fn, boolean newTab) {
        this.url = Objects.requireNonNull(fn, "fn");
        this.urlNewTab = newTab;
        return this;
    }

    /** @return whether this column links its cells (a URL mapper was declared) */
    public boolean hasUrl() {
        return url != null;
    }

    /** @return whether this column's links open in a new tab */
    public boolean opensUrlInNewTab() {
        return urlNewTab;
    }

    /**
     * The cell's link URL for a row, if this column is linked and the mapper yields a non-blank URL.
     *
     * @param row the row
     * @return the link URL, or empty if this column is not linked (or the mapper yields null/blank)
     */
    public java.util.Optional<String> urlFor(T row) {
        if (url == null) {
            return java.util.Optional.empty();
        }
        @Nullable String href = url.apply(row);
        return href == null || href.isBlank()
                ? java.util.Optional.empty()
                : java.util.Optional.of(href);
    }

    /** @return the attached summarizers, in declaration order, as an unmodifiable snapshot */
    public List<Summarizer> summarizers() {
        return Collections.unmodifiableList(summarizers);
    }

    /** @return whether this column carries any summary */
    public boolean isSummarized() {
        return !summarizers.isEmpty();
    }

    /**
     * Computes this column's summaries over a set of in-scope rows (the active page or all matching
     * rows). Each summarizer folds the column's {@linkplain #rawValue(Object) raw cell values}.
     *
     * @param rows the in-scope rows
     * @return the rendered {@code label -> value} summaries, in summarizer-declaration order
     */
    public List<ColumnSummary> summaries(List<? extends T> rows) {
        List<@Nullable Object> values =
                rows.stream().map(this::rawValue).collect(Collectors.toCollection(ArrayList::new));
        return summarizers.stream()
                .map(s -> new ColumnSummary(s.label(), s.summarize(values)))
                .collect(Collectors.toUnmodifiableList());
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

    /**
     * Renders the cell for a row as a <strong>typed</strong> {@link Cell}, the unit the list
     * view-model carries (so the template can stamp a badge / link / icon, not only escaped text).
     *
     * <p>The base column produces a {@link Cell.Text}, upgraded to a {@link Cell.Link} when a
     * {@link #url(Function) url mapper} is declared and yields a URL for this row (the Filament
     * {@code ->url(...)}). Typed columns override this to produce their own cell ({@link BadgeColumn}
     * a {@link Cell.Badge}, {@link IconColumn} a {@link Cell.Icon}) and call {@link #linkify} to keep
     * the same URL behaviour.
     *
     * @param row the row
     * @return the typed cell
     */
    public Cell cellFor(T row) {
        return linkify(row, Cell.text(cell(row)));
    }

    /**
     * Wraps a base cell as a {@link Cell.Link} when this column carries a URL mapper that yields a
     * URL for the row; otherwise returns the base cell unchanged. Typed columns call this so a badge
     * or icon column can also be a link (the Filament column composition).
     *
     * @param row the row
     * @param base the cell to upgrade to a link when this column is linked
     * @return a {@link Cell.Link} when linked, otherwise {@code base}
     */
    protected final Cell linkify(T row, Cell base) {
        return urlFor(row)
                .<Cell>map(href -> new Cell.Link(base.text(), href, urlNewTab))
                .orElse(base);
    }

    private static String slug(String label) {
        return label.trim().toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "_").replaceAll("^_|_$", "");
    }
}
