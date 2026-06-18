/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit.exporter;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Objects;

import org.jspecify.annotations.Nullable;

import io.lievit.component.LievitEffects;
import io.lievit.kit.AdminNotification;
import io.lievit.kit.NotificationAction;
import io.lievit.kit.job.AsyncJobRunner;
import io.lievit.kit.job.ChunkedJob;
import io.lievit.kit.job.JobRun;

/**
 * The export action (the Filament {@code ExportAction}, sharing the {@code CanExportRecords}
 * concern): given an {@link Exporter}, a set of rows (a whole query or a selection), the selected
 * columns, and a chosen {@link ExportFormat}, it runs a {@link ChunkedJob} that writes each row into
 * a shared buffer chunk-by-chunk, assembles the document on completion, attaches it as the run's
 * {@link JobRun#resultLocation result}, and flashes a completion notification carrying a download
 * action.
 *
 * <p>{@link ExportBulkAction} is the selection-scoped sibling; both delegate here, so the chunked
 * write pipeline + format assembly live in one place (the shared concern).
 *
 * @param <T> the row type
 */
public final class ExportAction<T> {

    private final Exporter<T> exporter;
    private final AsyncJobRunner runner;
    private final DownloadSink downloads;

    private String name = "export";
    private String label = "Export";

    private ExportAction(Exporter<T> exporter, AsyncJobRunner runner, DownloadSink downloads) {
        this.exporter = Objects.requireNonNull(exporter, "exporter");
        this.runner = Objects.requireNonNull(runner, "runner");
        this.downloads = Objects.requireNonNull(downloads, "downloads");
    }

    /**
     * Builds an export action.
     *
     * @param exporter the exporter declaring columns
     * @param runner the async-job runner
     * @param downloads receives the assembled document + format and returns the download url to
     *     offer (the adopter stores the bytes; the kit owns the assembly)
     * @param <T> the row type
     * @return the export action
     */
    public static <T> ExportAction<T> of(
            Exporter<T> exporter, AsyncJobRunner runner, DownloadSink downloads) {
        return new ExportAction<>(exporter, runner, downloads);
    }

    /**
     * Sets the action name.
     *
     * @param name the name
     * @return this action
     */
    public ExportAction<T> name(String name) {
        this.name = Objects.requireNonNull(name, "name");
        return this;
    }

    /**
     * Sets the button label.
     *
     * @param label the label
     * @return this action
     */
    public ExportAction<T> label(String label) {
        this.label = Objects.requireNonNull(label, "label");
        return this;
    }

    /** @return the action name */
    public String name() {
        return name;
    }

    /** @return the button label */
    public String label() {
        return label;
    }

    /** @return the exporter */
    public Exporter<T> exporter() {
        return exporter;
    }

    /**
     * Runs an export over the given rows: a chunked job writes the header + each row's cells into a
     * shared buffer, assembles the chosen format, hands it to the download sink, and flashes a
     * completion notification carrying a download action. A selection over the max-row cap is
     * truncated to the cap (the Filament behaviour: it never blocks, it bounds).
     *
     * @param rows the rows to export (a query result or a selection's resolved records)
     * @param selectedColumns the chosen column names (empty = the exporter's default columns)
     * @param format the output format
     * @param effects the effects sink the completion notification rides
     * @param startedBy the id of the principal that started the export, or {@code null}
     * @return the dispatched job run (terminal with a synchronous runner)
     */
    public JobRun run(
            List<T> rows,
            List<String> selectedColumns,
            ExportFormat format,
            LievitEffects effects,
            @Nullable String startedBy) {
        Objects.requireNonNull(rows, "rows");
        Objects.requireNonNull(selectedColumns, "selectedColumns");
        Objects.requireNonNull(format, "format");
        Objects.requireNonNull(effects, "effects");

        List<T> bounded =
                rows.size() > exporter.maxRows() ? rows.subList(0, exporter.maxRows()) : rows;
        List<String> headers = exporter.headers(selectedColumns);
        List<List<String>> writtenRows = Collections.synchronizedList(new ArrayList<>());

        ChunkedJob<T> job =
                ChunkedJob.of(
                                "export",
                                new ArrayList<>(bounded),
                                row -> writtenRows.add(exporter.row(row, selectedColumns)))
                        .chunkSize(exporter.chunkSize())
                        .onCompletion(
                                run -> {
                                    String document;
                                    synchronized (writtenRows) {
                                        document = format.assemble(headers, new ArrayList<>(writtenRows));
                                    }
                                    String url =
                                            downloads.store(run.id(), format, document);
                                    run.resultLocation(url);
                                    notifyCompletion(run, format, url, effects);
                                });

        return runner.dispatch(job, startedBy);
    }

    private void notifyCompletion(JobRun run, ExportFormat format, String url, LievitEffects effects) {
        AdminNotification.success("Exported " + run.progress().successful() + " rows.")
                .actions(
                        NotificationAction.make("download", "Download " + format.name())
                                .url(url))
                .flashOnto(effects);
    }

    /**
     * Where the assembled export document goes (the adopter's storage); returns the download url to
     * offer. The kit owns the chunked write + format assembly and stays off the persistence floor by
     * delegating the bytes-storage here.
     */
    @FunctionalInterface
    public interface DownloadSink {

        /**
         * Stores an assembled export document and returns the url to download it from.
         *
         * @param runId the job run id (a natural file-name stem)
         * @param format the format the document is in
         * @param document the assembled document text
         * @return the download url
         */
        String store(String runId, ExportFormat format, String document);
    }
}
