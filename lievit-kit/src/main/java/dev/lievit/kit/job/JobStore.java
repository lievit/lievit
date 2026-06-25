/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit.job;

import java.util.List;
import java.util.Optional;

import org.jspecify.annotations.Nullable;

/**
 * The persistence-agnostic store for {@link JobRun}s (the Filament {@code imports} / {@code exports}
 * tables, abstracted). The kit ships {@link InMemoryJobStore}; an adopter wires a JDBC-backed bean to
 * survive a restart. The runner persists a run on dispatch and re-{@link #save saves} it on each
 * terminal transition, so a poll for progress reads the latest snapshot.
 */
public interface JobStore {

    /**
     * Persists (inserts or updates) a run.
     *
     * @param run the run to persist
     */
    void save(JobRun run);

    /**
     * Looks up a run by id.
     *
     * @param id the run id
     * @return the run, or empty if none has that id
     */
    Optional<JobRun> findById(String id);

    /**
     * Lists the runs started by a principal, most recent first (for a "my imports" / "my exports"
     * list). Returns every run when {@code startedBy} is {@code null}.
     *
     * @param startedBy the principal id, or {@code null} for all runs
     * @return the matching runs, most recent first
     */
    List<JobRun> findByStartedBy(@Nullable String startedBy);
}
