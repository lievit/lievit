/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit.job;

/**
 * The lifecycle state of a {@link JobRun} (the Filament {@code Import}/{@code Export} row goes
 * pending → processing → finished; a job that throws lands {@link #FAILED}).
 */
public enum JobState {

    /** Created, not yet started. */
    PENDING,

    /** Running: chunks are being processed. */
    RUNNING,

    /** Every chunk processed (individual rows may still have failed; see {@link JobProgress}). */
    COMPLETED,

    /** The job itself threw before completing (distinct from per-row failures). */
    FAILED;

    /** @return whether the job has reached a terminal state ({@link #COMPLETED} or {@link #FAILED}) */
    public boolean isTerminal() {
        return this == COMPLETED || this == FAILED;
    }
}
