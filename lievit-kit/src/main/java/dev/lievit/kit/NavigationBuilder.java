/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;

/**
 * Builds the panel's navigation tree (the Filament {@code NavigationBuilder} returned from a
 * {@code navigation()} closure): a flat list of top-level {@link NavigationItem}s plus
 * {@link NavigationGroup}s. The builder is the single place navigation-as-authorization is
 * enforced: {@link #visibleItems()} and {@link #visibleGroups()} return only what the current user
 * may see, sorted by sort key, so an unauthorized entry never renders.
 *
 * <p>Top-level items and groups are ordered together by their sort key when the shell paints them;
 * this builder exposes them separately (items vs groups) because the two render differently, but
 * both honour the same ascending sort.
 */
public final class NavigationBuilder {

    private final List<NavigationItem> items = new ArrayList<>();
    private final List<NavigationGroup> groups = new ArrayList<>();

    /**
     * @return a new, empty navigation builder
     */
    public static NavigationBuilder create() {
        return new NavigationBuilder();
    }

    /**
     * Adds a top-level item (not in any group).
     *
     * @param item the item
     * @return this builder
     */
    public NavigationBuilder item(NavigationItem item) {
        items.add(Objects.requireNonNull(item, "item"));
        return this;
    }

    /**
     * Adds a group.
     *
     * @param group the group
     * @return this builder
     */
    public NavigationBuilder group(NavigationGroup group) {
        groups.add(Objects.requireNonNull(group, "group"));
        return this;
    }

    /** @return all top-level items (visible or not), in insertion order */
    public List<NavigationItem> items() {
        return Collections.unmodifiableList(items);
    }

    /** @return all groups (visible or not), in insertion order */
    public List<NavigationGroup> groups() {
        return Collections.unmodifiableList(groups);
    }

    /**
     * @return the visible top-level items, sorted ascending by sort key (the rendered top-level
     *     entries; hidden items are filtered out)
     */
    public List<NavigationItem> visibleItems() {
        return items.stream()
                .filter(NavigationItem::isVisible)
                .sorted(Comparator.comparingInt(NavigationItem::sortKey))
                .toList();
    }

    /**
     * @return the visible groups, sorted ascending by group sort key, each already exposing only its
     *     visible items via {@link NavigationGroup#visibleItems()}. A group whose items are all
     *     hidden is dropped (an empty group does not render).
     */
    public List<NavigationGroup> visibleGroups() {
        return groups.stream()
                .filter(g -> !g.visibleItems().isEmpty())
                .sorted(Comparator.comparingInt(NavigationGroup::sortKey))
                .toList();
    }
}
