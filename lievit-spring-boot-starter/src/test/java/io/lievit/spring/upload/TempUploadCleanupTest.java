/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.spring.upload;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.FileTime;
import java.time.Duration;
import java.time.Instant;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

/**
 * Specifies the temp-upload cleanup reaper (issue #191): an orphaned temp upload (uploaded but never
 * stored) older than the max age is deleted, a fresh one is kept, and a non-positive interval leaves
 * the reaper idle (no daemon thread) so an adopter can disable the background sweep.
 */
class TempUploadCleanupTest {

    /**
     * @spec.given a temp file aged past the max age and a fresh one
     * @spec.when  the reaper runs once on demand
     * @spec.then  the stale file is deleted and the fresh one is kept
     */
    @Test
    void reaps_only_the_orphaned_files(@TempDir Path tempRoot) throws IOException {
        TempFileStorage storage = new TempFileStorage(tempRoot);
        storage.store("old.png", "OLD".getBytes(StandardCharsets.UTF_8));
        storage.store("new.png", "NEW".getBytes(StandardCharsets.UTF_8));
        Path old = storage.resolve("old.png");
        Files.setLastModifiedTime(old, FileTime.from(Instant.now().minus(Duration.ofHours(48))));
        TempUploadCleanup cleanup = new TempUploadCleanup(storage, Duration.ofHours(24));

        int deleted = cleanup.reapOnce();

        assertThat(deleted).isEqualTo(1);
        assertThat(Files.exists(old)).isFalse();
        assertThat(Files.exists(storage.resolve("new.png"))).isTrue();
    }

    /**
     * @spec.given a cleanup reaper started with a non-positive interval
     * @spec.when  it is started
     * @spec.then  no background reaper is scheduled (it is disabled, on-demand only)
     */
    @Test
    void a_non_positive_interval_disables_the_background_reaper(@TempDir Path tempRoot) {
        TempFileStorage storage = new TempFileStorage(tempRoot);
        TempUploadCleanup cleanup = new TempUploadCleanup(storage, Duration.ofHours(24));

        cleanup.start(Duration.ZERO);

        assertThat(cleanup.isScheduled()).isFalse();
        cleanup.stop();
    }

    /**
     * @spec.given a cleanup reaper started with a positive interval
     * @spec.when  it is started then stopped
     * @spec.then  it scheduled a background reaper while running and reports it
     */
    @Test
    void a_positive_interval_schedules_a_background_reaper(@TempDir Path tempRoot) {
        TempFileStorage storage = new TempFileStorage(tempRoot);
        TempUploadCleanup cleanup = new TempUploadCleanup(storage, Duration.ofHours(24));

        cleanup.start(Duration.ofHours(1));

        assertThat(cleanup.isScheduled()).isTrue();
        cleanup.stop();
        assertThat(cleanup.isScheduled()).isFalse();
    }
}
