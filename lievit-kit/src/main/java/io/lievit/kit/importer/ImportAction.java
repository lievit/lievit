/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit.importer;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

import org.jspecify.annotations.Nullable;

import io.lievit.kit.AdminNotification;
import io.lievit.kit.job.AsyncJobRunner;
import io.lievit.kit.job.ChunkedJob;
import io.lievit.kit.job.JobRun;
import io.lievit.component.LievitEffects;

/**
 * The CSV import action (the Filament {@code ImportAction}): given an uploaded CSV and a
 * header→column mapping, it enforces the {@link Importer#maxRows() max-row cap}, builds a {@link
 * ChunkedJob} that resolves (validate + cast) and persists each mapped row with allow-failures
 * batching, dispatches it through the {@link AsyncJobRunner}, captures failed rows for a downloadable
 * report, and flashes a completion notification.
 *
 * <p>It is not an {@code AdminAction} subclass because it is keyed off an uploaded file + a mapping
 * rather than a record id / form binder; it is its own first-class action the import-modal page
 * invokes. Persistence stays the adopter's (the {@link Importer}'s persist callback); the action
 * owns the parse → cap → chunk → dispatch → report orchestration.
 */
public final class ImportAction {

    private final Importer importer;
    private final AsyncJobRunner runner;

    private String name = "import";
    private String label = "Import";

    private ImportAction(Importer importer, AsyncJobRunner runner) {
        this.importer = Objects.requireNonNull(importer, "importer");
        this.runner = Objects.requireNonNull(runner, "runner");
    }

    /**
     * Builds an import action over an importer, dispatching through a runner.
     *
     * @param importer the importer declaring columns + persistence
     * @param runner the async-job runner (synchronous by default; an executor for large files)
     * @return the import action
     */
    public static ImportAction of(Importer importer, AsyncJobRunner runner) {
        return new ImportAction(importer, runner);
    }

    /**
     * Sets the action name (the stable handle the modal page wires).
     *
     * @param name the name
     * @return this action
     */
    public ImportAction name(String name) {
        this.name = Objects.requireNonNull(name, "name");
        return this;
    }

    /**
     * Sets the button label.
     *
     * @param label the label
     * @return this action
     */
    public ImportAction label(String label) {
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

    /** @return the importer */
    public Importer importer() {
        return importer;
    }

    /**
     * Parses the uploaded CSV's headers so the modal can offer a header→column mapping. The returned
     * guess is the auto-mapping the modal pre-selects (the user can override).
     *
     * @param csv the uploaded CSV content
     * @return the parsed headers + the guessed file-header → column-name mapping
     */
    public MappingProposal proposeMapping(String csv) {
        CsvSource source = CsvSource.parse(csv);
        return new MappingProposal(source.headers(), importer.guessMapping(source.headers()));
    }

    /**
     * Runs the import: parse, enforce the max-row cap, dispatch a chunked job that resolves + persists
     * each row (allow-failures), and flash a completion notification with the success/failure counts.
     * A file over the cap is rejected up front with a danger notification and no job is dispatched.
     *
     * @param csv the uploaded CSV content
     * @param headerToColumn the file-header → column-name mapping (empty to use the file headers
     *     verbatim, e.g. when they already equal the column names)
     * @param effects the effects sink the notification rides
     * @param startedBy the id of the principal that started the import, or {@code null}
     * @return the dispatched job run (terminal with a synchronous runner), or empty if rejected over
     *     the cap
     */
    public java.util.Optional<JobRun> run(
            String csv,
            Map<String, String> headerToColumn,
            LievitEffects effects,
            @Nullable String startedBy) {
        Objects.requireNonNull(csv, "csv");
        Objects.requireNonNull(headerToColumn, "headerToColumn");
        Objects.requireNonNull(effects, "effects");

        CsvSource source = CsvSource.parse(csv);
        if (source.rowCount() > importer.maxRows()) {
            AdminNotification.danger(
                            "This file has "
                                    + source.rowCount()
                                    + " rows; the limit is "
                                    + importer.maxRows()
                                    + ".")
                    .flashOnto(effects);
            return java.util.Optional.empty();
        }

        List<Map<String, String>> rows = source.mappedRows(headerToColumn);
        Importer.ImportContext importContext = new Importer.ImportContext(startedBy);

        ChunkedJob<Map<String, String>> job =
                ChunkedJob.of(
                                "import",
                                rows,
                                row -> importer.persist(importer.resolveRow(row), importContext))
                        .chunkSize(importer.chunkSize())
                        .rowData(this::rowCells)
                        .onCompletion(run -> notifyCompletion(run, effects));

        return java.util.Optional.of(runner.dispatch(job, startedBy));
    }

    private List<String> rowCells(Map<String, String> row) {
        return List.copyOf(row.values());
    }

    private void notifyCompletion(JobRun run, LievitEffects effects) {
        int ok = run.progress().successful();
        int failed = run.progress().failed();
        if (failed == 0) {
            AdminNotification.success("Imported " + ok + " rows.").flashOnto(effects);
        } else {
            AdminNotification.warning(
                            "Imported " + ok + " rows; " + failed + " failed. Download the failed-rows report.")
                    .flashOnto(effects);
        }
    }

    /**
     * Builds the downloadable failed-rows CSV for a finished import run: the original header row
     * (column names) plus an appended {@code error} column, and one line per captured failed row.
     *
     * @param run the finished import run
     * @return the failed-rows CSV (empty header-only document when there were no failures)
     */
    public String failedRowsCsv(JobRun run) {
        Objects.requireNonNull(run, "run");
        StringBuilder out = new StringBuilder();
        List<String> headerNames = new java.util.ArrayList<>();
        for (ImportColumn<?> column : importer.columns()) {
            headerNames.add(column.name());
        }
        headerNames.add("error");
        out.append(csvLine(headerNames)).append('\n');
        for (var failed : run.progress().failedRows()) {
            List<String> cells = new java.util.ArrayList<>(failed.data());
            cells.add(failed.reason());
            out.append(csvLine(cells)).append('\n');
        }
        return out.toString();
    }

    private static String csvLine(List<String> cells) {
        StringBuilder line = new StringBuilder();
        for (int i = 0; i < cells.size(); i++) {
            if (i > 0) {
                line.append(',');
            }
            line.append(escape(cells.get(i)));
        }
        return line.toString();
    }

    private static String escape(String cell) {
        if (cell.contains(",") || cell.contains("\"") || cell.contains("\n") || cell.contains("\r")) {
            return '"' + cell.replace("\"", "\"\"") + '"';
        }
        return cell;
    }

    /**
     * The headers of an uploaded file and the auto-guessed mapping the modal pre-selects.
     *
     * @param fileHeaders the file's header texts, in order
     * @param guessedMapping the file-header → column-name mapping the importer guessed
     */
    public record MappingProposal(List<String> fileHeaders, Map<String, String> guessedMapping) {

        /** Compact constructor: defends the collections. */
        public MappingProposal {
            fileHeaders = List.copyOf(fileHeaders);
            guessedMapping = Map.copyOf(new LinkedHashMap<>(guessedMapping));
        }
    }
}
