/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit.schema.infolist;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

import org.jspecify.annotations.Nullable;

import dev.lievit.kit.support.EvaluationContext;

/**
 * A titled infolist section (the filament-infolists {@code Section} layout carried onto the View
 * page): a heading, an optional description and heading icon, the layout flags (aside / collapsible
 * / collapsed), the column count its children lay out in, and an ordered set of child components
 * (entries and nested layout). The View-page mirror of the form {@link dev.lievit.kit.schema.Section}.
 *
 * <p>Resolving a section resolves each VISIBLE child against the same record context, producing a
 * {@link ResolvedNode.SectionNode} subtree (the structured read a renderer paints). A section never
 * holds state and is never validated, exactly like its entries.
 */
public final class InfolistSection implements InfolistComponent {

    private final String heading;
    private @Nullable String description;
    private @Nullable String icon;
    private boolean aside;
    private boolean collapsible;
    private boolean collapsed;
    private int columns = 1;
    private int columnSpan = 1;
    private final List<InfolistComponent> children = new ArrayList<>();

    private InfolistSection(String heading) {
        this.heading = Objects.requireNonNull(heading, "heading");
    }

    /**
     * @param heading the section heading
     * @return a new section
     */
    public static InfolistSection make(String heading) {
        return new InfolistSection(heading);
    }

    /**
     * Adds child components (entries and nested layout) in declaration order.
     *
     * @param toAdd the children
     * @return this section
     */
    public InfolistSection schema(InfolistComponent... toAdd) {
        for (InfolistComponent c : toAdd) {
            children.add(Objects.requireNonNull(c, "component"));
        }
        return this;
    }

    /**
     * Sets the description shown under the heading.
     *
     * @param value the description
     * @return this section
     */
    public InfolistSection description(String value) {
        this.description = Objects.requireNonNull(value, "description");
        return this;
    }

    /**
     * Sets the heading icon name (resolved against the host's icon vocabulary).
     *
     * @param iconName the icon name
     * @return this section
     */
    public InfolistSection icon(String iconName) {
        this.icon = Objects.requireNonNull(iconName, "iconName");
        return this;
    }

    /**
     * Places the heading and description in a side column beside the body (the filament
     * {@code aside()}).
     *
     * @return this section
     */
    public InfolistSection aside() {
        this.aside = true;
        return this;
    }

    /**
     * Makes the body collapsible (a client-side toggle, no round-trip).
     *
     * @return this section
     */
    public InfolistSection collapsible() {
        this.collapsible = true;
        return this;
    }

    /**
     * Makes the body collapsed by default (implies collapsible).
     *
     * @return this section
     */
    public InfolistSection collapsed() {
        this.collapsible = true;
        this.collapsed = true;
        return this;
    }

    /**
     * Lays children out in an {@code n}-column grid.
     *
     * @param columns the column count (at least 1)
     * @return this section
     */
    public InfolistSection columns(int columns) {
        if (columns < 1) {
            throw new IllegalArgumentException("columns must be at least 1");
        }
        this.columns = columns;
        return this;
    }

    /**
     * Sets how many parent grid columns this section spans.
     *
     * @param columnSpan the span (at least 1)
     * @return this section
     */
    public InfolistSection columnSpan(int columnSpan) {
        if (columnSpan < 1) {
            throw new IllegalArgumentException("columnSpan must be at least 1");
        }
        this.columnSpan = columnSpan;
        return this;
    }

    /** @return the heading */
    public String heading() {
        return heading;
    }

    /** @return the description, or {@code null} */
    public @Nullable String description() {
        return description;
    }

    /** @return the heading icon name, or {@code null} */
    public @Nullable String icon() {
        return icon;
    }

    /** @return whether the heading sits aside the body */
    public boolean isAside() {
        return aside;
    }

    /** @return whether the body can collapse client-side */
    public boolean isCollapsible() {
        return collapsible;
    }

    /** @return whether the body starts collapsed */
    public boolean isCollapsed() {
        return collapsed;
    }

    /** @return the column count (default 1) */
    public int columns() {
        return columns;
    }

    /** @return the parent column span (default 1) */
    public int columnSpan() {
        return columnSpan;
    }

    /** @return the children in declaration order (unmodifiable) */
    public List<InfolistComponent> children() {
        return List.copyOf(children);
    }

    @Override
    public ResolvedNode resolveNode(EvaluationContext context) {
        List<ResolvedNode> resolved = new ArrayList<>();
        for (InfolistComponent child : children) {
            if (child.isVisibleComponent()) {
                resolved.add(child.resolveNode(context));
            }
        }
        return new ResolvedNode.SectionNode(
                heading, description, icon, aside, collapsible, collapsed, columns, columnSpan,
                resolved);
    }
}
