/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit.job;

import java.util.Objects;
import java.util.UUID;
import java.util.concurrent.Executor;
import java.util.function.Supplier;

import org.jspecify.annotations.Nullable;

/**
 * An {@link AsyncJobRunner} that runs each job on a supplied {@link Executor} (opt-in), so {@link
 * #dispatch} returns immediately with a PENDING/RUNNING run the caller polls for progress. The
 * adopter wires the executor: a Spring {@code TaskExecutor}, a bounded {@code ThreadPoolExecutor}, or
 * {@code Executors.newVirtualThreadPerTaskExecutor()} on Java 25. The kit stays free of a hard {@code
 * @Async} or queue dependency; this is just the bridge to whatever the adopter chose.
 */
public final class ExecutorJobRunner implements AsyncJobRunner {

    private final JobStore store;
    private final Executor executor;
    private final Supplier<String> idGenerator;

    /**
     * @param store the store to persist runs to
     * @param executor the executor jobs run on
     */
    public ExecutorJobRunner(JobStore store, Executor executor) {
        this(store, executor, () -> UUID.randomUUID().toString());
    }

    /**
     * @param store the store to persist runs to
     * @param executor the executor jobs run on
     * @param idGenerator supplies run ids (overridable for deterministic tests)
     */
    public ExecutorJobRunner(JobStore store, Executor executor, Supplier<String> idGenerator) {
        this.store = Objects.requireNonNull(store, "store");
        this.executor = Objects.requireNonNull(executor, "executor");
        this.idGenerator = Objects.requireNonNull(idGenerator, "idGenerator");
    }

    @Override
    public JobRun dispatch(AsyncJob job, @Nullable String startedBy) {
        Objects.requireNonNull(job, "job");
        JobRun run = JobRun.create(idGenerator.get(), job.kind(), startedBy);
        store.save(run);
        executor.execute(() -> AsyncJobRunner.execute(job, run, store));
        return run;
    }
}
