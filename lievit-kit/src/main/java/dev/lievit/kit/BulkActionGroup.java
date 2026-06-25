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
import java.util.Optional;

import org.jspecify.annotations.Nullable;

/**
 * A dropdown grouping of bulk actions under one trigger in the selection bar (the Filament
 * {@code BulkActionGroup}): the selection-bar counterpart of {@link ActionGroup}. The group exposes a
 * flat name→action dispatch map and the declaration order; the {@link #flatten} helper merges
 * top-level bulk actions with the children of every group so the host can dispatch one bulk action by
 * name regardless of nesting.
 *
 * @param <T> the resource row type
 */
public final class BulkActionGroup<T> {

    private final Map<String, BulkAction<T>> actions = new LinkedHashMap<>();
    private @Nullable String label;
    private @Nullable String icon = "heroicon-m-ellipsis-vertical";

    @SafeVarargs
    private BulkActionGroup(BulkAction<T>... children) {
        for (BulkAction<T> a : children) {
            actions.put(a.name(), Objects.requireNonNull(a, "action"));
        }
    }

    /**
     * @param children the grouped bulk actions
     * @param <T> the row type
     * @return a new bulk action group
     */
    @SafeVarargs
    public static <T> BulkActionGroup<T> make(BulkAction<T>... children) {
        return new BulkActionGroup<>(children);
    }

    /**
     * Sets a label on the trigger (e.g. "More").
     *
     * @param text the trigger label
     * @return this group
     */
    public BulkActionGroup<T> label(String text) {
        this.label = Objects.requireNonNull(text, "text");
        return this;
    }

    /**
     * Sets the trigger icon.
     *
     * @param iconName the icon name
     * @return this group
     */
    public BulkActionGroup<T> icon(@Nullable String iconName) {
        this.icon = iconName;
        return this;
    }

    /** @return the grouped bulk actions, in declaration order */
    public List<BulkAction<T>> actions() {
        return new ArrayList<>(actions.values());
    }

    /**
     * Looks up a child bulk action by name (the flat dispatch map).
     *
     * @param name the action name
     * @return the action, or empty if none
     */
    public Optional<BulkAction<T>> action(String name) {
        return Optional.ofNullable(actions.get(name));
    }

    /** @return the trigger label, or {@code null} */
    public @Nullable String label() {
        return label;
    }

    /** @return the trigger icon, or {@code null} */
    public @Nullable String icon() {
        return icon;
    }

    /** @return whether the group has no children (so the host renders no trigger) */
    public boolean isEmpty() {
        return actions.isEmpty();
    }

    /**
     * Flattens top-level bulk actions and the children of every group into one dispatch list, in
     * order: top-level first, then each group's children in declaration order. This is the list the
     * host dispatches against (the bulk-action name is unique across the table).
     *
     * @param topLevel the bulk actions declared directly on the table
     * @param groups the bulk action groups declared on the table
     * @param <T> the row type
     * @return the flattened, ordered bulk actions
     */
    public static <T> List<BulkAction<T>> flatten(
            List<BulkAction<T>> topLevel, List<BulkActionGroup<T>> groups) {
        List<BulkAction<T>> flat = new ArrayList<>(topLevel);
        for (BulkActionGroup<T> group : groups) {
            flat.addAll(group.actions());
        }
        return flat;
    }
}
