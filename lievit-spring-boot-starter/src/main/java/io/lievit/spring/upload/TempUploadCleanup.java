/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.spring.upload;

import java.io.IOException;
import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

import org.jspecify.annotations.Nullable;

/**
 * Reaps orphaned temp uploads (issue #191): a file uploaded to the temp area but never moved to
 * permanent storage (the user abandoned the form) lingers until this deletes it. It wraps
 * {@link TempFileStorage#reapOlderThan} with a self-managed fixed-rate schedule so the cleanup does
 * not depend on Spring's {@code @EnableScheduling} (the starter cannot assume the app enabled it).
 *
 * <p>A positive interval starts a single daemon thread that reaps at that rate; a non-positive
 * interval leaves the reaper idle and on-demand ({@link #reapOnce()} still works, e.g. from a test or
 * an adopter's own scheduler). Idempotent start/stop.
 */
public final class TempUploadCleanup {

    private final TempFileStorage storage;
    private final Duration maxAge;
    private @Nullable ScheduledExecutorService scheduler;

    /**
     * @param storage the temp storage to reap
     * @param maxAge the maximum age a temp file may reach before it is deleted
     */
    public TempUploadCleanup(TempFileStorage storage, Duration maxAge) {
        this.storage = storage;
        this.maxAge = maxAge;
    }

    /**
     * Starts the background reaper at a fixed rate, or leaves it idle for a non-positive interval.
     * Idempotent: a second start with the reaper already running is a no-op.
     *
     * @param interval the reap interval; non-positive disables the background reaper
     */
    public synchronized void start(Duration interval) {
        if (scheduler != null || interval == null || interval.isZero() || interval.isNegative()) {
            return;
        }
        ScheduledExecutorService exec =
                Executors.newSingleThreadScheduledExecutor(
                        r -> {
                            Thread t = new Thread(r, "lievit-upload-cleanup");
                            t.setDaemon(true);
                            return t;
                        });
        long millis = interval.toMillis();
        exec.scheduleAtFixedRate(this::reapQuietly, millis, millis, TimeUnit.MILLISECONDS);
        this.scheduler = exec;
    }

    /** Stops the background reaper if one is running. Idempotent. */
    public synchronized void stop() {
        if (scheduler != null) {
            scheduler.shutdownNow();
            scheduler = null;
        }
    }

    /**
     * @return true if a background reaper is currently scheduled
     */
    public synchronized boolean isScheduled() {
        return scheduler != null;
    }

    /**
     * Runs one reap now, deleting temp files older than the max age.
     *
     * @return the number of files deleted
     * @throws IOException if the storage walk fails
     */
    public int reapOnce() throws IOException {
        return storage.reapOlderThan(maxAge, Instant.now());
    }

    /** A reap that swallows IO errors (the scheduled path; a transient FS error must not kill the thread). */
    private void reapQuietly() {
        try {
            reapOnce();
        } catch (IOException | RuntimeException ignored) {
            // A reap is best-effort; the next tick retries. Never let a sweep error stop the schedule.
        }
    }
}
