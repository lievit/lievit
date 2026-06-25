/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit.component;

import java.util.Objects;

import org.jspecify.annotations.Nullable;

/**
 * The section view-model (the Filament {@code SectionComponent} carried over): a titled, optionally
 * collapsible container the schema and infolist surfaces group fields under. Carries the heading, an
 * optional description, and the collapsible / collapsed state the JTE section partial reads.
 */
public final class SectionView {

    private final String heading;
    private @Nullable String description;
    private boolean collapsible;
    private boolean collapsed;

    private SectionView(String heading) {
        this.heading = Objects.requireNonNull(heading, "heading");
    }

    /**
     * @param heading the section heading
     * @return a section view
     */
    public static SectionView make(String heading) {
        return new SectionView(heading);
    }

    /**
     * @param text the section description
     * @return this view
     */
    public SectionView description(String text) {
        this.description = Objects.requireNonNull(text, "text");
        return this;
    }

    /**
     * Marks the section collapsed (implies collapsible).
     *
     * @param value whether the section starts collapsed
     * @return this view
     */
    public SectionView collapsed(boolean value) {
        this.collapsed = value;
        if (value) {
            this.collapsible = true;
        }
        return this;
    }

    /**
     * Marks the section collapsible (but open).
     *
     * @return this view
     */
    public SectionView collapsible() {
        this.collapsible = true;
        return this;
    }

    /** @return the section heading */
    public String heading() {
        return heading;
    }

    /** @return the section description, or {@code null} if none */
    public @Nullable String description() {
        return description;
    }

    /** @return whether the section can be collapsed */
    public boolean isCollapsible() {
        return collapsible;
    }

    /** @return whether the section starts collapsed */
    public boolean isCollapsed() {
        return collapsed;
    }
}
