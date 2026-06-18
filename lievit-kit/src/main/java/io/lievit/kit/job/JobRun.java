/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit.job;

import java.time.Instant;
import java.util.Objects;

import org.jspecify.annotations.Nullable;

/**
 * The persisted record of one dispatched job (the Filament {@code Import} / {@code Export} model
 * row): an id, the job kind, a {@link JobState lifecycle state}, its {@link JobProgress live
 * counters}, the optional id of the principal that started it, timestamps, and the location of the
 * produced artifact (an export file) or the failed-rows report once finished.
 *
 * <p>Mutable by design: the {@link AsyncJobRunner} flips the state and stamps the finish time as the
 * job runs, and a UI polls the same instance (or re-reads it from the {@link JobStore}) for progress.
 * The counters live on the shared {@link JobProgress} so updates are visible without re-persisting on
 * every row.
 */
public final class JobRun {

    private final String id;
    private final String kind;
    private final JobProgress progress;
    private final @Nullable String startedBy;
    private final Instant createdAt;

    private JobState state = JobState.PENDING;
    private @Nullable Instant finishedAt;
    private @Nullable String resultLocation;
    private @Nullable String failure;

    private JobRun(String id, String kind, @Nullable String startedBy, Instant createdAt) {
        this.id = Objects.requireNonNull(id, "id");
        this.kind = Objects.requireNonNull(kind, "kind");
        this.startedBy = startedBy;
        this.createdAt = Objects.requireNonNull(createdAt, "createdAt");
        this.progress = new JobProgress();
    }

    /**
     * Creates a pending job run.
     *
     * @param id the run id (stable, used by the store + the poll url)
     * @param kind the job kind (for example {@code "import"} / {@code "export"})
     * @param startedBy the id of the principal that started the job, or {@code null} if anonymous
     * @return a new pending run
     */
    public static JobRun create(String id, String kind, @Nullable String startedBy) {
        return new JobRun(id, kind, startedBy, Instant.now());
    }

    /** @return the run id */
    public String id() {
        return id;
    }

    /** @return the job kind */
    public String kind() {
        return kind;
    }

    /** @return the live progress counters */
    public JobProgress progress() {
        return progress;
    }

    /** @return the id of the principal that started the job, or {@code null} */
    public @Nullable String startedBy() {
        return startedBy;
    }

    /** @return when the run was created */
    public Instant createdAt() {
        return createdAt;
    }

    /** @return the current lifecycle state */
    public JobState state() {
        return state;
    }

    /** Marks the run RUNNING (the runner calls this when it begins). */
    public void markRunning() {
        this.state = JobState.RUNNING;
    }

    /** Marks the run COMPLETED and stamps the finish time. */
    public void markCompleted() {
        this.state = JobState.COMPLETED;
        this.finishedAt = Instant.now();
    }

    /**
     * Marks the run FAILED (the job itself threw, distinct from per-row failures) and records the
     * reason.
     *
     * @param reason the failure reason
     */
    public void markFailed(String reason) {
        this.state = JobState.FAILED;
        this.failure = Objects.requireNonNull(reason, "reason");
        this.finishedAt = Instant.now();
    }

    /** @return when the run finished, or {@code null} if it has not finished */
    public @Nullable Instant finishedAt() {
        return finishedAt;
    }

    /**
     * Records the location of the produced artifact (an export download url/path or the failed-rows
     * report), so the completion notification can offer a download.
     *
     * @param location the artifact location
     */
    public void resultLocation(String location) {
        this.resultLocation = Objects.requireNonNull(location, "location");
    }

    /** @return the produced-artifact location, or {@code null} if none */
    public @Nullable String resultLocation() {
        return resultLocation;
    }

    /** @return the job-level failure reason (when {@link #state()} is FAILED), or {@code null} */
    public @Nullable String failure() {
        return failure;
    }
}
