/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit.job;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

import org.jspecify.annotations.Nullable;

/**
 * A thread-safe in-memory {@link JobStore} (the parallel of {@link
 * io.lievit.kit.InMemoryDatabaseNotificationStore}): the zero-config default so the job primitive
 * works out of the box in dev and tests. Runs are not durable across a restart; an adopter wires a
 * JDBC-backed store for production.
 */
public final class InMemoryJobStore implements JobStore {

    private final Map<String, JobRun> runs = new ConcurrentHashMap<>();

    @Override
    public void save(JobRun run) {
        runs.put(Objects.requireNonNull(run, "run").id(), run);
    }

    @Override
    public Optional<JobRun> findById(String id) {
        return Optional.ofNullable(runs.get(Objects.requireNonNull(id, "id")));
    }

    @Override
    public List<JobRun> findByStartedBy(@Nullable String startedBy) {
        List<JobRun> matches = new ArrayList<>();
        for (JobRun run : runs.values()) {
            if (startedBy == null || startedBy.equals(run.startedBy())) {
                matches.add(run);
            }
        }
        matches.sort(Comparator.comparing(JobRun::createdAt).reversed());
        return List.copyOf(matches);
    }
}
