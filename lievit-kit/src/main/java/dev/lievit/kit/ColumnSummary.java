/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit;

/**
 * One rendered column summary (a {@link Summarizer}'s label + folded value), the shape the table
 * footer (or a group footer) renders under a {@linkplain Column#isSummarized() summarized} column.
 *
 * @param label the summary label (e.g. {@code "Sum"})
 * @param value the rendered aggregate (e.g. {@code "1234"})
 */
public record ColumnSummary(String label, String value) {}
