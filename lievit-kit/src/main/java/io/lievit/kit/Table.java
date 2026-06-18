/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Objects;
import java.util.function.Function;

import org.jspecify.annotations.Nullable;

/**
 * The table-view builder of an {@link Resource}: an ordered list of {@link Column columns}
 * plus a row-id function, built with a fluent DSL (the filament-internals.md Table builder, on the
 * shared {@link Schema} parent).
 *
 * <p>The id function is how a list row maps to its edit/view route; it defaults to the row's own
 * {@code toString} so the simplest case (a String row) needs no configuration.
 *
 * @param <T> the row type
 */
public final class Table<T> extends Schema<T, Table<T>> {

    private final List<Column<T>> columns = new ArrayList<>();
    private final List<Filter> filters = new ArrayList<>();
    private @Nullable Function<? super T, String> idFunction;
    private Sort defaultSort = Sort.NONE;
    private int defaultPageSize = RecordRepository.Query.DEFAULT_LIMIT;
    private List<Integer> pageSizeOptions = List.of(10, 25, 50, 100);
    private boolean striped;
    private String emptyStateHeading = "No records";
    private @Nullable String emptyStateDescription;
    private final List<Group<T>> groups = new ArrayList<>();
    private @Nullable String defaultGroup;
    private @Nullable String reorderColumn;

    private Table() {}

    /**
     * @param <T> the row type
     * @return a new, empty table builder
     */
    public static <T> Table<T> create() {
        return new Table<>();
    }

    /**
     * Adds a column.
     *
     * @param label the column header
     * @param value extracts the cell value from a row
     * @return this builder
     */
    public Table<T> column(String label, Function<? super T, ?> value) {
        columns.add(new Column<>(label, value));
        return this;
    }

    /**
     * Adds a pre-built typed column (e.g. {@link TextColumn}, {@link BadgeColumn}).
     *
     * <p>Use this overload when the column carries type-specific configuration (sortable,
     * colour mapping, icon names, date format) that the bare {@code column(label, extractor)}
     * convenience cannot express.
     *
     * @param col the pre-built column, must not be null
     * @return this builder
     */
    public Table<T> column(Column<T> col) {
        columns.add(Objects.requireNonNull(col, "col"));
        return this;
    }

    /**
     * Declares how a row maps to its string id (used in the row's edit/view route).
     *
     * @param idFunction extracts the id from a row
     * @return this builder
     */
    public Table<T> id(Function<? super T, String> idFunction) {
        this.idFunction = Objects.requireNonNull(idFunction, "idFunction");
        return this;
    }

    /**
     * Registers the table's filters (the Filament {@code Table::filters}).
     *
     * @param fs the filters
     * @return this builder
     */
    public Table<T> filters(Filter... fs) {
        for (Filter f : fs) {
            filters.add(Objects.requireNonNull(f, "filter"));
        }
        return this;
    }

    /**
     * Sets the initial sort order (the Filament {@code Table::defaultSort}).
     *
     * @param column the column sort key
     * @param direction the direction
     * @return this builder
     */
    public Table<T> defaultSort(String column, SortDirection direction) {
        this.defaultSort = Sort.by(column, direction);
        return this;
    }

    /**
     * Sets the initial sort order ascending.
     *
     * @param column the column sort key
     * @return this builder
     */
    public Table<T> defaultSort(String column) {
        return defaultSort(column, SortDirection.ASC);
    }

    /**
     * Sets the initial page size (the Filament {@code Table::defaultPaginationPageOption}).
     *
     * @param size the default page size
     * @return this builder
     */
    public Table<T> defaultPaginationPageOption(int size) {
        this.defaultPageSize = size < 1 ? 1 : size;
        return this;
    }

    /**
     * Sets the records-per-page options offered in the page-size selector.
     *
     * @param options the page sizes (a non-positive entry is read as "all")
     * @return this builder
     */
    public Table<T> paginationPageOptions(Integer... options) {
        this.pageSizeOptions = List.of(options);
        return this;
    }

    /**
     * Alternates row backgrounds (the Filament {@code Table::striped}).
     *
     * @return this builder
     */
    public Table<T> striped() {
        this.striped = true;
        return this;
    }

    /**
     * Sets the empty-state heading and description shown when no row matches.
     *
     * @param heading the empty-state heading
     * @param description the empty-state description (may be null)
     * @return this builder
     */
    public Table<T> emptyState(String heading, @Nullable String description) {
        this.emptyStateHeading = Objects.requireNonNull(heading, "heading");
        this.emptyStateDescription = description;
        return this;
    }

    /**
     * Registers the groupings the user can pick from (the Filament {@code Table::groups}). The first
     * group becomes the {@link #defaultGroup() default} unless one is set explicitly.
     *
     * @param gs the groups
     * @return this builder
     */
    @SafeVarargs
    public final Table<T> groups(Group<T>... gs) {
        for (Group<T> g : gs) {
            groups.add(Objects.requireNonNull(g, "group"));
        }
        if (defaultGroup == null && !groups.isEmpty()) {
            defaultGroup = groups.get(0).id();
        }
        return this;
    }

    /**
     * Sets the grouping applied initially (the Filament {@code Table::defaultGroup}). Must match a
     * registered group id.
     *
     * @param groupId the default group id
     * @return this builder
     */
    public Table<T> defaultGroup(String groupId) {
        this.defaultGroup = Objects.requireNonNull(groupId, "groupId");
        return this;
    }

    /**
     * Enables drag-to-reorder, persisting the new order to the given column (the Filament
     * {@code Table::reorderable}). While reorder mode is active the conflicting sort is disabled;
     * the page reads {@link #reorderColumn()} to know which column to write the new positions to.
     *
     * @param orderColumn the order column the new positions persist to
     * @return this builder
     */
    public Table<T> reorderable(String orderColumn) {
        this.reorderColumn = Objects.requireNonNull(orderColumn, "orderColumn");
        return this;
    }

    /** @return the registered groups, in declaration order */
    public List<Group<T>> groups() {
        return Collections.unmodifiableList(groups);
    }

    /** @return the default group id, or {@code null} if grouping is off */
    public @Nullable String defaultGroup() {
        return defaultGroup;
    }

    /**
     * Looks up a registered group by id.
     *
     * @param groupId the group id
     * @return the group, or {@code null} if none matches
     */
    public @Nullable Group<T> group(String groupId) {
        return groups.stream().filter(g -> g.id().equals(groupId)).findFirst().orElse(null);
    }

    /** @return whether any grouping is registered */
    public boolean isGroupable() {
        return !groups.isEmpty();
    }

    /** @return whether drag-to-reorder is enabled */
    public boolean isReorderable() {
        return reorderColumn != null;
    }

    /** @return the order column the reorder persists to, or {@code null} if reorder is off */
    public @Nullable String reorderColumn() {
        return reorderColumn;
    }

    /**
     * @return the columns, in declaration order, as an unmodifiable snapshot
     */
    public List<Column<T>> columns() {
        return Collections.unmodifiableList(columns);
    }

    /** @return the registered filters, in declaration order */
    public List<Filter> filters() {
        return Collections.unmodifiableList(filters);
    }

    /** @return the initial sort order ({@link Sort#NONE} if none declared) */
    public Sort defaultSort() {
        return defaultSort;
    }

    /** @return the default page size */
    public int defaultPageSize() {
        return defaultPageSize;
    }

    /** @return the records-per-page options, in order */
    public List<Integer> pageSizeOptions() {
        return pageSizeOptions;
    }

    /** @return whether rows are striped */
    public boolean isStriped() {
        return striped;
    }

    /** @return the empty-state heading */
    public String emptyStateHeading() {
        return emptyStateHeading;
    }

    /** @return the empty-state description, or {@code null} */
    public @Nullable String emptyStateDescription() {
        return emptyStateDescription;
    }

    /**
     * @return whether any column folds into the global search
     */
    public boolean hasSearchableColumns() {
        return columns.stream().anyMatch(Column::isSearchable);
    }

    /**
     * Derives a row's id.
     *
     * @param row the row
     * @return the declared id, or the row's {@code toString} if no id function was declared
     */
    public String idOf(T row) {
        if (idFunction != null) {
            return idFunction.apply(row);
        }
        return String.valueOf(row);
    }
}
