/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;

/**
 * The host registry of a table/page's actions, by {@link ActionPlacement placement} (the Filament
 * {@code HasActions} host contract + {@code BelongsToTable} placement): header actions
 * (resource-scoped), row actions (record-scoped), and bulk actions (over a selection). The host
 * declares its actions here and dispatches one by name; the row context resolves the record, the
 * bulk context resolves the selection.
 *
 * @param <T> the resource row type
 */
public final class ActionRegistry<T> {

    private final Map<String, AdminAction<T>> header = new LinkedHashMap<>();
    private final Map<String, AdminAction<T>> row = new LinkedHashMap<>();
    private final Map<String, BulkAction<T>> bulk = new LinkedHashMap<>();

    /**
     * @param <T> the row type
     * @return a new, empty registry
     */
    public static <T> ActionRegistry<T> create() {
        return new ActionRegistry<>();
    }

    /**
     * Registers header (resource-scoped) actions.
     *
     * @param actions the header actions
     * @return this registry
     */
    @SafeVarargs
    public final ActionRegistry<T> header(AdminAction<T>... actions) {
        for (AdminAction<T> a : actions) {
            header.put(a.name(), Objects.requireNonNull(a, "action"));
        }
        return this;
    }

    /**
     * Registers per-row (record-scoped) actions.
     *
     * @param actions the row actions
     * @return this registry
     */
    @SafeVarargs
    public final ActionRegistry<T> row(AdminAction<T>... actions) {
        for (AdminAction<T> a : actions) {
            row.put(a.name(), Objects.requireNonNull(a, "action"));
        }
        return this;
    }

    /**
     * Registers bulk actions (over the selected records).
     *
     * @param actions the bulk actions
     * @return this registry
     */
    @SafeVarargs
    public final ActionRegistry<T> bulk(BulkAction<T>... actions) {
        for (BulkAction<T> a : actions) {
            bulk.put(a.name(), Objects.requireNonNull(a, "action"));
        }
        return this;
    }

    /** @return the header actions, in declaration order */
    public List<AdminAction<T>> headerActions() {
        return new ArrayList<>(header.values());
    }

    /** @return the row actions, in declaration order */
    public List<AdminAction<T>> rowActions() {
        return new ArrayList<>(row.values());
    }

    /** @return the bulk actions, in declaration order */
    public List<BulkAction<T>> bulkActions() {
        return new ArrayList<>(bulk.values());
    }

    /**
     * Looks up a header action by name.
     *
     * @param name the action name
     * @return the action, or empty if none is registered under that name
     */
    public Optional<AdminAction<T>> headerAction(String name) {
        return Optional.ofNullable(header.get(name));
    }

    /**
     * Looks up a row action by name.
     *
     * @param name the action name
     * @return the action, or empty if none is registered under that name
     */
    public Optional<AdminAction<T>> rowAction(String name) {
        return Optional.ofNullable(row.get(name));
    }

    /**
     * Looks up a bulk action by name.
     *
     * @param name the action name
     * @return the action, or empty if none is registered under that name
     */
    public Optional<BulkAction<T>> bulkAction(String name) {
        return Optional.ofNullable(bulk.get(name));
    }

    /**
     * Looks up an action by placement and name (the general dispatch seam).
     *
     * @param placement where the action is hosted
     * @param name the action name
     * @return the action, or empty if none is registered
     */
    public Optional<? extends AdminAction<T>> find(ActionPlacement placement, String name) {
        return switch (placement) {
            case HEADER -> headerAction(name);
            case ROW -> rowAction(name);
            case BULK -> bulkAction(name).map(b -> b);
        };
    }

    /** @return the registered placements as an unmodifiable name→action map view (header+row) */
    Map<String, AdminAction<T>> allSingleActions() {
        Map<String, AdminAction<T>> all = new LinkedHashMap<>(header);
        all.putAll(row);
        return Collections.unmodifiableMap(all);
    }
}
