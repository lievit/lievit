/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit;

import java.util.Objects;

import org.jspecify.annotations.Nullable;

/**
 * One item in the topbar user menu (the Filament {@code Navigation/MenuItem}): a labelled link with
 * an optional icon, colour, target and new-tab flag, plus a sort key. Distinct from a
 * {@link NavigationItem} (the sidebar tree): a user-menu item lives in the avatar dropdown alongside
 * the always-present logout.
 *
 * <p>Immutable; build with {@link #make(String, String)} and the {@code with}-style methods.
 */
public final class MenuItem {

    private final String label;
    private final String url;
    private final @Nullable String icon;
    private final @Nullable String color;
    private final boolean openInNewTab;
    private final int sort;

    private MenuItem(
            String label,
            String url,
            @Nullable String icon,
            @Nullable String color,
            boolean openInNewTab,
            int sort) {
        this.label = Objects.requireNonNull(label, "label");
        this.url = Objects.requireNonNull(url, "url");
        this.icon = icon;
        this.color = color;
        this.openInNewTab = openInNewTab;
        this.sort = sort;
    }

    /**
     * @param label the item label
     * @param url the target url
     * @return a user-menu item
     */
    public static MenuItem make(String label, String url) {
        return new MenuItem(label, url, null, null, false, Integer.MAX_VALUE);
    }

    /**
     * @param iconName the icon name
     * @return a copy with the icon set
     */
    public MenuItem icon(String iconName) {
        return new MenuItem(label, url, iconName, color, openInNewTab, sort);
    }

    /**
     * @param colorName the semantic colour
     * @return a copy with the colour set
     */
    public MenuItem color(String colorName) {
        return new MenuItem(label, url, icon, colorName, openInNewTab, sort);
    }

    /**
     * @return a copy that opens the url in a new tab
     */
    public MenuItem openUrlInNewTab() {
        return new MenuItem(label, url, icon, color, true, sort);
    }

    /**
     * @param sortKey the sort key (lower renders first)
     * @return a copy with the sort key set
     */
    public MenuItem sort(int sortKey) {
        return new MenuItem(label, url, icon, color, openInNewTab, sortKey);
    }

    /** @return the item label */
    public String label() {
        return label;
    }

    /** @return the target url */
    public String url() {
        return url;
    }

    /** @return the icon name, or {@code null} */
    public @Nullable String icon() {
        return icon;
    }

    /** @return the colour, or {@code null} */
    public @Nullable String color() {
        return color;
    }

    /** @return whether the url opens in a new tab */
    public boolean opensInNewTab() {
        return openInNewTab;
    }

    /** @return the sort key */
    public int sortKey() {
        return sort;
    }
}
