/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit.schema.infolist;

/**
 * A color-swatch infolist entry (the filament-infolists {@code ColorEntry} carried over): renders
 * the record's stored CSS color value as a swatch, the read-only mirror of a
 * {@link io.lievit.kit.schema.ColorPicker}. The stored value is the CSS color string itself
 * ({@code #1d4ed8}); {@code copyable} adds a click-to-copy affordance on the value.
 */
public final class ColorEntry extends Entry<ColorEntry> {

    private boolean copyable;

    private ColorEntry(String name) {
        super(name);
    }

    /**
     * @param name the record attribute holding the CSS color value
     * @return a new color entry
     */
    public static ColorEntry make(String name) {
        return new ColorEntry(name);
    }

    /**
     * Adds a click-to-copy affordance on the color value.
     *
     * @return this entry
     */
    public ColorEntry copyable() {
        this.copyable = true;
        return this;
    }

    /**
     * @return {@code true} if the color value is copyable
     */
    public boolean isCopyable() {
        return copyable;
    }

    /** @return {@code "color"}: this entry resolves as a color field. */
    @Override
    public String kind() {
        return "color";
    }
}
