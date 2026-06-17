/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit;

import java.util.Objects;
import java.util.Optional;
import java.util.function.Predicate;
import java.util.function.Supplier;

import org.jspecify.annotations.Nullable;

/**
 * One entry in the admin navigation tree (the Filament {@code NavigationItem}, mapped to a
 * fluent immutable-ish builder). An item carries a label and a target url, plus the presentation
 * and behaviour slots a real admin sidebar needs: an {@link Icon} (and an optional active-state
 * icon), a badge with a {@link Color}, a sort key, an optional parent label (for nesting under a
 * group), a visibility predicate, and an active-state resolver keyed on the current request path.
 *
 * <p>Visibility is the seam where authorization removes an entry from the tree: a hidden item is
 * filtered before the tree is rendered ({@link NavigationBuilder#visibleItems()}), so an
 * unauthorized resource never paints its sidebar entry.
 */
public final class NavigationItem {

    private final String label;
    private final String url;
    private @Nullable Icon icon;
    private @Nullable Icon activeIcon;
    private @Nullable String badge;
    private @Nullable Color badgeColor;
    private int sort = Integer.MAX_VALUE;
    private @Nullable String group;
    private Supplier<Boolean> visible = () -> true;
    private @Nullable Predicate<String> isActiveWhen;

    private NavigationItem(String label, String url) {
        this.label = Objects.requireNonNull(label, "label");
        this.url = Objects.requireNonNull(url, "url");
    }

    /**
     * @param label the human label shown in the sidebar
     * @param url   the target url
     * @return a new navigation item
     */
    public static NavigationItem make(String label, String url) {
        return new NavigationItem(label, url);
    }

    /**
     * @param icon the icon shown beside the label
     * @return this item
     */
    public NavigationItem icon(Icon icon) {
        this.icon = Objects.requireNonNull(icon, "icon");
        return this;
    }

    /**
     * @param activeIcon the icon shown when this item is the active one
     * @return this item
     */
    public NavigationItem activeIcon(Icon activeIcon) {
        this.activeIcon = Objects.requireNonNull(activeIcon, "activeIcon");
        return this;
    }

    /**
     * @param badge the badge text (for example a pending count)
     * @return this item
     */
    public NavigationItem badge(String badge) {
        this.badge = Objects.requireNonNull(badge, "badge");
        return this;
    }

    /**
     * @param badge      the badge text
     * @param badgeColor the badge color
     * @return this item
     */
    public NavigationItem badge(String badge, Color badgeColor) {
        this.badge = Objects.requireNonNull(badge, "badge");
        this.badgeColor = Objects.requireNonNull(badgeColor, "badgeColor");
        return this;
    }

    /**
     * @param sort the sort key (ascending; default {@link Integer#MAX_VALUE} sorts last)
     * @return this item
     */
    public NavigationItem sort(int sort) {
        this.sort = sort;
        return this;
    }

    /**
     * @param group the label of the {@link NavigationGroup} this item belongs to
     * @return this item
     */
    public NavigationItem group(String group) {
        this.group = Objects.requireNonNull(group, "group");
        return this;
    }

    /**
     * @param visible {@code true} to show, {@code false} to hide
     * @return this item
     */
    public NavigationItem visible(boolean visible) {
        this.visible = () -> visible;
        return this;
    }

    /**
     * Sets a lazy visibility predicate, evaluated each time {@link #isVisible()} is called (so an
     * authorization check runs at render time, not at registration time).
     *
     * @param visible supplies the current visibility
     * @return this item
     */
    public NavigationItem visible(Supplier<Boolean> visible) {
        this.visible = Objects.requireNonNull(visible, "visible");
        return this;
    }

    /**
     * @param hidden {@code true} to hide (inverse of {@link #visible(boolean)})
     * @return this item
     */
    public NavigationItem hidden(boolean hidden) {
        return visible(!hidden);
    }

    /**
     * Sets the active-state predicate: given the current request path, decides whether this item is
     * the active one. Defaults to an exact match on the item's url.
     *
     * @param isActiveWhen the predicate over the current request path
     * @return this item
     */
    public NavigationItem isActiveWhen(Predicate<String> isActiveWhen) {
        this.isActiveWhen = Objects.requireNonNull(isActiveWhen, "isActiveWhen");
        return this;
    }

    /** @return the label */
    public String label() {
        return label;
    }

    /** @return the target url */
    public String url() {
        return url;
    }

    /** @return the icon, if set */
    public Optional<Icon> icon() {
        return Optional.ofNullable(icon);
    }

    /** @return the active-state icon, if set */
    public Optional<Icon> activeIcon() {
        return Optional.ofNullable(activeIcon);
    }

    /** @return the badge text, if set */
    public Optional<String> badge() {
        return Optional.ofNullable(badge);
    }

    /** @return the badge color, if set */
    public Optional<Color> badgeColor() {
        return Optional.ofNullable(badgeColor);
    }

    /** @return the sort key */
    public int sortKey() {
        return sort;
    }

    /** @return the group label, if this item belongs to a group */
    public Optional<String> groupLabel() {
        return Optional.ofNullable(group);
    }

    /** @return whether this item is currently visible (evaluates the visibility supplier) */
    public boolean isVisible() {
        return Boolean.TRUE.equals(visible.get());
    }

    /**
     * Resolves the active state against the current request path.
     *
     * @param currentPath the current request path
     * @return {@code true} if this item is the active one for that path
     */
    public boolean isActive(String currentPath) {
        if (isActiveWhen != null) {
            return isActiveWhen.test(currentPath);
        }
        return url.equals(currentPath);
    }

    /**
     * Resolves which icon to render given the active state: the active icon when active and set,
     * otherwise the base icon.
     *
     * @param active whether this item is currently active
     * @return the icon to render, if any
     */
    public Optional<Icon> resolvedIcon(boolean active) {
        if (active && activeIcon != null) {
            return Optional.of(activeIcon);
        }
        return Optional.ofNullable(icon);
    }
}
