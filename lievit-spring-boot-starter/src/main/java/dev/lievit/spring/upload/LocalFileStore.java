/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.spring.upload;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.time.Instant;
import java.util.function.Supplier;

import dev.lievit.upload.FileStore;
import dev.lievit.upload.TempFileSigner;
import dev.lievit.upload.TemporaryUploadedFile;
import dev.lievit.upload.UploadConstraints;

/**
 * The default local-filesystem {@link FileStore} (issue #189, the "ship a default, adopter adapts"
 * implementation): it resolves a {@link TemporaryUploadedFile}'s signed token back to the temp bytes
 * (the {@link TempFileSigner} is the boundary, rejecting a forged / expired / traversal token before
 * any read), then moves those bytes under a permanent root keyed by the destination directory and
 * returns the durable relative path. An adopter that stores to object storage (GCS / S3) or a CDN
 * implements {@link FileStore} instead and registers it as a bean.
 *
 * <p>A name collision under the same destination is disambiguated with a short random prefix, so two
 * users uploading {@code photo.png} to {@code avatars} do not clobber each other. Containment is
 * re-asserted on the permanent side: a resolved path that escapes the root throws.
 */
public final class LocalFileStore implements FileStore {

    private final TempFileStorage temp;
    private final TempFileSigner signer;
    private final Path permanentRoot;
    private final Supplier<Instant> clock;

    /**
     * @param temp the temp storage holding the uploaded bytes
     * @param signer the signer that verifies a temp token before its bytes are read
     * @param permanentRoot the root directory permanent files land under (created if absent)
     */
    public LocalFileStore(TempFileStorage temp, TempFileSigner signer, Path permanentRoot) {
        this(temp, signer, permanentRoot, Instant::now);
    }

    /**
     * Clock-injectable constructor: the token-expiry check verifies against {@code clock} instead of
     * the system clock, so a test can sign and verify at one fixed instant (the production overload
     * passes {@code Instant::now}). Without this seam a fixed-timestamp test only passes inside the
     * token's TTL window of the day it was written.
     *
     * @param temp the temp storage holding the uploaded bytes
     * @param signer the signer that verifies a temp token before its bytes are read
     * @param permanentRoot the root directory permanent files land under (created if absent)
     * @param clock supplies the instant the token expiry is checked against
     */
    public LocalFileStore(
            TempFileStorage temp, TempFileSigner signer, Path permanentRoot, Supplier<Instant> clock) {
        this.temp = temp;
        this.signer = signer;
        this.permanentRoot = permanentRoot.toAbsolutePath().normalize();
        this.clock = clock;
        try {
            Files.createDirectories(this.permanentRoot);
        } catch (IOException e) {
            throw new UncheckedIOException("cannot create the permanent upload root", e);
        }
    }

    @Override
    public String store(TemporaryUploadedFile file, String destinationDirectory) {
        // The signer verifies (and rejects a forged / expired / traversal token) before any read.
        String relativeTemp = signer.verify(file.token(), clock.get());
        Path source = temp.resolve(relativeTemp);

        String storedRelative = uniqueRelative(destinationDirectory, file.clientName());
        Path target = resolvePermanent(storedRelative);
        try {
            Files.createDirectories(target.getParent());
            Files.move(source, target, StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException e) {
            throw new UncheckedIOException("failed to move the upload to permanent storage", e);
        }
        return storedRelative;
    }

    /**
     * A collision-free relative path under the destination: the client name, prefixed with a short
     * random token when a file of that name already exists at the destination.
     */
    private String uniqueRelative(String destinationDirectory, String clientName) {
        String safeName = clientName.replace('/', '_').replace('\\', '_');
        String base = destinationDirectory + "/" + safeName;
        if (!Files.exists(resolvePermanent(base))) {
            return base;
        }
        String ext = UploadConstraints.extensionOf(safeName);
        String stem = ext == null ? safeName : safeName.substring(0, safeName.length() - ext.length() - 1);
        String token = Long.toHexString(System.nanoTime());
        return destinationDirectory + "/" + stem + "-" + token + (ext == null ? "" : "." + ext);
    }

    /** Resolves a relative permanent path, re-asserting it stays under the permanent root. */
    private Path resolvePermanent(String relativePath) {
        Path resolved = permanentRoot.resolve(relativePath).normalize();
        if (!resolved.startsWith(permanentRoot)) {
            throw new IllegalArgumentException("the stored path escapes the permanent root");
        }
        return resolved;
    }
}
