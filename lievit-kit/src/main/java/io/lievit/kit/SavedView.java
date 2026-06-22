/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit;

import java.util.List;
import java.util.Objects;

/**
 * A named, switchable table preset (a Salesforce "list view" / Filament advanced-table "user view"):
 * the full bundle of {@link FilterState filters} + ordered visible columns + {@link Sort sort} + page
 * size that an adopter applies to a {@link Table}. The superset of a filters-only "saved search": a
 * saved view also captures which columns show, in what order, sorted how, at what page size.
 *
 * <p>Two flavours, distinguished by {@link Origin}: a {@link Origin#PRESET} view is developer-declared
 * on the {@code Table} builder (code-owned, read-only, present for everyone, never persisted); a
 * {@link Origin#USER} view is end-user-saved through a {@link SavedViewStore} (editable, deletable,
 * per-owner). Both render through the same switcher.
 *
 * <p>The type is engine-agnostic: it carries {@link FilterState}/{@link Sort}/{@code visibleColumns}
 * but never executes them. The kit applies a view by turning it into a {@link ListRequest} (see
 * {@link SavedViews#apply}); the adopter's repository runs the resulting query. {@code visibleColumns}
 * holds column {@link Column#sortKey() sort keys} in render order (an empty list means "the table's
 * own declaration order", i.e. no column reorder/hide).
 *
 * <p>Immutable. The compact constructor enforces a non-blank, trimmed {@code name} (carried over from
 * the legacy saved-search invariant), never-nulls the collections, and pins the preset rules: a
 * {@link Origin#PRESET} view has an empty {@code owner} (it belongs to everyone) and is never the
 * stored per-user default.
 *
 * @param id             stable handle: a UUID string for a user view, the declared key for a preset
 * @param resourceKey    which resource/table this view belongs to (scopes the {@link SavedViewStore})
 * @param owner          the owning username; {@code ""} for a preset (everyone)
 * @param name           the display label, non-blank, trimmed
 * @param scope          {@link Scope#PERSONAL} (private to the owner) or {@link Scope#SHARED} (visible
 *                       to others); v1 user views are always {@code PERSONAL}, the field is present so
 *                       the schema does not change when shared views land
 * @param origin         {@link Origin#PRESET} (code-owned, read-only) or {@link Origin#USER} (saved,
 *                       editable/deletable)
 * @param filters        the active filters this view applies (the existing kit {@link FilterState})
 * @param visibleColumns the column sort keys in render order; empty = the table's declaration order
 * @param sort           the sort order this view applies (single-column today, list-ready)
 * @param pageSize       the page size this view applies; {@code 0} = the table default
 * @param isDefault      whether this is the owner's default view for this resource (the view that
 *                       loads with no explicit selection); never {@code true} for a preset
 */
public record SavedView(
        String id,
        String resourceKey,
        String owner,
        String name,
        Scope scope,
        Origin origin,
        FilterState filters,
        List<String> visibleColumns,
        Sort sort,
        int pageSize,
        boolean isDefault) {

    /** Who a saved view is visible to. */
    public enum Scope {
        /** Private to its {@link SavedView#owner()} (the v1 default for every user view). */
        PERSONAL,
        /** Visible to others (deferred: needs a team/role model; reserved so the schema is stable). */
        SHARED
    }

    /** Where a saved view comes from (drives whether it is editable/deletable). */
    public enum Origin {
        /** Developer-declared on the {@link Table} builder: code-owned, read-only, never persisted. */
        PRESET,
        /** End-user-saved through a {@link SavedViewStore}: editable, deletable, per-owner. */
        USER
    }

    /** Compact constructor: enforces the name + preset invariants and defends the collections. */
    public SavedView {
        Objects.requireNonNull(id, "id");
        Objects.requireNonNull(resourceKey, "resourceKey");
        Objects.requireNonNull(scope, "scope");
        Objects.requireNonNull(origin, "origin");
        owner = owner == null ? "" : owner;
        if (name == null || name.isBlank()) {
            throw new IllegalArgumentException("a saved view name must not be blank");
        }
        name = name.trim();
        filters = filters == null ? FilterState.EMPTY : filters;
        sort = sort == null ? Sort.NONE : sort;
        visibleColumns = visibleColumns == null ? List.of() : List.copyOf(visibleColumns);
        if (pageSize < 0) {
            pageSize = 0;
        }
        if (origin == Origin.PRESET) {
            // A preset belongs to everyone and is never a stored per-user default: pin both so a bad
            // caller cannot mint an "owned" or "default" preset that the store would then refuse.
            owner = "";
            isDefault = false;
        }
    }

    /**
     * Declares a code-owned preset view: an {@link Origin#PRESET} with the given key/name and the
     * filters/columns/sort/size bundle. Belongs to everyone (no owner), never editable/deletable.
     *
     * @param key            the stable preset key (its {@link #id()})
     * @param resourceKey    the resource/table this preset belongs to
     * @param name           the display label
     * @param filters        the filters this preset applies
     * @param visibleColumns the visible column sort keys in render order (empty = table order)
     * @param sort           the sort this preset applies
     * @param pageSize       the page size ({@code 0} = table default)
     * @return the preset view
     */
    public static SavedView preset(
            String key,
            String resourceKey,
            String name,
            FilterState filters,
            List<String> visibleColumns,
            Sort sort,
            int pageSize) {
        return new SavedView(
                key, resourceKey, "", name, Scope.PERSONAL, Origin.PRESET, filters, visibleColumns,
                sort, pageSize, false);
    }

    /**
     * A user view owned by {@code owner}: an editable/deletable {@link Origin#PRESET} counterpart with
     * the full bundle, {@link Scope#PERSONAL} by default.
     *
     * @param id             the stable handle (a UUID string)
     * @param resourceKey    the resource/table this view belongs to
     * @param owner          the owning username
     * @param name           the display label
     * @param filters        the filters this view applies
     * @param visibleColumns the visible column sort keys in render order (empty = table order)
     * @param sort           the sort this view applies
     * @param pageSize       the page size ({@code 0} = table default)
     * @param isDefault      whether this is the owner's default view
     * @return the user view
     */
    public static SavedView user(
            String id,
            String resourceKey,
            String owner,
            String name,
            FilterState filters,
            List<String> visibleColumns,
            Sort sort,
            int pageSize,
            boolean isDefault) {
        return new SavedView(
                id, resourceKey, owner, name, Scope.PERSONAL, Origin.USER, filters, visibleColumns,
                sort, pageSize, isDefault);
    }

    /** @return whether this view is end-user owned (editable + deletable), not a code-owned preset */
    public boolean isUser() {
        return origin == Origin.USER;
    }

    /** @return whether this view is a developer-declared, read-only preset */
    public boolean isPreset() {
        return origin == Origin.PRESET;
    }

    /** @return whether this view captures an explicit column set/order (else it uses the table order) */
    public boolean hasVisibleColumns() {
        return !visibleColumns.isEmpty();
    }

    /**
     * @param newDefault the default flag
     * @return a copy with the default flag set (a preset stays non-default, by the compact ctor)
     */
    public SavedView withDefault(boolean newDefault) {
        return new SavedView(
                id, resourceKey, owner, name, scope, origin, filters, visibleColumns, sort, pageSize,
                newDefault);
    }
}
