/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit.support;

import java.util.Locale;
import java.util.Objects;

/**
 * An OKLCH color (the lightness / chroma / hue triple Filament v4 themes are built from). The kit
 * generates shade ramps in OKLCH because it is perceptually uniform: varying only the lightness
 * across a fixed scale yields a coherent ramp from one brand color, which a linear RGB interpolation
 * cannot (the filament-support v4 {@code Color::convertToOklch} carried over).
 *
 * <p>This is a value type plus the sRGB-hex → OKLCH conversion. The conversion is the standard
 * sRGB → linear → OKLab → OKLCH pipeline (Björn Ottosson's OKLab), the same one Filament uses.
 *
 * @param lightness the OKLCH lightness {@code [0,1]}
 * @param chroma the OKLCH chroma ({@code >= 0})
 * @param hue the OKLCH hue in degrees {@code [0,360)}
 */
public record Oklch(double lightness, double chroma, double hue) {

    /** Below this chroma the color is treated as achromatic (gray): the ramp drops chroma to 0. */
    public static final double ACHROMATIC_THRESHOLD = 0.03;

    /**
     * Converts an sRGB hex color ({@code #rrggbb}, with or without the leading {@code #}) to OKLCH.
     *
     * @param hex the sRGB hex color
     * @return the color in OKLCH
     * @throws IllegalArgumentException if the hex is not a 6-digit RGB hex
     */
    public static Oklch fromHex(String hex) {
        Objects.requireNonNull(hex, "hex");
        String h = hex.startsWith("#") ? hex.substring(1) : hex;
        if (h.length() != 6) {
            throw new IllegalArgumentException("expected a 6-digit hex color, got: " + hex);
        }
        int r;
        int g;
        int b;
        try {
            r = Integer.parseInt(h.substring(0, 2), 16);
            g = Integer.parseInt(h.substring(2, 4), 16);
            b = Integer.parseInt(h.substring(4, 6), 16);
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException("not a hex color: " + hex, e);
        }

        double lr = linearize(r / 255.0);
        double lg = linearize(g / 255.0);
        double lb = linearize(b / 255.0);

        double l = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb;
        double m = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb;
        double s = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb;

        double l3 = Math.cbrt(l);
        double m3 = Math.cbrt(m);
        double s3 = Math.cbrt(s);

        double lightness = 0.2104542553 * l3 + 0.7936177850 * m3 - 0.0040720468 * s3;
        double a = 1.9779984951 * l3 - 2.4285922050 * m3 + 0.4505937099 * s3;
        double bb = 0.0259040371 * l3 + 0.7827717662 * m3 - 0.8086757660 * s3;

        double chroma = Math.sqrt(a * a + bb * bb);
        double hue = Math.toDegrees(Math.atan2(bb, a));
        if (hue < 0) {
            hue += 360;
        }
        return new Oklch(lightness, chroma, hue);
    }

    /** @return whether this color is effectively gray (chroma below {@link #ACHROMATIC_THRESHOLD}) */
    public boolean isAchromatic() {
        return chroma < ACHROMATIC_THRESHOLD;
    }

    /**
     * @return the CSS {@code oklch(L C H)} function string, with stable formatting so the emitted
     *     CSS custom properties are byte-identical for the same triple
     */
    public String css() {
        return String.format(
                Locale.ROOT, "oklch(%.4f %.4f %.3f)", lightness, chroma, hue);
    }

    private static double linearize(double channel) {
        return channel <= 0.04045 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
    }
}
