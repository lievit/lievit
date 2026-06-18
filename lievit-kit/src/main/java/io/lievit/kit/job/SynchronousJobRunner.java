/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit.job;

import java.util.Objects;
import java.util.UUID;
import java.util.function.Supplier;

import org.jspecify.annotations.Nullable;

/**
 * The default {@link AsyncJobRunner}: runs each job inline on the calling thread, so {@link
 * #dispatch} returns a terminal {@link JobRun}. Deterministic for tests and the right default for
 * small workloads (a few hundred rows), where spinning up async machinery buys nothing. Swap in
 * {@link ExecutorJobRunner} once a workload is large enough to run off the request thread.
 */
public final class SynchronousJobRunner implements AsyncJobRunner {

    private final JobStore store;
    private final Supplier<String> idGenerator;

    /**
     * @param store the store to persist runs to
     */
    public SynchronousJobRunner(JobStore store) {
        this(store, () -> UUID.randomUUID().toString());
    }

    /**
     * @param store the store to persist runs to
     * @param idGenerator supplies run ids (overridable for deterministic tests)
     */
    public SynchronousJobRunner(JobStore store, Supplier<String> idGenerator) {
        this.store = Objects.requireNonNull(store, "store");
        this.idGenerator = Objects.requireNonNull(idGenerator, "idGenerator");
    }

    @Override
    public JobRun dispatch(AsyncJob job, @Nullable String startedBy) {
        Objects.requireNonNull(job, "job");
        JobRun run = JobRun.create(idGenerator.get(), job.kind(), startedBy);
        store.save(run);
        AsyncJobRunner.execute(job, run, store);
        return run;
    }
}
