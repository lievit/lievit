/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.spring.upload;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.time.Instant;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import io.lievit.upload.InvalidTempPathException;
import io.lievit.upload.SignedTempPath;
import io.lievit.upload.TempFileSigner;
import io.lievit.upload.TemporaryUploadedFile;

/**
 * Specifies the default local-filesystem {@link FileStore} (issue #189): it resolves a temporary
 * uploaded file's signed token to its temp bytes, moves them under a permanent root keyed by the
 * destination directory, and returns the durable relative path. A forged / expired token is refused
 * before any byte is read (the signer is the boundary). This is the "ship a default, adopter adapts"
 * implementation; an object-storage adopter implements the SPI instead.
 */
class LocalFileStoreTest {

    private final byte[] key = "a-local-file-store-key-at-least-32-bytes!".getBytes(StandardCharsets.UTF_8);
    private final TempFileSigner signer = new TempFileSigner(key, Duration.ofMinutes(30));
    private final Instant now = Instant.parse("2026-06-18T12:00:00Z");

    /**
     * @spec.given a stored temp file referenced by a valid signed token
     * @spec.when  store(file, "avatars") moves it
     * @spec.then  the bytes land under the permanent root at avatars/&lt;name&gt; and the returned
     *             path names that durable location
     */
    @Test
    void moves_a_temp_file_to_the_permanent_root(@TempDir Path tempRoot, @TempDir Path permanentRoot)
            throws IOException {
        TempFileStorage temp = new TempFileStorage(tempRoot);
        temp.store("2026/06/abc.png", "PNGBYTES".getBytes(StandardCharsets.UTF_8));
        SignedTempPath signed = signer.sign("2026/06/abc.png", now);
        TemporaryUploadedFile file =
                new TemporaryUploadedFile(signed.token(), "photo.png", 8, "image/png");
        LocalFileStore store = new LocalFileStore(temp, signer, permanentRoot);

        String stored = store.store(file, "avatars");

        assertThat(stored).isEqualTo("avatars/photo.png");
        Path landed = permanentRoot.resolve("avatars/photo.png");
        assertThat(Files.exists(landed)).isTrue();
        assertThat(Files.readString(landed)).isEqualTo("PNGBYTES");
    }

    /**
     * @spec.given a temporary uploaded file carrying a forged token
     * @spec.when  store is called
     * @spec.then  it throws before any byte is read (the signer rejects the forgery)
     */
    @Test
    void refuses_a_forged_token_before_reading_bytes(@TempDir Path tempRoot, @TempDir Path permRoot) {
        TempFileStorage temp = new TempFileStorage(tempRoot);
        LocalFileStore store = new LocalFileStore(temp, signer, permRoot);
        TemporaryUploadedFile file =
                new TemporaryUploadedFile("forged.tok.signature", "x.png", 1, "image/png");

        assertThatThrownBy(() -> store.store(file, "avatars"))
                .isInstanceOf(InvalidTempPathException.class);
    }

    /**
     * @spec.given two uploads of the same client name stored to the same destination
     * @spec.when  both are stored
     * @spec.then  the second does not clobber the first: the returned paths differ (a collision is
     *             disambiguated, so concurrent users keep their files)
     */
    @Test
    void disambiguates_a_name_collision(@TempDir Path tempRoot, @TempDir Path permRoot)
            throws IOException {
        TempFileStorage temp = new TempFileStorage(tempRoot);
        temp.store("a.png", "A".getBytes(StandardCharsets.UTF_8));
        temp.store("b.png", "B".getBytes(StandardCharsets.UTF_8));
        LocalFileStore store = new LocalFileStore(temp, signer, permRoot);
        TemporaryUploadedFile first =
                new TemporaryUploadedFile(signer.sign("a.png", now).token(), "photo.png", 1, "image/png");
        TemporaryUploadedFile second =
                new TemporaryUploadedFile(signer.sign("b.png", now).token(), "photo.png", 1, "image/png");

        String firstPath = store.store(first, "avatars");
        String secondPath = store.store(second, "avatars");

        assertThat(firstPath).isNotEqualTo(secondPath);
        assertThat(Files.readString(permRoot.resolve(firstPath))).isEqualTo("A");
        assertThat(Files.readString(permRoot.resolve(secondPath))).isEqualTo("B");
    }
}
