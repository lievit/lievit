/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit.job;

/**
 * A unit of background work the {@link AsyncJobRunner} executes (the Filament queued job, reduced to
 * its essence). The runner owns the {@link JobRun} lifecycle (running → completed/failed) and hands
 * the run to {@link #run(JobRun)} so the job can update {@link JobRun#progress()} as it goes.
 *
 * <p>Most callers do not implement this directly: they build a {@link ChunkedJob}, which splits a
 * workload into chunks and processes each with allow-failures batching. This interface is the seam a
 * bespoke job (one that is not a simple row iteration) plugs into.
 */
@FunctionalInterface
public interface AsyncJob {

    /**
     * The job kind, surfaced on the {@link JobRun} (default {@code "job"}). Override for a meaningful
     * label such as {@code "import"} or {@code "export"}.
     *
     * @return the job kind
     */
    default String kind() {
        return "job";
    }

    /**
     * Runs the work. The runner has already marked the run RUNNING; an exception thrown here is
     * caught by the runner and recorded as a job-level failure ({@link JobRun#markFailed(String)}).
     * Per-row failures should instead be recorded on {@link JobRun#progress()} and not thrown, so the
     * job continues (allow-failures).
     *
     * @param run the job run to report progress on
     * @throws Exception on a job-level failure
     */
    void run(JobRun run) throws Exception;
}
