/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit.schema.infolist;

import org.jspecify.annotations.Nullable;

/**
 * An image infolist entry (the filament-infolists {@code ImageEntry} carried over): renders the
 * record's value as an image URL, with optional dimensions, a circular crop, and a fixed disk the
 * stored path resolves against. The kit carries the sizing/disk contract; the URL resolution is the
 * host's storage adapter.
 */
public final class ImageEntry extends Entry<ImageEntry> {

    private @Nullable Integer width;
    private @Nullable Integer height;
    private boolean circular;
    private @Nullable String disk;

    private ImageEntry(String name) {
        super(name);
    }

    /**
     * @param name the record attribute holding the image path/URL
     * @return a new image entry
     */
    public static ImageEntry make(String name) {
        return new ImageEntry(name);
    }

    /**
     * Sets the rendered width in pixels.
     *
     * @param width the width
     * @return this entry
     */
    public ImageEntry width(int width) {
        if (width < 1) {
            throw new IllegalArgumentException("width must be at least 1");
        }
        this.width = width;
        return this;
    }

    /**
     * @return the width in pixels, or {@code null} for the intrinsic size
     */
    public @Nullable Integer width() {
        return width;
    }

    /**
     * Sets the rendered height in pixels.
     *
     * @param height the height
     * @return this entry
     */
    public ImageEntry height(int height) {
        if (height < 1) {
            throw new IllegalArgumentException("height must be at least 1");
        }
        this.height = height;
        return this;
    }

    /**
     * @return the height in pixels, or {@code null} for the intrinsic size
     */
    public @Nullable Integer height() {
        return height;
    }

    /**
     * Sets both dimensions to render a square avatar with a circular crop.
     *
     * @param size the side length in pixels
     * @return this entry
     */
    public ImageEntry circular(int size) {
        width(size);
        height(size);
        this.circular = true;
        return this;
    }

    /**
     * @return {@code true} if rendered with a circular crop
     */
    public boolean isCircular() {
        return circular;
    }

    /**
     * Sets the storage disk the stored path resolves against.
     *
     * @param disk the disk name
     * @return this entry
     */
    public ImageEntry disk(String disk) {
        this.disk = java.util.Objects.requireNonNull(disk, "disk");
        return this;
    }

    /**
     * @return the disk name, or {@code null} (the value is treated as a full URL)
     */
    public @Nullable String disk() {
        return disk;
    }
}
