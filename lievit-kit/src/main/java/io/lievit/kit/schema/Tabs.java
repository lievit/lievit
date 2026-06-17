/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit.schema;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

import org.jspecify.annotations.Nullable;

/**
 * A tabbed container (the filament-schemas {@code Tabs} + {@code Tabs/Tab} carried over): a tab
 * strip over {@link Tab} children, each with a label and optional icon/badge. Tab switching is
 * client-side (no full reload) and hidden tabs' fields still validate and submit. The active tab
 * can be persisted in the query string.
 */
public final class Tabs extends SchemaComponent<@Nullable Object, Tabs> {

    private final List<Tab> tabs = new ArrayList<>();
    private boolean persistInQueryString;

    private Tabs() {}

    /**
     * @return a new, empty tabs container
     */
    public static Tabs make() {
        return new Tabs();
    }

    /**
     * Adds tabs to the strip.
     *
     * @param toAdd the tabs in display order
     * @return this container
     */
    public Tabs tabs(Tab... toAdd) {
        for (Tab tab : toAdd) {
            tabs.add(Objects.requireNonNull(tab, "tab"));
        }
        return this;
    }

    /**
     * @return the tabs in display order (unmodifiable)
     */
    public List<Tab> tabs() {
        return List.copyOf(tabs);
    }

    /**
     * Persists the active tab across reloads via the query string.
     *
     * @return this container
     */
    public Tabs persistTabInQueryString() {
        this.persistInQueryString = true;
        return this;
    }

    /**
     * @return {@code true} if the active tab is persisted in the query string
     */
    public boolean isPersistInQueryString() {
        return persistInQueryString;
    }

    /** A single tab: a label, optional icon/badge, and a child schema. */
    public static final class Tab extends Layout<Tab> {

        private final String label;
        private @Nullable String icon;
        private @Nullable String badge;

        private Tab(String label) {
            this.label = Objects.requireNonNull(label, "label");
        }

        /**
         * @param label the tab label
         * @return a new tab
         */
        public static Tab make(String label) {
            return new Tab(label);
        }

        /**
         * @return the tab label
         */
        public String label() {
            return label;
        }

        /**
         * Sets the tab icon (an icon name or alias resolved by the icon registry).
         *
         * @param icon the icon name/alias
         * @return this tab
         */
        public Tab icon(String icon) {
            this.icon = Objects.requireNonNull(icon, "icon");
            return this;
        }

        /**
         * @return the icon name/alias, or {@code null}
         */
        public @Nullable String icon() {
            return icon;
        }

        /**
         * Sets a badge shown on the tab.
         *
         * @param badge the badge text
         * @return this tab
         */
        public Tab badge(String badge) {
            this.badge = Objects.requireNonNull(badge, "badge");
            return this;
        }

        /**
         * @return the badge text, or {@code null}
         */
        public @Nullable String badge() {
            return badge;
        }
    }
}
