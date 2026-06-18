/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit.job;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.function.Consumer;
import java.util.function.Function;

import org.jspecify.annotations.Nullable;

/**
 * The workhorse {@link AsyncJob}: take a list of items, slice it into chunks of {@code chunkSize}
 * (default {@value #DEFAULT_CHUNK_SIZE}, the Filament import default), and process each item with
 * allow-failures batching (a row that throws is recorded as a {@link JobProgress.FailedRow} and the
 * job keeps going; the Filament {@code allowFailures}). On finish it runs an optional completion hook
 * with the finished {@link JobRun} (the place to fire the completion notification + attach a
 * download).
 *
 * <p>This is what {@link io.lievit.kit.importer.ImportAction} and {@link
 * io.lievit.kit.exporter.ExportAction} build on; it is also directly usable for any "process N rows
 * in the background" task.
 *
 * @param <I> the item type processed one row at a time
 */
public final class ChunkedJob<I> implements AsyncJob {

    /** The default chunk size (Filament's import default). */
    public static final int DEFAULT_CHUNK_SIZE = 100;

    private final String kind;
    private final List<I> items;
    private final Consumer<I> rowProcessor;

    private int chunkSize = DEFAULT_CHUNK_SIZE;
    private Function<I, List<String>> rowDataExtractor = item -> List.of(String.valueOf(item));
    private @Nullable Consumer<List<I>> chunkHook;
    private @Nullable Consumer<JobRun> completionHook;

    private ChunkedJob(String kind, List<I> items, Consumer<I> rowProcessor) {
        this.kind = Objects.requireNonNull(kind, "kind");
        this.items = List.copyOf(items);
        this.rowProcessor = Objects.requireNonNull(rowProcessor, "rowProcessor");
    }

    /**
     * Builds a chunked job over a list of items.
     *
     * @param kind the job kind shown on the run (for example {@code "import"})
     * @param items the items to process
     * @param rowProcessor processes one item; throwing records a per-row failure (allow-failures)
     * @param <I> the item type
     * @return the chunked job
     */
    public static <I> ChunkedJob<I> of(String kind, List<I> items, Consumer<I> rowProcessor) {
        return new ChunkedJob<>(kind, items, rowProcessor);
    }

    /**
     * Sets the chunk size (clamped to {@code >= 1}).
     *
     * @param size the rows per chunk
     * @return this job
     */
    public ChunkedJob<I> chunkSize(int size) {
        this.chunkSize = size < 1 ? 1 : size;
        return this;
    }

    /**
     * Sets how a failed item's raw cell values are captured for the failed-rows report (defaults to
     * the item's {@code toString} as a single cell). For an import this maps a row to its source
     * columns so the failed-rows CSV is re-uploadable.
     *
     * @param extractor maps an item to its raw cell values
     * @return this job
     */
    public ChunkedJob<I> rowData(Function<I, List<String>> extractor) {
        this.rowDataExtractor = Objects.requireNonNull(extractor, "extractor");
        return this;
    }

    /**
     * Runs a hook once per chunk, before its rows are processed (the place to open a per-chunk
     * resource, for example begin a buffered write for an export chunk).
     *
     * @param hook receives the chunk's items
     * @return this job
     */
    public ChunkedJob<I> onChunk(Consumer<List<I>> hook) {
        this.chunkHook = Objects.requireNonNull(hook, "hook");
        return this;
    }

    /**
     * Runs a hook once the whole job has finished, with the finished run (the place to fire the
     * completion notification and attach a download to {@link JobRun#resultLocation(String)}).
     *
     * @param hook receives the finished run
     * @return this job
     */
    public ChunkedJob<I> onCompletion(Consumer<JobRun> hook) {
        this.completionHook = Objects.requireNonNull(hook, "hook");
        return this;
    }

    /** @return the rows per chunk */
    public int chunkSize() {
        return chunkSize;
    }

    @Override
    public String kind() {
        return kind;
    }

    @Override
    public void run(JobRun run) {
        JobProgress progress = run.progress();
        progress.total(items.size());
        int rowNumber = 1; // 1-based: a header would be row 0.
        for (int from = 0; from < items.size(); from += chunkSize) {
            int to = Math.min(from + chunkSize, items.size());
            List<I> chunk = new ArrayList<>(items.subList(from, to));
            if (chunkHook != null) {
                chunkHook.accept(chunk);
            }
            for (I item : chunk) {
                try {
                    rowProcessor.accept(item);
                    progress.recordSuccess();
                } catch (RuntimeException e) {
                    progress.recordFailure(
                            rowNumber,
                            rowDataExtractor.apply(item),
                            e.getMessage() == null ? e.toString() : e.getMessage());
                }
                rowNumber++;
            }
        }
        if (completionHook != null) {
            completionHook.accept(run);
        }
    }
}
