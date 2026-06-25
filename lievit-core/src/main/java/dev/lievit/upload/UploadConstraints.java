/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.upload;

import java.util.List;
import java.util.Locale;
import java.util.Set;

import org.jspecify.annotations.Nullable;

/**
 * The validation rules an upload must pass before it is stored (issue #159): a maximum byte size and
 * an allowed-extension set. Extension validation is by the file <em>name</em>'s extension, which is
 * not MIME-spoofable the way a client-sent {@code Content-Type} is (a client can lie about the mime
 * but the stored name's extension is what the server controls). A default size cap applies when none
 * is configured.
 *
 * @param maxBytes the maximum allowed size in bytes
 * @param allowedExtensions the lowercase extensions allowed (without the dot); empty = allow any
 */
public record UploadConstraints(long maxBytes, Set<String> allowedExtensions) {

    /** The default max size when a component does not narrow it (12 MiB, Livewire-ish default). */
    public static final long DEFAULT_MAX_BYTES = 12L * 1024 * 1024;

    /**
     * @param maxBytes the maximum allowed size in bytes (must be positive)
     * @param allowedExtensions the lowercase extensions allowed (defensively copied)
     */
    public UploadConstraints {
        if (maxBytes <= 0) {
            throw new IllegalArgumentException("maxBytes must be positive");
        }
        allowedExtensions = Set.copyOf(allowedExtensions);
    }

    /** A constraint with the default size and no extension restriction. */
    public static UploadConstraints defaults() {
        return new UploadConstraints(DEFAULT_MAX_BYTES, Set.of());
    }

    /**
     * Validates a single file against these constraints.
     *
     * @param originalName the original (client) file name, for the extension check
     * @param sizeBytes the byte size of the uploaded content
     * @return the list of violation messages (empty when the file is acceptable)
     */
    public List<String> validate(String originalName, long sizeBytes) {
        java.util.List<String> errors = new java.util.ArrayList<>();
        if (sizeBytes > maxBytes) {
            errors.add("file exceeds the maximum size of " + maxBytes + " bytes");
        }
        if (!allowedExtensions.isEmpty()) {
            String ext = extensionOf(originalName);
            if (ext == null || !allowedExtensions.contains(ext)) {
                errors.add("file extension is not allowed");
            }
        }
        return List.copyOf(errors);
    }

    /**
     * The lowercase extension of a file name (without the dot), or null if it has none.
     *
     * @param name the file name
     * @return the lowercase extension without the dot, or {@code null} when there is none
     */
    public static @Nullable String extensionOf(String name) {
        int dot = name.lastIndexOf('.');
        if (dot < 0 || dot == name.length() - 1) {
            return null;
        }
        return name.substring(dot + 1).toLowerCase(Locale.ROOT);
    }
}
