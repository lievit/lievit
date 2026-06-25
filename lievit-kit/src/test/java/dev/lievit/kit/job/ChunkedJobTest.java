/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit.job;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Executor;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;

import org.junit.jupiter.api.Test;

/**
 * Specifies the chunked async-job primitive: chunked iteration over a workload, allow-failures
 * batching (a throwing row is captured, the job keeps going), the synchronous and executor runners,
 * the run lifecycle, the store, and the completion hook.
 */
class ChunkedJobTest {

    /**
     * @spec.given a chunked job over five items with a chunk size of two
     * @spec.when  it runs synchronously
     * @spec.then  every item is processed and the chunk hook fires once per chunk (3 chunks)
     */
    @Test
    void processes_every_item_in_chunks() {
        List<Integer> processed = new ArrayList<>();
        List<Integer> chunkSizes = new ArrayList<>();
        ChunkedJob<Integer> job =
                ChunkedJob.of("test", List.of(1, 2, 3, 4, 5), processed::add)
                        .chunkSize(2)
                        .onChunk(chunk -> chunkSizes.add(chunk.size()));

        JobRun run = new SynchronousJobRunner(new InMemoryJobStore()).dispatch(job);

        assertThat(processed).containsExactly(1, 2, 3, 4, 5);
        assertThat(chunkSizes).containsExactly(2, 2, 1);
        assertThat(run.state()).isEqualTo(JobState.COMPLETED);
        assertThat(run.progress().successful()).isEqualTo(5);
        assertThat(run.progress().total()).isEqualTo(5);
    }

    /**
     * @spec.given a chunked job where one row throws
     * @spec.when  it runs
     * @spec.then  the failure is captured with its row number and reason, and the job still completes
     *     (allow-failures): the other rows succeed
     */
    @Test
    void allow_failures_captures_a_throwing_row_and_continues() {
        ChunkedJob<Integer> job =
                ChunkedJob.of(
                                "test",
                                List.of(1, 2, 3),
                                n -> {
                                    if (n == 2) {
                                        throw new IllegalArgumentException("row two is bad");
                                    }
                                })
                        .rowData(n -> List.of("value-" + n));

        JobRun run = new SynchronousJobRunner(new InMemoryJobStore()).dispatch(job);

        assertThat(run.state()).isEqualTo(JobState.COMPLETED);
        assertThat(run.progress().successful()).isEqualTo(2);
        assertThat(run.progress().failed()).isEqualTo(1);
        assertThat(run.progress().failedRows()).singleElement().satisfies(
                f -> {
                    assertThat(f.rowNumber()).isEqualTo(2);
                    assertThat(f.data()).containsExactly("value-2");
                    assertThat(f.reason()).isEqualTo("row two is bad");
                });
    }

    /**
     * @spec.given a job that throws at the job level (not a per-row failure)
     * @spec.when  it runs
     * @spec.then  the run is marked FAILED with the reason, not COMPLETED
     */
    @Test
    void a_job_level_exception_marks_the_run_failed() {
        AsyncJob exploding =
                run -> {
                    throw new IllegalStateException("store offline");
                };

        JobRun run = new SynchronousJobRunner(new InMemoryJobStore()).dispatch(exploding);

        assertThat(run.state()).isEqualTo(JobState.FAILED);
        assertThat(run.failure()).isEqualTo("store offline");
    }

    /**
     * @spec.given the synchronous runner and a store
     * @spec.when  a job is dispatched with a starting principal
     * @spec.then  the run is persisted, terminal on return, and findable by its starter
     */
    @Test
    void the_runner_persists_the_run_and_records_the_starter() {
        InMemoryJobStore store = new InMemoryJobStore();
        ChunkedJob<Integer> job = ChunkedJob.of("import", List.of(1, 2), n -> {});

        JobRun run = new SynchronousJobRunner(store).dispatch(job, "alice");

        assertThat(store.findById(run.id())).contains(run);
        assertThat(store.findByStartedBy("alice")).containsExactly(run);
        assertThat(store.findByStartedBy(null)).contains(run);
        assertThat(run.kind()).isEqualTo("import");
        assertThat(run.startedBy()).isEqualTo("alice");
    }

    /**
     * @spec.given the executor runner backed by a single-thread executor
     * @spec.when  a job is dispatched and the executor drains
     * @spec.then  the job runs off the calling thread and reaches COMPLETED
     */
    @Test
    void the_executor_runner_runs_the_job_on_the_executor() throws Exception {
        InMemoryJobStore store = new InMemoryJobStore();
        var pool = Executors.newSingleThreadExecutor();
        AtomicInteger seen = new AtomicInteger();
        ChunkedJob<Integer> job = ChunkedJob.of("test", List.of(1, 2, 3), n -> seen.incrementAndGet());

        JobRun run = new ExecutorJobRunner(store, (Executor) pool).dispatch(job);
        pool.shutdown();
        assertThat(pool.awaitTermination(5, java.util.concurrent.TimeUnit.SECONDS)).isTrue();

        assertThat(seen.get()).isEqualTo(3);
        assertThat(store.findById(run.id())).get().extracting(JobRun::state).isEqualTo(JobState.COMPLETED);
    }

    /**
     * @spec.given a chunked job with a completion hook
     * @spec.when  the job finishes
     * @spec.then  the hook runs once with the finished run, which can carry a result location
     */
    @Test
    void the_completion_hook_runs_once_with_the_finished_run() {
        List<String> locations = new ArrayList<>();
        ChunkedJob<Integer> job =
                ChunkedJob.of("export", List.of(1, 2), n -> {})
                        .onCompletion(
                                run -> {
                                    run.resultLocation("/downloads/export-" + run.id() + ".csv");
                                    locations.add(run.resultLocation());
                                });

        JobRun run = new SynchronousJobRunner(new InMemoryJobStore(), () -> "fixed-id").dispatch(job);

        assertThat(locations).containsExactly("/downloads/export-fixed-id.csv");
        assertThat(run.resultLocation()).isEqualTo("/downloads/export-fixed-id.csv");
    }
}
