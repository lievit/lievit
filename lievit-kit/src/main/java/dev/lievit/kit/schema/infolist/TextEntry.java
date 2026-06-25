/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit.schema.infolist;

import java.time.format.DateTimeFormatter;
import java.time.temporal.TemporalAccessor;
import java.util.Locale;
import java.util.Objects;

import org.jspecify.annotations.Nullable;

import dev.lievit.kit.Color;

/**
 * A text infolist entry (the filament-infolists {@code TextEntry} carried over): shows a record
 * attribute as text, with the common display sugar, badge / color, copyable, a character limit, and
 * a tooltip. The money / dateTime helpers install a {@code formatStateUsing} transform, so they
 * compose with a custom one (last writer wins, the Filament order).
 */
public final class TextEntry extends Entry<TextEntry> {

    private boolean badge;
    private @Nullable Color color;
    private boolean copyable;
    private @Nullable Integer limit;
    private @Nullable String tooltip;

    private TextEntry(String name) {
        super(name);
    }

    /**
     * @param name the record attribute and label source
     * @return a new text entry
     */
    public static TextEntry make(String name) {
        return new TextEntry(name);
    }

    /**
     * Renders the value as a colored badge.
     *
     * @return this entry
     */
    public TextEntry badge() {
        this.badge = true;
        return this;
    }

    /**
     * @return {@code true} if rendered as a badge
     */
    public boolean isBadge() {
        return badge;
    }

    /**
     * Sets the text/badge color.
     *
     * @param color the semantic color
     * @return this entry
     */
    public TextEntry color(Color color) {
        this.color = Objects.requireNonNull(color, "color");
        return this;
    }

    /**
     * @return the color, or {@code null} for the default
     */
    public @Nullable Color color() {
        return color;
    }

    /**
     * Adds a click-to-copy affordance.
     *
     * @return this entry
     */
    public TextEntry copyable() {
        this.copyable = true;
        return this;
    }

    /**
     * @return {@code true} if the value is copyable
     */
    public boolean isCopyable() {
        return copyable;
    }

    /**
     * Truncates the displayed text to a maximum length (a tooltip shows the full value).
     *
     * @param limit the maximum character count (at least 1)
     * @return this entry
     */
    public TextEntry limit(int limit) {
        if (limit < 1) {
            throw new IllegalArgumentException("limit must be at least 1");
        }
        this.limit = limit;
        return this;
    }

    /**
     * @return the character limit, or {@code null} if unbounded
     */
    public @Nullable Integer limit() {
        return limit;
    }

    /**
     * Sets a hover tooltip.
     *
     * @param tooltip the tooltip text
     * @return this entry
     */
    public TextEntry tooltip(String tooltip) {
        this.tooltip = Objects.requireNonNull(tooltip, "tooltip");
        return this;
    }

    /**
     * @return the tooltip, or {@code null}
     */
    public @Nullable String tooltip() {
        return tooltip;
    }

    /**
     * Formats the value as a currency amount in the given ISO code (installs a format transform).
     *
     * @param currencyCode the ISO 4217 code ({@code "EUR"})
     * @return this entry
     */
    public TextEntry money(String currencyCode) {
        Objects.requireNonNull(currencyCode, "currencyCode");
        return formatStateUsing(
                value -> {
                    if (value == null || String.valueOf(value).isBlank()) {
                        return null;
                    }
                    double amount = toNumber(value);
                    return currencyCode + " " + String.format(Locale.ROOT, "%.2f", amount);
                });
    }

    /**
     * Formats a temporal value with the given pattern (installs a format transform).
     *
     * @param pattern the {@link DateTimeFormatter} pattern ({@code "yyyy-MM-dd HH:mm"})
     * @return this entry
     */
    public TextEntry dateTime(String pattern) {
        DateTimeFormatter formatter = DateTimeFormatter.ofPattern(pattern, Locale.ROOT);
        return formatStateUsing(
                value -> {
                    if (value instanceof TemporalAccessor temporal) {
                        return formatter.format(temporal);
                    }
                    return value;
                });
    }

    private static double toNumber(Object value) {
        if (value instanceof Number n) {
            return n.doubleValue();
        }
        return Double.parseDouble(String.valueOf(value).trim());
    }
}
