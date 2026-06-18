/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit.schema;

import java.util.Objects;

import org.jspecify.annotations.Nullable;

import io.lievit.kit.Color;

/**
 * A colored info box inside a schema (the filament-schemas {@code Callout} carried over): a heading,
 * a body, an optional leading icon, and a semantic color that tints the box (an {@code info} note, a
 * {@code warning} banner). Non-input, never dehydrated, never validated.
 */
public final class Callout extends SchemaComponent<@Nullable Object, Callout> {

    private final String heading;
    private @Nullable String body;
    private @Nullable String icon;
    private Color color = Color.INFO;

    private Callout(String heading) {
        this.heading = Objects.requireNonNull(heading, "heading");
        dehydrated(false);
    }

    /**
     * @param heading the callout heading
     * @return a new callout, defaulting to the {@code info} color
     */
    public static Callout make(String heading) {
        return new Callout(heading);
    }

    /**
     * @return the heading
     */
    public String heading() {
        return heading;
    }

    /**
     * Sets the callout body shown under the heading.
     *
     * @param body the body text
     * @return this callout
     */
    public Callout body(String body) {
        this.body = Objects.requireNonNull(body, "body");
        return this;
    }

    /**
     * @return the body, or {@code null}
     */
    public @Nullable String body() {
        return body;
    }

    /**
     * Sets a leading icon.
     *
     * @param icon the icon name/alias
     * @return this callout
     */
    public Callout icon(String icon) {
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
     * Sets the box color.
     *
     * @param color the semantic color
     * @return this callout
     */
    public Callout color(Color color) {
        this.color = Objects.requireNonNull(color, "color");
        return this;
    }

    /**
     * @return the box color (default {@link Color#INFO})
     */
    public Color color() {
        return color;
    }
}
