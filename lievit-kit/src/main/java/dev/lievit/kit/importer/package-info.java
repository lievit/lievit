/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * The CSV import subsystem (the Filament {@code ImportAction} + {@code Importer}), built on the
 * {@link dev.lievit.kit.job chunked async-job primitive}.
 *
 * <p>An adopter declares an {@link dev.lievit.kit.importer.Importer} listing its {@link
 * dev.lievit.kit.importer.ImportColumn}s (each with a header mapping, validation, casting, and an
 * optional relationship resolver) and how to persist one resolved record. An {@link
 * dev.lievit.kit.importer.ImportAction} opens a modal that uploads a CSV, maps its headers to columns,
 * enforces a max-row cap, and dispatches a {@link dev.lievit.kit.job.ChunkedJob} that validates +
 * casts + persists each row with allow-failures batching. Failed rows are captured (downloadable as
 * a CSV) and a completion notification fires.
 *
 * <p>The CSV parsing lives in {@link dev.lievit.kit.importer.CsvSource}: delimiter detection,
 * quoted-field handling, and header extraction, with no external dependency.
 */
@NullMarked
package dev.lievit.kit.importer;

import org.jspecify.annotations.NullMarked;
