/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit.job;

import org.jspecify.annotations.Nullable;

/**
 * The port that decides <em>where</em> a job runs (the Filament dispatch boundary, made an explicit
 * seam so the kit never hard-couples Spring's {@code @Async} or a queue). Two implementations ship:
 * {@link SynchronousJobRunner} (inline; the default) and {@link ExecutorJobRunner} (on a supplied
 * {@link java.util.concurrent.Executor}; opt-in).
 *
 * <p>Both share the lifecycle: persist a {@link JobRun} as PENDING, mark it RUNNING, invoke {@link
 * AsyncJob#run(JobRun)}, and on return mark it COMPLETED (or FAILED on a thrown exception), saving on
 * each terminal transition. The job records per-row outcomes on {@link JobRun#progress()} as it goes.
 */
public interface AsyncJobRunner {

    /**
     * Dispatches a job: creates and persists its {@link JobRun}, then runs it (where and when is the
     * implementation's choice). The returned run lets the caller show or poll progress; with a
     * synchronous runner it is already terminal on return, with an executor runner it may still be
     * RUNNING.
     *
     * @param job the job to dispatch
     * @param startedBy the id of the principal that started it, or {@code null} if anonymous
     * @return the job run (PENDING/RUNNING/terminal depending on the implementation)
     */
    JobRun dispatch(AsyncJob job, @Nullable String startedBy);

    /**
     * Dispatches an anonymous job.
     *
     * @param job the job
     * @return the job run
     */
    default JobRun dispatch(AsyncJob job) {
        return dispatch(job, null);
    }

    /**
     * Runs a job through the shared lifecycle against an already-created run: mark RUNNING, run,
     * mark COMPLETED/FAILED, persisting on each terminal transition. Implementations call this from
     * whatever thread they execute on.
     *
     * @param job the job
     * @param run the run to drive (created PENDING)
     * @param store the store to persist transitions to
     */
    static void execute(AsyncJob job, JobRun run, JobStore store) {
        run.markRunning();
        store.save(run);
        try {
            job.run(run);
            run.markCompleted();
        } catch (Exception e) {
            run.markFailed(e.getMessage() == null ? e.toString() : e.getMessage());
        }
        store.save(run);
    }
}
