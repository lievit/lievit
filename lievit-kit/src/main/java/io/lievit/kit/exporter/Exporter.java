/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit.exporter;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

/**
 * Declares how to export rows of one resource (the Filament {@code Exporter}): the {@link
 * ExportColumn}s and, optionally, a max-row cap. An adopter builds an {@code Exporter} and hands it
 * to an {@link ExportAction} (whole query) or an {@link ExportBulkAction} (a selection).
 *
 * @param <T> the row type
 */
public final class Exporter<T> {

    private final List<ExportColumn<T>> columns;

    private int maxRows = Integer.MAX_VALUE;
    private int chunkSize = io.lievit.kit.job.ChunkedJob.DEFAULT_CHUNK_SIZE;

    private Exporter(List<ExportColumn<T>> columns) {
        this.columns = List.copyOf(columns);
    }

    /**
     * Builds an exporter.
     *
     * @param columns the export columns
     * @param <T> the row type
     * @return the exporter
     */
    @SafeVarargs
    public static <T> Exporter<T> of(ExportColumn<T>... columns) {
        if (columns.length == 0) {
            throw new IllegalArgumentException("an exporter needs at least one column");
        }
        return new Exporter<>(List.of(columns));
    }

    /**
     * Caps the number of rows a single export may write (the Filament {@code maxRows}).
     *
     * @param max the maximum rows
     * @return this exporter
     */
    public Exporter<T> maxRows(int max) {
        this.maxRows = max < 1 ? 1 : max;
        return this;
    }

    /**
     * Sets the rows-per-chunk for the export job.
     *
     * @param size the chunk size
     * @return this exporter
     */
    public Exporter<T> chunkSize(int size) {
        this.chunkSize = size < 1 ? 1 : size;
        return this;
    }

    /** @return the export columns, in declaration order */
    public List<ExportColumn<T>> columns() {
        return columns;
    }

    /** @return the column names enabled by default (the modal pre-selects these) */
    public List<String> defaultColumnNames() {
        List<String> names = new ArrayList<>();
        for (ExportColumn<T> column : columns) {
            if (column.isEnabledByDefault()) {
                names.add(column.name());
            }
        }
        return names;
    }

    /** @return the max rows a single export may write */
    public int maxRows() {
        return maxRows;
    }

    /** @return the rows-per-chunk for the job */
    public int chunkSize() {
        return chunkSize;
    }

    /**
     * The header cells for the selected columns, in selection order.
     *
     * @param selectedColumns the chosen column names (empty = all default columns)
     * @return the header labels
     */
    public List<String> headers(List<String> selectedColumns) {
        List<String> headers = new ArrayList<>();
        for (ExportColumn<T> column : selected(selectedColumns)) {
            headers.add(column.label());
        }
        return headers;
    }

    /**
     * The exported cells of one row, for the selected columns, in selection order.
     *
     * @param row the row
     * @param selectedColumns the chosen column names (empty = all default columns)
     * @return the row's cells
     */
    public List<String> row(T row, List<String> selectedColumns) {
        List<String> cells = new ArrayList<>();
        for (ExportColumn<T> column : selected(selectedColumns)) {
            cells.add(column.cell(row));
        }
        return cells;
    }

    private List<ExportColumn<T>> selected(List<String> selectedColumns) {
        Objects.requireNonNull(selectedColumns, "selectedColumns");
        if (selectedColumns.isEmpty()) {
            List<String> defaults = defaultColumnNames();
            return columns.stream().filter(c -> defaults.contains(c.name())).toList();
        }
        // Preserve the caller's selection order, ignoring unknown names.
        List<ExportColumn<T>> chosen = new ArrayList<>();
        for (String name : selectedColumns) {
            columns.stream().filter(c -> c.name().equals(name)).findFirst().ifPresent(chosen::add);
        }
        return chosen;
    }
}
