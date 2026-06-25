/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * The chunked async-job primitive the heavyweight kit actions (import, export, bulk) build on.
 *
 * <p>It is deliberately a small, persistence- and runtime-agnostic set of ports, in the same spirit
 * as {@link dev.lievit.kit.RecordRepository}: the kit never hard-couples Spring's {@code @Async} or a
 * queue technology. A job is a {@link dev.lievit.kit.job.ChunkedJob}: split a workload into chunks,
 * process each chunk with allow-failures batching, and report progress on a {@link
 * dev.lievit.kit.job.JobRun}. The {@link dev.lievit.kit.job.AsyncJobRunner} port decides <em>where</em>
 * the work runs:
 *
 * <ul>
 *   <li>{@link dev.lievit.kit.job.SynchronousJobRunner} runs it inline (the default; deterministic for
 *       tests and fine for small workloads).
 *   <li>{@link dev.lievit.kit.job.ExecutorJobRunner} runs it on a supplied {@link
 *       java.util.concurrent.Executor} (opt-in; an adopter wires a Spring {@code TaskExecutor} or a
 *       virtual-thread executor).
 * </ul>
 *
 * <p>The runner persists each {@link dev.lievit.kit.job.JobRun} through a {@link
 * dev.lievit.kit.job.JobStore} (default {@link dev.lievit.kit.job.InMemoryJobStore}), the equivalent of
 * Filament's {@code Import} / {@code Export} model rows, so a UI can poll progress and offer the
 * failed-rows download once the job finishes.
 */
@NullMarked
package dev.lievit.kit.job;

import org.jspecify.annotations.NullMarked;
