/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit;

import java.util.function.Function;

/**
 * A column that renders the cell value as an image URL (the Filament {@code ImageColumn}): a
 * thumbnail, optionally circular ({@link #circular()}) for avatars, at a configurable size.
 *
 * @param <T> the row type
 */
public final class ImageColumn<T> extends Column<T> {

    private boolean circular;
    private int size = 40;

    /**
     * @param label the column header
     * @param extractor extracts the image URL from a row
     * @param <T> the row type
     * @return a new image column
     */
    public static <T> ImageColumn<T> make(String label, Function<? super T, ?> extractor) {
        return new ImageColumn<>(label, extractor);
    }

    private ImageColumn(String label, Function<? super T, ?> extractor) {
        super(label, extractor);
    }

    /**
     * Renders the image as a circle (an avatar).
     *
     * @return this column
     */
    public ImageColumn<T> circular() {
        this.circular = true;
        return this;
    }

    /**
     * Sets the rendered image size in pixels (square).
     *
     * @param px the size in pixels
     * @return this column
     */
    public ImageColumn<T> size(int px) {
        this.size = px < 1 ? 1 : px;
        return this;
    }

    /**
     * The image source URL for a row (the cell string). Named {@code src} (not {@code url}) to keep
     * it distinct from the base {@link Column#urlFor(Object) link URL}: an image column's value is
     * the {@code <img src>}, not an {@code <a href>}.
     *
     * @param row the row
     * @return the image source URL
     */
    public String src(T row) {
        return cell(row);
    }

    /** @return whether the image is rendered circular */
    public boolean isCircular() {
        return circular;
    }

    /** @return the rendered image size in pixels */
    public int size() {
        return size;
    }
}
