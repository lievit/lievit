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
    private final List<ColumnGroup<T>> columnGroups = new ArrayList<>();
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
    private FiltersLayout filtersLayout = FiltersLayout.DROPDOWN;
    private boolean persistFiltersInSession;
    private FilterState defaultFilters = FilterState.EMPTY;
    private final List<SavedView> presets = new ArrayList<>();
    private boolean savedViews;
    private final List<AdminAction<T>> rowActions = new ArrayList<>();

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
     * Registers a {@link ColumnGroup} and appends its member columns to the table in order (the
     * Filament {@code ColumnGroup::make(...)} passed to {@code ->columns([...])}). The group's columns
     * become real table columns (so cells, sort, search, summaries all work as usual); the group
     * additionally drives the spanning super-header row in the list view-model.
     *
     * <p>A column may belong to at most one group; groups render in declaration order, and the columns
     * between/around them stay ungrouped (rendered under an empty spanning cell so the two header rows
     * align). Declare groups and bare {@link #column(Column) columns} in the visual left-to-right order.
     *
     * @param group the column group
     * @return this builder
     */
    public Table<T> columnGroup(ColumnGroup<T> group) {
        Objects.requireNonNull(group, "group");
        columnGroups.add(group);
        for (Column<T> col : group.columns()) {
            columns.add(col);
        }
        return this;
    }

    /**
     * Registers the per-row actions (the Filament {@code Table->actions([...])}): the actions stamped
     * at the end of each row, in declaration order. The kit resolves each {@link AdminAction} against
     * the row's record at view-build time into a generic {@link RowAction} (label / icon / href-or-wire
     * / variant / confirm / disabled / newTab), so the table chrome renders a row's action buttons
     * without the host injecting a typed per-row template seam. An action {@linkplain
     * AdminAction#isVisibleFor(Object) hidden} for a record is dropped from that row's list.
     *
     * @param actions the per-row actions, in render order
     * @return this builder
     */
    @SafeVarargs
    public final Table<T> actions(AdminAction<T>... actions) {
        for (AdminAction<T> action : actions) {
            rowActions.add(Objects.requireNonNull(action, "action"));
        }
        return this;
    }

    /** @return the registered per-row actions, in declaration order */
    public List<AdminAction<T>> rowActions() {
        return Collections.unmodifiableList(rowActions);
    }

    /** @return whether any per-row action is registered (drives the trailing actions cell) */
    public boolean hasRowActions() {
        return !rowActions.isEmpty();
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
     * Sets where the filter controls render (the Filament {@code Table::filtersLayout}); defaults to
     * {@link FiltersLayout#DROPDOWN}.
     *
     * @param layout the filters layout
     * @return this builder
     */
    public Table<T> filtersLayout(FiltersLayout layout) {
        this.filtersLayout = Objects.requireNonNull(layout, "layout");
        return this;
    }

    /**
     * Persists the active filter values across page reloads in the session (the Filament
     * {@code Table::persistFiltersInSession}). The kit carries the flag; the host component reads it
     * to decide whether to restore the saved {@link FilterState} on mount.
     *
     * @return this builder
     */
    public Table<T> persistFiltersInSession() {
        this.persistFiltersInSession = true;
        return this;
    }

    /**
     * Sets the filter values applied when the list first loads (the Filament per-filter
     * {@code ->default(...)}). The host seeds the list request with this {@link FilterState} unless a
     * session-persisted state overrides it.
     *
     * @param filters the default filter state
     * @return this builder
     */
    public Table<T> defaultFilters(FilterState filters) {
        this.defaultFilters = Objects.requireNonNull(filters, "filters");
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
     * Registers a code-owned {@link SavedView preset view} (the Filament advanced-table "preset
     * view"): a named, read-only switcher entry always present for everyone, rendered before the
     * user's saved views. Declaring any preset also turns the switcher on (so the table renders the
     * tab strip even without {@link #savedViews()}).
     *
     * @param preset the preset view (its {@link SavedView#resourceKey()} is the table's resource key)
     * @return this builder
     */
    public Table<T> view(SavedView preset) {
        this.presets.add(Objects.requireNonNull(preset, "preset"));
        return this;
    }

    /**
     * Registers a code-owned preset view ergonomically: a fresh table builder is handed to
     * {@code config} to declare the preset's filters / sort / page size (via {@link #defaultFilters},
     * {@link #defaultSort}, {@link #defaultPaginationPageOption}), and a {@link SavedView#preset
     * preset} is captured from it. The preset's id is its name (so {@code ?view=<name>} switches it);
     * the column set is the table's own (no per-preset column hiding through this short form). The
     * resource key is stamped when the presets are read (the table does not know its resource's key).
     *
     * @param name   the preset's display label (also its switch id)
     * @param config declares the preset's filters / sort / size on a throwaway table builder
     * @return this builder
     */
    public Table<T> view(String name, java.util.function.Consumer<Table<T>> config) {
        Objects.requireNonNull(name, "name");
        Objects.requireNonNull(config, "config");
        Table<T> spec = new Table<>();
        config.accept(spec);
        this.presets.add(
                SavedView.preset(
                        name,
                        "",
                        name,
                        spec.defaultFilters,
                        List.of(),
                        spec.defaultSort,
                        spec.defaultPageSize));
        return this;
    }

    /**
     * Opts this table into user-savable views (the switcher accepts "Save current as a view"). A table
     * may carry presets without this; calling it enables the per-user save/edit/delete affordances.
     *
     * @return this builder
     */
    public Table<T> savedViews() {
        this.savedViews = true;
        return this;
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

    /** @return the registered column groups, in declaration order */
    public List<ColumnGroup<T>> columnGroups() {
        return Collections.unmodifiableList(columnGroups);
    }

    /** @return whether any column group is registered (drives the spanning super-header row) */
    public boolean hasColumnGroups() {
        return !columnGroups.isEmpty();
    }

    /**
     * Computes the spanning super-header row aligned with the flat {@link #columns()} list: one
     * {@link HeaderGroup} per contiguous run of columns, labelled when the run belongs to a registered
     * {@link ColumnGroup} and unlabelled (an empty spanning placeholder) for the columns outside any
     * group. The spans always sum to the column count, so the super-header row and the column-header
     * row line up cell-for-cell.
     *
     * @return the header groups in left-to-right order (empty when no group is registered)
     */
    public List<HeaderGroup> headerGroups() {
        if (columnGroups.isEmpty()) {
            return List.of();
        }
        // Map each grouped column (by identity) to its group label so a scan of the flat column list
        // can fold contiguous same-group runs and emit empty spans for ungrouped columns.
        java.util.Map<Column<T>, ColumnGroup<T>> ownerOf = new java.util.IdentityHashMap<>();
        for (ColumnGroup<T> group : columnGroups) {
            for (Column<T> col : group.columns()) {
                ownerOf.put(col, group);
            }
        }
        List<HeaderGroup> out = new ArrayList<>();
        @Nullable ColumnGroup<T> runOwner = null;
        int runSpan = 0;
        for (Column<T> col : columns) {
            @Nullable ColumnGroup<T> owner = ownerOf.get(col);
            if (owner != runOwner) {
                if (runSpan > 0) {
                    out.add(toHeaderGroup(runOwner, runSpan));
                }
                runOwner = owner;
                runSpan = 0;
            }
            runSpan++;
        }
        if (runSpan > 0) {
            out.add(toHeaderGroup(runOwner, runSpan));
        }
        return List.copyOf(out);
    }

    private HeaderGroup toHeaderGroup(@Nullable ColumnGroup<T> owner, int span) {
        return owner == null
                ? new HeaderGroup("", span, null)
                : new HeaderGroup(owner.label(), span, owner.alignment());
    }

    /**
     * One cell of the spanning super-header row: a label, the number of columns it spans, and an
     * optional alignment. An empty {@link #label()} is the placeholder over ungrouped columns.
     *
     * @param label     the super-header text (empty for ungrouped columns)
     * @param span      the number of columns this header spans (the {@code colspan})
     * @param alignment the alignment token, or {@code null} for the default
     */
    public record HeaderGroup(String label, int span, @Nullable String alignment) {

        /** @return whether this cell carries a real (non-empty) group label */
        public boolean isGroup() {
            return !label.isBlank();
        }
    }

    /** @return the registered filters, in declaration order */
    public List<Filter> filters() {
        return Collections.unmodifiableList(filters);
    }

    /** @return whether any filter is registered (drives whether the filter panel renders) */
    public boolean hasFilters() {
        return !filters.isEmpty();
    }

    /** @return where the filter controls render */
    public FiltersLayout filtersLayout() {
        return filtersLayout;
    }

    /** @return whether the active filters persist across reloads in the session */
    public boolean persistsFiltersInSession() {
        return persistFiltersInSession;
    }

    /** @return the default filter state applied on first load ({@link FilterState#EMPTY} if none) */
    public FilterState defaultFilters() {
        return defaultFilters;
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

    /**
     * The declared preset views, with their {@link SavedView#resourceKey() resource key} stamped to
     * the given value (the ergonomic {@link #view(String, java.util.function.Consumer)} form cannot
     * know it at build time, so it is bound here from the owning resource's slug).
     *
     * @param resourceKey the owning resource's key
     * @return the preset views, resource-key-bound, in declaration order
     */
    public List<SavedView> presets(String resourceKey) {
        Objects.requireNonNull(resourceKey, "resourceKey");
        List<SavedView> bound = new ArrayList<>();
        for (SavedView preset : presets) {
            if (preset.resourceKey().equals(resourceKey)) {
                bound.add(preset);
            } else {
                bound.add(
                        SavedView.preset(
                                preset.id(),
                                resourceKey,
                                preset.name(),
                                preset.filters(),
                                preset.visibleColumns(),
                                preset.sort(),
                                preset.pageSize()));
            }
        }
        return List.copyOf(bound);
    }

    /** @return whether any preset view is declared (the switcher renders even without user views) */
    public boolean hasPresets() {
        return !presets.isEmpty();
    }

    /** @return whether the table opts into user-savable views (the save/edit/delete affordances) */
    public boolean isSavedViewsEnabled() {
        return savedViews;
    }

    /** @return whether the table shows a saved-views switcher at all (any preset, or user views on) */
    public boolean hasSavedViews() {
        return savedViews || hasPresets();
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
