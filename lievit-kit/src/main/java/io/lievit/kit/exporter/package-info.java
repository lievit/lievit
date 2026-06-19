/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * The export subsystem (the Filament {@code ExportAction} / {@code ExportBulkAction} +
 * {@code Exporter} + the shared {@code CanExportRecords} concern), built on the {@link
 * io.lievit.kit.job chunked async-job primitive}.
 *
 * <p>An adopter declares an {@link io.lievit.kit.exporter.Exporter} listing its {@link
 * io.lievit.kit.exporter.ExportColumn}s (each a label + a value extractor + optional formatting). An
 * {@link io.lievit.kit.exporter.ExportAction} exports a whole query and an {@link
 * io.lievit.kit.exporter.ExportBulkAction} exports a selection; both run a {@link
 * io.lievit.kit.job.ChunkedJob} that writes rows chunk-by-chunk into the chosen {@link
 * io.lievit.kit.exporter.ExportFormat} (a configurable {@link io.lievit.kit.exporter.CsvFormat} CSV
 * dialect or the XLSX SpreadsheetML stub), then fire a completion notification carrying a download
 * per format.
 *
 * <p>Like the importer, persistence and storage of the produced file stay the adopter's; the kit
 * owns the column model, the chunked write pipeline, and the format writers.
 */
@NullMarked
package io.lievit.kit.exporter;

import org.jspecify.annotations.NullMarked;
