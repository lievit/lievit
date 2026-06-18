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
 * A titled section wrapping a heading, optional description, and a grid of child fields (the
 * filament-schemas {@code Section} carried over, its most-used layout). Collapsible/collapsed,
 * compact, and aside (heading in a side column) are client-side presentation flags; the section
 * participates in the state engine like any container (children dehydrate normally).
 */
public final class Section extends Layout<Section> {

    private final String heading;
    private @Nullable String description;
    private boolean collapsible;
    private boolean collapsed;
    private boolean compact;
    private boolean aside;
    private final List<SchemaAction> headerActions = new ArrayList<>();
    private final List<SchemaAction> footerActions = new ArrayList<>();

    private Section(String heading) {
        this.heading = Objects.requireNonNull(heading, "heading");
    }

    /**
     * @param heading the section heading
     * @return a new section
     */
    public static Section make(String heading) {
        return new Section(heading);
    }

    /**
     * @return the section heading
     */
    public String heading() {
        return heading;
    }

    /**
     * Sets the section description shown under the heading.
     *
     * @param description the description text
     * @return this section
     */
    public Section description(String description) {
        this.description = Objects.requireNonNull(description, "description");
        return this;
    }

    /**
     * @return the description, or {@code null} if none
     */
    public @Nullable String description() {
        return description;
    }

    /**
     * Makes the section body collapsible (a client-side toggle, no round-trip).
     *
     * @return this section
     */
    public Section collapsible() {
        this.collapsible = true;
        return this;
    }

    /**
     * Makes the section collapsed by default (implies collapsible).
     *
     * @return this section
     */
    public Section collapsed() {
        this.collapsible = true;
        this.collapsed = true;
        return this;
    }

    /**
     * @return {@code true} if the body can be collapsed client-side
     */
    public boolean isCollapsible() {
        return collapsible;
    }

    /**
     * @return {@code true} if the body starts collapsed
     */
    public boolean isCollapsed() {
        return collapsed;
    }

    /**
     * Renders the section in a compact density.
     *
     * @return this section
     */
    public Section compact() {
        this.compact = true;
        return this;
    }

    /**
     * @return {@code true} if rendered compact
     */
    public boolean isCompact() {
        return compact;
    }

    /**
     * Places the heading and description in a side column beside the body.
     *
     * @return this section
     */
    public Section aside() {
        this.aside = true;
        return this;
    }

    /**
     * @return {@code true} if the heading sits aside the body
     */
    public boolean isAside() {
        return aside;
    }

    // ── header / footer actions (filament HasHeaderActions / HasFooterActions) ──

    /**
     * Sets the actions shown in the section header, beside the heading (the filament
     * {@code HasHeaderActions}): a section-level toolbar of {@link SchemaAction} buttons.
     *
     * @param actions the header actions, in display order
     * @return this section
     */
    public Section headerActions(List<SchemaAction> actions) {
        this.headerActions.clear();
        for (SchemaAction a : actions) {
            this.headerActions.add(Objects.requireNonNull(a, "action"));
        }
        return this;
    }

    /**
     * @return the section header actions in display order (unmodifiable)
     */
    public List<SchemaAction> headerActions() {
        return List.copyOf(headerActions);
    }

    /**
     * Sets the actions shown in the section footer, beneath the body (the filament
     * {@code HasFooterActions}).
     *
     * @param actions the footer actions, in display order
     * @return this section
     */
    public Section footerActions(List<SchemaAction> actions) {
        this.footerActions.clear();
        for (SchemaAction a : actions) {
            this.footerActions.add(Objects.requireNonNull(a, "action"));
        }
        return this;
    }

    /**
     * @return the section footer actions in display order (unmodifiable)
     */
    public List<SchemaAction> footerActions() {
        return List.copyOf(footerActions);
    }
}
