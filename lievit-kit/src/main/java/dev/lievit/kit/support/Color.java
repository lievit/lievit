/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit.support;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;

/**
 * A named color as a shade ramp ({@code 50..950}) of CSS color values, the filament-app
 * {@code Color} carried over. A color is a value type; the {@link ColorManager} holds the registry
 * of semantic names ({@code primary}, {@code danger}, …) bound to a {@code Color}.
 *
 * <p>Each shade maps a Tailwind-style shade key (50, 100, 200, …, 950) to a CSS color string. The
 * kit ships the standard Tailwind ramps; an app can register its own via the manager, or
 * {@link #generate(String) generate} a full OKLCH ramp from a single brand hex.
 */
public final class Color {

    /** The canonical Tailwind shade keys, in order. */
    public static final int[] SHADES = {50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950};

    /**
     * The fixed OKLCH lightness per shade Filament v4 uses (the perceptually-even scale). A
     * generated ramp keeps the input color's chroma and hue and varies only lightness across this
     * scale, which is what makes "pass one brand hex, get a coherent ramp" work.
     */
    private static final Map<Integer, Double> LIGHTNESS = new LinkedHashMap<>();

    static {
        LIGHTNESS.put(50, 0.9772);
        LIGHTNESS.put(100, 0.9504);
        LIGHTNESS.put(200, 0.9055);
        LIGHTNESS.put(300, 0.8405);
        LIGHTNESS.put(400, 0.7535);
        LIGHTNESS.put(500, 0.6827);
        LIGHTNESS.put(600, 0.5978);
        LIGHTNESS.put(700, 0.5149);
        LIGHTNESS.put(800, 0.4461);
        LIGHTNESS.put(900, 0.3946);
        LIGHTNESS.put(950, 0.2779);
    }

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
        return java.util.Collections.unmodifiableMap(new LinkedHashMap<>(ramp));
    }

    /**
     * @return the mid shade ({@code 500}), the value a single-color reference resolves to
     */
    public String base() {
        return shade(500);
    }

    /**
     * Generates a full {@code 50..950} OKLCH ramp from a single brand hex (the filament-support v4
     * {@code Color::generatePalette}): converts the hex to OKLCH, keeps its chroma and hue, and
     * walks the fixed perceptual lightness scale across the shades. An achromatic input (a gray)
     * drops chroma to zero so the ramp stays neutral. This is the "pass a brand color, get a
     * coherent ramp" path real themes need, instead of picking from a handful of presets.
     *
     * @param hex the sRGB hex brand color ({@code #rrggbb})
     * @return a color whose shades are OKLCH CSS strings
     */
    public static Color generate(String hex) {
        Oklch source = Oklch.fromHex(hex);
        double chroma = source.isAchromatic() ? 0.0 : source.chroma();
        double hue = source.hue();
        Map<Integer, String> generated = new LinkedHashMap<>();
        for (int shade : SHADES) {
            double lightness = LIGHTNESS.get(shade);
            generated.put(shade, new Oklch(lightness, chroma, hue).css());
        }
        return new Color(generated);
    }

    /**
     * Returns a copy of this color with one shade overridden, the rest untouched (the
     * filament-support {@code overridingShades} surgery): an app rebrands shade {@code 600} of
     * {@code primary} without redefining the whole ramp.
     *
     * @param shade the shade key to override ({@code 50..950})
     * @param cssValue the CSS color value for that shade
     * @return a new color with the shade replaced; this color is unchanged
     */
    public Color withShade(int shade, String cssValue) {
        Objects.requireNonNull(cssValue, "cssValue");
        Map<Integer, String> next = new LinkedHashMap<>(ramp);
        next.put(shade, cssValue);
        return new Color(next);
    }

    /**
     * Returns a copy of this color with a shade removed (the filament-support {@code removedShades}
     * surgery), for the rare theme that intentionally drops a step.
     *
     * @param shade the shade key to drop
     * @return a new color without that shade; this color is unchanged
     */
    public Color withoutShade(int shade) {
        Map<Integer, String> next = new LinkedHashMap<>(ramp);
        next.remove(shade);
        return new Color(next);
    }
}
