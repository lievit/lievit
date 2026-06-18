/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit.importer;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.BiConsumer;

import org.jspecify.annotations.Nullable;

/**
 * Declares how to import rows into one resource (the Filament {@code Importer}): the {@link
 * ImportColumn}s and how to persist one resolved attribute map. An adopter builds an {@code Importer}
 * and hands it to an {@link ImportAction}; the action's job validates + casts + persists each row.
 *
 * <p>Persistence is the adopter's, kept off the kit's persistence-agnostic floor: the {@code persist}
 * callback receives the resolved attribute map (column name → cast value) and writes it however it
 * likes (through the resource's {@code RecordRepository}, a domain command, etc.). Throwing {@link
 * ImportRowException} from {@code persist} rejects that one row.
 */
public final class Importer {

    private final List<ImportColumn<?>> columns;
    private final BiConsumer<Map<String, @Nullable Object>, ImportContext> persist;

    private int maxRows = Integer.MAX_VALUE;
    private int chunkSize = io.lievit.kit.job.ChunkedJob.DEFAULT_CHUNK_SIZE;

    private Importer(
            List<ImportColumn<?>> columns,
            BiConsumer<Map<String, @Nullable Object>, ImportContext> persist) {
        this.columns = List.copyOf(columns);
        this.persist = Objects.requireNonNull(persist, "persist");
    }

    /**
     * Builds an importer.
     *
     * @param columns the import columns
     * @param persist receives one row's resolved attribute map (column name → cast value) and
     *     persists it; throwing {@link ImportRowException} rejects the row
     * @return the importer
     */
    public static Importer of(
            List<ImportColumn<?>> columns,
            BiConsumer<Map<String, @Nullable Object>, ImportContext> persist) {
        if (columns.isEmpty()) {
            throw new IllegalArgumentException("an importer needs at least one column");
        }
        return new Importer(columns, persist);
    }

    /**
     * Caps the number of data rows a single import may process (the Filament {@code maxRows}); a file
     * over the cap is rejected up front by {@link ImportAction}.
     *
     * @param max the maximum data rows
     * @return this importer
     */
    public Importer maxRows(int max) {
        this.maxRows = max < 1 ? 1 : max;
        return this;
    }

    /**
     * Sets the rows-per-chunk for the import job (default {@value
     * io.lievit.kit.job.ChunkedJob#DEFAULT_CHUNK_SIZE}).
     *
     * @param size the chunk size
     * @return this importer
     */
    public Importer chunkSize(int size) {
        this.chunkSize = size < 1 ? 1 : size;
        return this;
    }

    /** @return the import columns, in declaration order */
    public List<ImportColumn<?>> columns() {
        return columns;
    }

    /** @return the max data rows a single import may process */
    public int maxRows() {
        return maxRows;
    }

    /** @return the rows-per-chunk for the job */
    public int chunkSize() {
        return chunkSize;
    }

    /**
     * Auto-guesses the header→column mapping for a file's headers: for each column, the first file
     * header (case-insensitive, trimmed) matching one of the column's {@link ImportColumn#guesses()}.
     * The result maps file header → column name, the shape {@link CsvSource#mappedRows(Map)} wants.
     *
     * @param fileHeaders the file's header texts
     * @return the guessed file-header → column-name mapping (a column with no match is absent)
     */
    public Map<String, String> guessMapping(List<String> fileHeaders) {
        Map<String, String> mapping = new LinkedHashMap<>();
        for (ImportColumn<?> column : columns) {
            for (String header : fileHeaders) {
                boolean matches =
                        column.guesses().stream()
                                .anyMatch(g -> g.trim().equalsIgnoreCase(header.trim()));
                if (matches) {
                    mapping.put(header, column.name());
                    break;
                }
            }
        }
        return mapping;
    }

    /**
     * Resolves one mapped row (column name → raw cell) into the typed attribute map, validating and
     * casting each column. Throws {@link ImportRowException} on the first failing column.
     *
     * @param mappedRow the row keyed by column name (a missing column reads as blank)
     * @return the resolved attribute map (column name → cast value, omitting blank optionals)
     */
    public Map<String, @Nullable Object> resolveRow(Map<String, String> mappedRow) {
        Map<String, @Nullable Object> resolved = new LinkedHashMap<>();
        for (ImportColumn<?> column : columns) {
            String raw = mappedRow.getOrDefault(column.name(), "");
            Object value = column.resolve(raw);
            if (value != null) {
                resolved.put(column.name(), value);
            }
        }
        return resolved;
    }

    /**
     * Persists one resolved attribute map (delegates to the adopter's persist callback).
     *
     * @param resolved the resolved attribute map
     * @param context the import context (the starting principal)
     */
    public void persist(Map<String, @Nullable Object> resolved, ImportContext context) {
        persist.accept(resolved, context);
    }

    /**
     * The context handed to the persist step: who started the import (for ownership / tenancy /
     * audit).
     *
     * @param startedBy the id of the principal that started the import, or {@code null}
     */
    public record ImportContext(@Nullable String startedBy) {}
}
