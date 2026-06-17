/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit.schema;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

import org.jspecify.annotations.Nullable;

/**
 * A file-upload field (the filament-forms {@code FileUpload} carried over): single or multiple
 * files, an accepted-MIME-type allowlist, a max size, and an image-only flag. The field binds the
 * stored file reference(s) (a token/path the host's storage adapter resolves); the actual transfer
 * and storage are the host's, the field carries the constraints and the binding.
 */
public final class FileUpload extends SchemaField<List<String>, FileUpload> {

    private final List<String> acceptedMimeTypes = new ArrayList<>();
    private boolean multiple;
    private boolean image;
    private @Nullable Long maxSizeKb;

    private FileUpload(String name) {
        super(name);
        cast(CheckboxList.multiValueCast());
    }

    /**
     * @param name the field name and state path
     * @return a new file-upload field
     */
    public static FileUpload make(String name) {
        return new FileUpload(name);
    }

    /**
     * Allows uploading multiple files.
     *
     * @return this field
     */
    public FileUpload multiple() {
        this.multiple = true;
        return this;
    }

    /**
     * @return {@code true} if multiple files may be uploaded
     */
    public boolean isMultiple() {
        return multiple;
    }

    /**
     * Restricts uploads to images and shows an image preview.
     *
     * @return this field
     */
    public FileUpload image() {
        this.image = true;
        return this;
    }

    /**
     * @return {@code true} if restricted to images
     */
    public boolean isImage() {
        return image;
    }

    /**
     * Sets the accepted MIME-type allowlist.
     *
     * @param mimeTypes the accepted MIME types ({@code "application/pdf"}, {@code "image/png"})
     * @return this field
     */
    public FileUpload acceptedFileTypes(List<String> mimeTypes) {
        acceptedMimeTypes.addAll(Objects.requireNonNull(mimeTypes, "mimeTypes"));
        return this;
    }

    /**
     * @return the accepted MIME types (unmodifiable; empty means any)
     */
    public List<String> acceptedFileTypes() {
        return List.copyOf(acceptedMimeTypes);
    }

    /**
     * Sets the per-file maximum size in kilobytes.
     *
     * @param maxSizeKb the maximum size in KB
     * @return this field
     */
    public FileUpload maxSize(long maxSizeKb) {
        if (maxSizeKb < 1) {
            throw new IllegalArgumentException("maxSize must be at least 1 KB");
        }
        this.maxSizeKb = maxSizeKb;
        return this;
    }

    /**
     * @return the per-file max size in KB, or {@code null} if unbounded
     */
    public @Nullable Long maxSizeKb() {
        return maxSizeKb;
    }
}
