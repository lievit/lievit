/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit.schema.infolist;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;

import org.jspecify.annotations.Nullable;

import dev.lievit.kit.Color;

/**
 * An icon infolist entry (the filament-infolists {@code IconEntry} carried over): maps the record's
 * value to an icon (and optionally a color), the read-only mirror of a boolean/enum state. A
 * boolean-state entry uses {@link #booleanIcons} (a check / cross); an enum-like one maps each value
 * to an icon via {@link #icon(Function)} and color via {@link #color(Function)}.
 */
public final class IconEntry extends Entry<IconEntry> {

    private Function<@Nullable Object, @Nullable String> icon = v -> null;
    private Function<@Nullable Object, @Nullable Color> color = v -> null;

    private IconEntry(String name) {
        super(name);
    }

    /**
     * @param name the record attribute and label source
     * @return a new icon entry
     */
    public static IconEntry make(String name) {
        return new IconEntry(name);
    }

    /**
     * Maps each value to an icon name/alias.
     *
     * @param icon produces the icon from the value
     * @return this entry
     */
    public IconEntry icon(Function<@Nullable Object, @Nullable String> icon) {
        this.icon = Objects.requireNonNull(icon, "icon");
        return this;
    }

    /**
     * Maps a value-to-icon table (the common enum case).
     *
     * @param mapping value to icon name/alias
     * @return this entry
     */
    public IconEntry icons(Map<Object, String> mapping) {
        Map<Object, String> snapshot = new LinkedHashMap<>(Objects.requireNonNull(mapping, "mapping"));
        return icon(value -> value == null ? null : snapshot.get(value));
    }

    /**
     * Maps a truthy value to one icon and a falsy value to another (the boolean-state case).
     *
     * @param trueIcon the icon for a truthy value
     * @param falseIcon the icon for a falsy value
     * @return this entry
     */
    public IconEntry booleanIcons(String trueIcon, String falseIcon) {
        Objects.requireNonNull(trueIcon, "trueIcon");
        Objects.requireNonNull(falseIcon, "falseIcon");
        return icon(value -> isTruthy(value) ? trueIcon : falseIcon);
    }

    /**
     * Maps each value to a color.
     *
     * @param color produces the color from the value
     * @return this entry
     */
    public IconEntry color(Function<@Nullable Object, @Nullable Color> color) {
        this.color = Objects.requireNonNull(color, "color");
        return this;
    }

    /**
     * Resolves the icon for the record's value.
     *
     * @param value the resolved attribute value
     * @return the icon name/alias, or {@code null}
     */
    public @Nullable String resolveIcon(@Nullable Object value) {
        return icon.apply(value);
    }

    /**
     * Resolves the color for the record's value.
     *
     * @param value the resolved attribute value
     * @return the color, or {@code null}
     */
    public @Nullable Color resolveColor(@Nullable Object value) {
        return color.apply(value);
    }

    private static boolean isTruthy(@Nullable Object value) {
        if (value instanceof Boolean b) {
            return b;
        }
        String s = value == null ? "" : String.valueOf(value);
        return s.equals("true") || s.equals("1") || s.equalsIgnoreCase("on");
    }

    /** @return {@code "icon"}: this entry resolves as a icon field. */
    @Override
    public String kind() {
        return "icon";
    }
}
