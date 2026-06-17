/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit.support;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;

/**
 * A named color as a shade ramp ({@code 50..950}) of CSS color values, the filament-app
 * {@code Color} carried over. A color is a value type; the {@link ColorManager} holds the registry
 * of semantic names ({@code primary}, {@code danger}, …) bound to a {@code Color}.
 *
 * <p>Each shade maps a Tailwind-style shade key (50, 100, 200, …, 950) to a CSS color string. The
 * kit ships the standard Tailwind ramps; an app can register its own via the manager. The actual
 * OKLCH-from-one-hex generation is the P2 depth issue (shade-level customization); v0.1 ships the
 * fixed ramps and a constant-color convenience.
 */
public final class Color {

    /** The canonical Tailwind shade keys, in order. */
    public static final int[] SHADES = {50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950};

    private final Map<Integer, String> ramp;

    private Color(Map<Integer, String> ramp) {
        this.ramp = ramp;
    }

    /**
     * Builds a color from an explicit shade ramp.
     *
     * @param ramp a map of shade key ({@code 50..950}) to CSS color value
     * @return a color carrying the given ramp (defensively copied, iteration order preserved)
     */
    public static Color ofRamp(Map<Integer, String> ramp) {
        Objects.requireNonNull(ramp, "ramp");
        return new Color(new LinkedHashMap<>(ramp));
    }

    /**
     * @param shade the shade key ({@code 50..950})
     * @return the CSS color value for that shade
     * @throws IllegalArgumentException if no value is registered for the shade
     */
    public String shade(int shade) {
        String value = ramp.get(shade);
        if (value == null) {
            throw new IllegalArgumentException("no shade " + shade + " in this color ramp");
        }
        return value;
    }

    /**
     * @return the full shade ramp as an unmodifiable map (iteration order preserved)
     */
    public Map<Integer, String> ramp() {
        return Map.copyOf(ramp);
    }

    /**
     * @return the mid shade ({@code 500}), the value a single-color reference resolves to
     */
    public String base() {
        return shade(500);
    }
}
