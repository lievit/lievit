/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;

import org.jspecify.annotations.Nullable;

/**
 * A dropdown grouping of actions under one trigger (the Filament {@code ActionGroup} +
 * {@code HasDropdown}): the crowded row "⋮" menu (Edit / Replicate / Delete). The group exposes a
 * flat name→action map for dispatch and hides itself when all its children are hidden.
 *
 * @param <T> the resource row type
 */
public final class ActionGroup<T> {

    private final Map<String, AdminAction<T>> actions = new LinkedHashMap<>();
    private ActionVariant triggerVariant = ActionVariant.ICON_BUTTON;
    private @Nullable String label;
    private @Nullable String icon = "heroicon-m-ellipsis-vertical";

    @SafeVarargs
    private ActionGroup(AdminAction<T>... children) {
        for (AdminAction<T> a : children) {
            actions.put(a.name(), Objects.requireNonNull(a, "action"));
        }
    }

    /**
     * @param children the grouped actions
     * @param <T> the row type
     * @return a new action group
     */
    @SafeVarargs
    public static <T> ActionGroup<T> make(AdminAction<T>... children) {
        return new ActionGroup<>(children);
    }

    /**
     * Sets the trigger variant (icon-button by default).
     *
     * @param v the trigger variant
     * @return this group
     */
    public ActionGroup<T> trigger(ActionVariant v) {
        this.triggerVariant = Objects.requireNonNull(v, "v");
        return this;
    }

    /**
     * Sets a label on the trigger (e.g. "Actions").
     *
     * @param text the trigger label
     * @return this group
     */
    public ActionGroup<T> label(String text) {
        this.label = Objects.requireNonNull(text, "text");
        return this;
    }

    /**
     * Sets the trigger icon.
     *
     * @param iconName the icon name
     * @return this group
     */
    public ActionGroup<T> icon(@Nullable String iconName) {
        this.icon = iconName;
        return this;
    }

    /** @return the grouped actions, in declaration order */
    public List<AdminAction<T>> actions() {
        return new ArrayList<>(actions.values());
    }

    /**
     * Looks up a child action by name (the flat dispatch map).
     *
     * @param name the action name
     * @return the action, or empty if none
     */
    public Optional<AdminAction<T>> action(String name) {
        return Optional.ofNullable(actions.get(name));
    }

    /** @return the trigger variant */
    public ActionVariant triggerVariant() {
        return triggerVariant;
    }

    /** @return the trigger label, or {@code null} */
    public @Nullable String label() {
        return label;
    }

    /** @return the trigger icon, or {@code null} */
    public @Nullable String icon() {
        return icon;
    }

    /**
     * @param record the host record (or {@code null} for resource scope)
     * @return whether the group is hidden because every child is hidden for that record
     */
    public boolean isHiddenFor(@Nullable Object record) {
        if (actions.isEmpty()) {
            return true;
        }
        return actions.values().stream().allMatch(a -> a.isHiddenFor(record));
    }
}
