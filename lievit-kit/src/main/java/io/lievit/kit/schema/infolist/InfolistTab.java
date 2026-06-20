/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit.schema.infolist;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

import org.jspecify.annotations.Nullable;

import io.lievit.kit.support.EvaluationContext;

/**
 * One tab of an {@link InfolistTabs} (the filament-infolists {@code Tabs\Tab} carried over): a
 * label, an optional icon, the column count its children lay out in, and an ordered set of child
 * components. Its stable id is the slug of the label (lower-kebab), the handle the active-tab state
 * references over the wire.
 *
 * <p>A tab is not itself an {@link InfolistComponent}: it lives only inside an {@link InfolistTabs}.
 * {@link #resolveTab} resolves its visible children against the record into a
 * {@link ResolvedNode.TabNode}.
 */
public final class InfolistTab {

    private final String label;
    private final String id;
    private @Nullable String icon;
    private int columns = 1;
    private final List<InfolistComponent> children = new ArrayList<>();

    private InfolistTab(String label) {
        this.label = Objects.requireNonNull(label, "label");
        this.id = slug(label);
    }

    /**
     * @param label the tab label
     * @return a new tab
     */
    public static InfolistTab make(String label) {
        return new InfolistTab(label);
    }

    /**
     * Adds child components (entries and nested layout) in declaration order.
     *
     * @param toAdd the children
     * @return this tab
     */
    public InfolistTab schema(InfolistComponent... toAdd) {
        for (InfolistComponent c : toAdd) {
            children.add(Objects.requireNonNull(c, "component"));
        }
        return this;
    }

    /**
     * Sets the tab icon name.
     *
     * @param iconName the icon name
     * @return this tab
     */
    public InfolistTab icon(String iconName) {
        this.icon = Objects.requireNonNull(iconName, "iconName");
        return this;
    }

    /**
     * Lays the tab's children out in an {@code n}-column grid.
     *
     * @param columns the column count (at least 1)
     * @return this tab
     */
    public InfolistTab columns(int columns) {
        if (columns < 1) {
            throw new IllegalArgumentException("columns must be at least 1");
        }
        this.columns = columns;
        return this;
    }

    /** @return the stable tab id (slug of the label) */
    public String id() {
        return id;
    }

    /** @return the tab label */
    public String label() {
        return label;
    }

    /** @return the tab icon name, or {@code null} */
    public @Nullable String icon() {
        return icon;
    }

    /** @return the column count (default 1) */
    public int columns() {
        return columns;
    }

    /** @return the children in declaration order (unmodifiable) */
    public List<InfolistComponent> children() {
        return List.copyOf(children);
    }

    /**
     * Resolves this tab's visible children against the record.
     *
     * @param context the live evaluation context
     * @return the resolved tab node
     */
    ResolvedNode.TabNode resolveTab(EvaluationContext context) {
        List<ResolvedNode> resolved = new ArrayList<>();
        for (InfolistComponent child : children) {
            if (child.isVisibleComponent()) {
                resolved.add(child.resolveNode(context));
            }
        }
        return new ResolvedNode.TabNode(id, label, icon, columns, resolved);
    }

    /** Slugs a label into a stable, URL-safe id (lower-kebab; the active-tab handle). */
    static String slug(String label) {
        String slug = label.trim().toLowerCase(java.util.Locale.ROOT)
                .replaceAll("[^a-z0-9]+", "-")
                .replaceAll("(^-+)|(-+$)", "");
        return slug.isEmpty() ? "tab" : slug;
    }
}
