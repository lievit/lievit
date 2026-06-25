/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit;

import java.util.Locale;
import java.util.Objects;

/**
 * A semantic color name (the Filament {@code Color}/{@code ColorManager} seam, mapped to the Java
 * idiom). Components reference a color by its semantic role ({@code danger} for a delete button,
 * {@code success} for a saved toast) rather than a literal Tailwind class, so an adopter rebrands
 * by re-mapping the palette once instead of editing every surface.
 *
 * <p>This type is the <em>name</em>; the kit's six defaults are exposed as constants. The
 * name-to-CSS-class resolution is {@link #cssClass(String)}: it produces the {@code fi-color-*}
 * convention Filament emits ({@code fi-color-danger}), which the design-system partials and the
 * client styling key on. The full 11-shade palette and per-component slot maps are a later
 * refinement; the name-to-class seam is what unblocks the navigation badges, stats, and chart
 * coloring that consume it.
 *
 * @param name the semantic color name (lowercase)
 */
public record Color(String name) {

    /** The default primary brand color. */
    public static final Color PRIMARY = new Color("primary");
    /** A destructive / error color (delete, danger toast). */
    public static final Color DANGER = new Color("danger");
    /** An informational color. */
    public static final Color INFO = new Color("info");
    /** A success color (saved, completed). */
    public static final Color SUCCESS = new Color("success");
    /** A warning color. */
    public static final Color WARNING = new Color("warning");
    /** A neutral gray. */
    public static final Color GRAY = new Color("gray");

    /** Compact constructor: the name is required, normalized to lowercase, must not be blank. */
    public Color {
        Objects.requireNonNull(name, "name");
        if (name.isBlank()) {
            throw new IllegalArgumentException("color name must not be blank");
        }
        name = name.toLowerCase(Locale.ROOT);
    }

    /**
     * @param name a semantic color name (any string; the six constants are the defaults)
     * @return a color for that name
     */
    public static Color of(String name) {
        return new Color(name);
    }

    /**
     * @return the {@code fi-color-*} CSS class for this color (for example
     *     {@code "fi-color-danger"}), the convention the kit's styling layer keys on
     */
    public String cssClass() {
        return cssClass(name);
    }

    /**
     * @param name a semantic color name
     * @return the {@code fi-color-*} CSS class for that name
     */
    public static String cssClass(String name) {
        return "fi-color-" + Objects.requireNonNull(name, "name").toLowerCase(Locale.ROOT);
    }
}
