/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.spring.upload;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.time.Instant;
import java.util.stream.Stream;

import io.lievit.upload.TempFileSigner;

/**
 * Filesystem temp storage for file uploads (issue #159): stores bytes under a configurable temp root
 * by their <strong>relative</strong> path, resolves a verified relative path back to an absolute one
 * (always re-checking it stays under the root, a second traversal defense behind
 * {@link TempFileSigner}), and reaps temp files older than a TTL (the &gt;24 h cleanup).
 *
 * <p>The root is created on construction. {@link #resolve(String)} is the only way to turn a
 * relative path into an absolute one; it normalizes and asserts containment, so even a bug upstream
 * cannot escape the root.
 */
public final class TempFileStorage {

    private final Path root;

    /**
     * @param root the temp root directory (created if absent)
     */
    public TempFileStorage(Path root) {
        this.root = root.toAbsolutePath().normalize();
        try {
            Files.createDirectories(this.root);
        } catch (IOException e) {
            throw new java.io.UncheckedIOException("cannot create upload temp root", e);
        }
    }

    /**
     * Stores bytes at a relative path under the root (creating parent directories).
     *
     * @param relativePath the relative path (already validated by the signer)
     * @param bytes the file content
     * @throws IOException if the write fails
     */
    public void store(String relativePath, byte[] bytes) throws IOException {
        Path target = resolve(relativePath);
        Files.createDirectories(target.getParent());
        Files.write(target, bytes);
    }

    /**
     * Resolves a relative path to its absolute location under the root, re-asserting containment.
     *
     * @param relativePath the relative path
     * @return the absolute path under the root
     * @throws IllegalArgumentException if the resolved path escapes the root
     */
    public Path resolve(String relativePath) {
        Path resolved = root.resolve(relativePath).normalize();
        if (!resolved.startsWith(root)) {
            throw new IllegalArgumentException("resolved upload path escapes the temp root");
        }
        return resolved;
    }

    /**
     * Reaps temp files whose last-modified time is older than {@code maxAge} (the &gt;24 h cleanup,
     * issue #159). Safe to call on a schedule.
     *
     * @param maxAge the maximum age a temp file may reach before deletion
     * @param now the reference instant
     * @return the number of files deleted
     * @throws IOException if the walk fails
     */
    public int reapOlderThan(Duration maxAge, Instant now) throws IOException {
        if (!Files.exists(root)) {
            return 0;
        }
        int[] deleted = {0};
        Instant cutoff = now.minus(maxAge);
        try (Stream<Path> walk = Files.walk(root)) {
            walk.filter(Files::isRegularFile)
                    .forEach(
                            p -> {
                                try {
                                    if (Files.getLastModifiedTime(p).toInstant().isBefore(cutoff)) {
                                        Files.deleteIfExists(p);
                                        deleted[0]++;
                                    }
                                } catch (IOException ignored) {
                                    // a file that vanished mid-walk is already reaped; skip it.
                                }
                            });
        }
        return deleted[0];
    }
}
