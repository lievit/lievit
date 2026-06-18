/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit.schema;

import java.util.regex.Pattern;

/**
 * A color picker (the filament-forms {@code ColorPicker} carried over): binds a CSS color STRING and
 * validates it against the chosen format. Defaults to hex ({@code #rrggbb}); {@link #rgb()} /
 * {@link #hsl()} switch the format.
 *
 * <p>The format rule is added ONCE in the constructor as a closure that reads {@link #format()} at
 * validation time, so switching the format after {@code make()} does not leave a stale rule behind
 * (the {@link RuleSet} is append-only by design).
 */
public final class ColorPicker extends SchemaField<String, ColorPicker> {

    /** The CSS color notation the picker stores and validates. */
    public enum Format {
        /** Hex ({@code #1d4ed8}). */
        HEX("^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$"),
        /** Functional RGB ({@code rgb(29,78,216)}). */
        RGB("^rgba?\\([^)]*\\)$"),
        /** Functional HSL ({@code hsl(221,83%,53%)}). */
        HSL("^hsla?\\([^)]*\\)$");

        private final Pattern pattern;

        Format(String pattern) {
            this.pattern = Pattern.compile(pattern);
        }

        /** @return the compiled validation pattern for this format */
        public Pattern pattern() {
            return pattern;
        }
    }

    private Format format = Format.HEX;

    private ColorPicker(String name) {
        super(name);
        rule(
                (value, ctx) -> {
                    if (value == null || String.valueOf(value).isBlank()) {
                        return null;
                    }
                    return format.pattern().matcher(String.valueOf(value)).matches()
                            ? null
                            : "Must be a valid " + format.name().toLowerCase(java.util.Locale.ROOT) + " color.";
                });
    }

    /**
     * @param name the field name and state path
     * @return a new color picker validating hex by default
     */
    public static ColorPicker make(String name) {
        return new ColorPicker(name);
    }

    /**
     * Switches the stored color format (and therefore the format validation).
     *
     * @param format the color notation
     * @return this field
     */
    public ColorPicker format(Format format) {
        this.format = java.util.Objects.requireNonNull(format, "format");
        return this;
    }

    /**
     * Convenience for {@code format(Format.RGB)}.
     *
     * @return this field, validating RGB
     */
    public ColorPicker rgb() {
        return format(Format.RGB);
    }

    /**
     * Convenience for {@code format(Format.HSL)}.
     *
     * @return this field, validating HSL
     */
    public ColorPicker hsl() {
        return format(Format.HSL);
    }

    /**
     * @return the stored color format (default {@link Format#HEX})
     */
    public Format format() {
        return format;
    }
}
