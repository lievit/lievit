/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit.exporter;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

import org.jspecify.annotations.Nullable;

import io.lievit.kit.RecordRepository;
import io.lievit.kit.job.JobRun;
import io.lievit.component.LievitEffects;

/**
 * The selection-scoped export (the Filament {@code ExportBulkAction}): resolve the selected ids to
 * records through the resource's repository, then delegate to a shared {@link ExportAction} so the
 * chunked write + format assembly stay in one place ({@code CanExportRecords}). An id that resolves
 * to no record is skipped.
 *
 * @param <T> the row type
 */
public final class ExportBulkAction<T> {

    private final ExportAction<T> delegate;

    private String name = "export-bulk";
    private String label = "Export selected";

    private ExportBulkAction(ExportAction<T> delegate) {
        this.delegate = Objects.requireNonNull(delegate, "delegate");
    }

    /**
     * Builds a bulk export over a shared export action.
     *
     * @param delegate the export action carrying the exporter + runner + download sink
     * @param <T> the row type
     * @return the bulk export action
     */
    public static <T> ExportBulkAction<T> of(ExportAction<T> delegate) {
        return new ExportBulkAction<>(delegate);
    }

    /**
     * Sets the action name.
     *
     * @param name the name
     * @return this action
     */
    public ExportBulkAction<T> name(String name) {
        this.name = Objects.requireNonNull(name, "name");
        return this;
    }

    /**
     * Sets the button label.
     *
     * @param label the label
     * @return this action
     */
    public ExportBulkAction<T> label(String label) {
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

    /**
     * Resolves the selected ids to records and exports them.
     *
     * @param repository the resource's data port (to resolve ids to records)
     * @param selectedIds the selected row ids
     * @param selectedColumns the chosen column names (empty = default columns)
     * @param format the output format
     * @param effects the effects sink the completion notification rides
     * @param startedBy the id of the principal that started the export, or {@code null}
     * @return the dispatched job run
     */
    public JobRun run(
            RecordRepository<T> repository,
            List<String> selectedIds,
            List<String> selectedColumns,
            ExportFormat format,
            LievitEffects effects,
            @Nullable String startedBy) {
        Objects.requireNonNull(repository, "repository");
        Objects.requireNonNull(selectedIds, "selectedIds");
        List<T> rows = new ArrayList<>();
        for (String id : selectedIds) {
            repository.findById(id).ifPresent(rows::add);
        }
        return delegate.run(rows, selectedColumns, format, effects, startedBy);
    }
}
