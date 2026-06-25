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
import java.util.Optional;

import org.jspecify.annotations.Nullable;

/**
 * A collapsible cluster of {@link NavigationItem}s under a shared label and icon (the Filament
 * {@code NavigationGroup}). The group renders its items sorted by their sort key; only the visible
 * items are returned, so an authorization-hidden item drops out of the group too.
 */
public final class NavigationGroup {

    private final String label;
    private @Nullable Icon icon;
    private boolean collapsible = true;
    private boolean collapsed;
    private int sort = Integer.MAX_VALUE;
    private final List<NavigationItem> items = new ArrayList<>();

    private NavigationGroup(String label) {
        this.label = Objects.requireNonNull(label, "label");
    }

    /**
     * @param label the group label
     * @return a new, empty group
     */
    public static NavigationGroup make(String label) {
        return new NavigationGroup(label);
    }

    /**
     * @param icon the group icon
     * @return this group
     */
    public NavigationGroup icon(Icon icon) {
        this.icon = Objects.requireNonNull(icon, "icon");
        return this;
    }

    /**
     * @param collapsible whether the group can be collapsed in the sidebar
     * @return this group
     */
    public NavigationGroup collapsible(boolean collapsible) {
        this.collapsible = collapsible;
        return this;
    }

    /**
     * @param collapsed whether the group starts collapsed
     * @return this group
     */
    public NavigationGroup collapsed(boolean collapsed) {
        this.collapsed = collapsed;
        return this;
    }

    /**
     * @param sort the group sort key (ascending; groups are ordered by this)
     * @return this group
     */
    public NavigationGroup sort(int sort) {
        this.sort = sort;
        return this;
    }

    /**
     * Adds an item to this group. The item's own {@link NavigationItem#group(String)} is set to
     * this group's label so it round-trips.
     *
     * @param item the item to add
     * @return this group
     */
    public NavigationGroup item(NavigationItem item) {
        Objects.requireNonNull(item, "item").group(label);
        items.add(item);
        return this;
    }

    /** @return the group label */
    public String label() {
        return label;
    }

    /** @return the group icon, if set */
    public Optional<Icon> icon() {
        return Optional.ofNullable(icon);
    }

    /** @return whether the group can be collapsed */
    public boolean isCollapsible() {
        return collapsible;
    }

    /** @return whether the group starts collapsed */
    public boolean isCollapsed() {
        return collapsed;
    }

    /** @return the group sort key */
    public int sortKey() {
        return sort;
    }

    /** @return all items (visible or not), in insertion order, as an unmodifiable snapshot */
    public List<NavigationItem> items() {
        return Collections.unmodifiableList(items);
    }

    /**
     * @return the currently-visible items, sorted by their sort key (ascending), as an unmodifiable
     *     snapshot — the rendered contents of the group
     */
    public List<NavigationItem> visibleItems() {
        List<NavigationItem> visible =
                items.stream()
                        .filter(NavigationItem::isVisible)
                        .sorted(Comparator.comparingInt(NavigationItem::sortKey))
                        .toList();
        return Collections.unmodifiableList(visible);
    }
}
