/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit.job;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Objects;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * The live counters of a {@link JobRun} (the Filament {@code Import}'s {@code total_rows} /
 * {@code processed_rows} / {@code successful_rows} columns + its {@code FailedImportRow} list, kept
 * in one mutable, thread-safe tally so the runner can update it as chunks finish and a poller can
 * read it).
 *
 * <p>"Allow failures" batching: a single failing row records a {@link FailedRow} and increments the
 * failed counter, but does not abort the job; the chunk and the job keep going. This is the Filament
 * {@code allowFailures} default for imports.
 */
public final class JobProgress {

    private final AtomicInteger total = new AtomicInteger();
    private final AtomicInteger successful = new AtomicInteger();
    private final AtomicInteger failed = new AtomicInteger();
    private final List<FailedRow> failedRows = Collections.synchronizedList(new ArrayList<>());

    /**
     * @param total the total number of rows the job expects to process (set once by {@code prepare})
     */
    public void total(int total) {
        this.total.set(Math.max(0, total));
    }

    /** Records one successfully processed row. */
    public void recordSuccess() {
        successful.incrementAndGet();
    }

    /**
     * Records one failed row, capturing the offending data and the reason for the downloadable
     * failed-rows report.
     *
     * @param rowNumber the 1-based source row number (header is row 0)
     * @param data the offending row's raw cell values
     * @param reason the human-readable failure reason
     */
    public void recordFailure(int rowNumber, List<String> data, String reason) {
        failed.incrementAndGet();
        failedRows.add(new FailedRow(rowNumber, List.copyOf(data), Objects.requireNonNull(reason, "reason")));
    }

    /** @return the total number of rows the job expects to process */
    public int total() {
        return total.get();
    }

    /** @return the number of rows processed successfully so far */
    public int successful() {
        return successful.get();
    }

    /** @return the number of rows that failed so far */
    public int failed() {
        return failed.get();
    }

    /** @return the number of rows processed (successful + failed) */
    public int processed() {
        return successful.get() + failed.get();
    }

    /** @return the captured failed rows, in failure order, as an unmodifiable snapshot */
    public List<FailedRow> failedRows() {
        synchronized (failedRows) {
            return List.copyOf(failedRows);
        }
    }

    /** @return whether at least one row failed */
    public boolean hasFailures() {
        return failed.get() > 0;
    }

    /**
     * One captured failed row, the unit of the downloadable failed-rows CSV (the Filament
     * {@code FailedImportRow}).
     *
     * @param rowNumber the 1-based source row number
     * @param data the offending row's raw cell values
     * @param reason the failure reason
     */
    public record FailedRow(int rowNumber, List<String> data, String reason) {

        /** Compact constructor: defends the data list. */
        public FailedRow {
            data = List.copyOf(data);
            Objects.requireNonNull(reason, "reason");
        }
    }
}
