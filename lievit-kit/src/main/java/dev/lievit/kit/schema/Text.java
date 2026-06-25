/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit.schema;

import java.util.Objects;

import org.jspecify.annotations.Nullable;

import dev.lievit.kit.Color;

/**
 * A literal text fragment displayed inside a schema (the filament-schemas {@code Text} prose
 * component carried over): a non-input, non-dehydrated run of text with an optional weight/color for
 * emphasis. Unlike {@link Placeholder} it carries no label; it is a bare line of copy between
 * fields. Use {@link Html} for markup you trust, {@link Callout} for a boxed banner.
 */
public final class Text extends SchemaComponent<@Nullable Object, Text> {

    /** The font weight a text run renders at. */
    public enum Weight {
        /** Normal weight. */
        NORMAL,
        /** Medium weight. */
        MEDIUM,
        /** Semibold weight. */
        SEMIBOLD,
        /** Bold weight. */
        BOLD
    }

    private final String content;
    private Weight weight = Weight.NORMAL;
    private @Nullable Color color;

    private Text(String content) {
        this.content = Objects.requireNonNull(content, "content");
        dehydrated(false);
    }

    /**
     * @param content the literal text
     * @return a new text fragment
     */
    public static Text make(String content) {
        return new Text(content);
    }

    /**
     * @return the literal text
     */
    public String content() {
        return content;
    }

    /**
     * Sets the font weight.
     *
     * @param weight the weight
     * @return this text
     */
    public Text weight(Weight weight) {
        this.weight = Objects.requireNonNull(weight, "weight");
        return this;
    }

    /**
     * @return the font weight (default {@link Weight#NORMAL})
     */
    public Weight weight() {
        return weight;
    }

    /**
     * Sets the text color (a semantic palette color).
     *
     * @param color the color
     * @return this text
     */
    public Text color(Color color) {
        this.color = Objects.requireNonNull(color, "color");
        return this;
    }

    /**
     * @return the color, or {@code null} for the default
     */
    public @Nullable Color color() {
        return color;
    }
}
