/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit.exporter;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.util.List;

import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVPrinter;

/**
 * A configurable CSV dialect (the configurable face of {@link ExportFormat}): a field {@code
 * separator}, a {@code bom} flag (the UTF-8 byte-order mark every Excel reads to pick the encoding),
 * a {@code lineEnding}, and a {@code quote} (enclosure) character. RFC-4180 quoting keys off the
 * <em>configured</em> separator: a cell is quoted when it contains the separator, the quote char, a
 * CR, or an LF, and embedded quotes are doubled.
 *
 * <p>The byte-level mechanics (RFC-4180 quoting / escaping) are delegated to Apache Commons CSV's
 * {@link CSVPrinter} over {@link CSVFormat#RFC4180} (ADR-0084), so the hand-rolled quoting this
 * record used to carry is gone; this type only configures the dialect (separator / quote / line
 * ending / BOM) and feeds rows to the printer.
 *
 * <p>The Filament precedent is {@code getCsvDelimiter()} returning a single character; here the whole
 * dialect is a value object the caller passes to the export action in place of the {@link
 * ExportFormat#CSV} default. Build one with {@link #of(char, boolean, String, char)} or reach for a
 * named preset ({@link #standard()}, {@link #excelItalian()}, {@link #tabSeparated()}).
 *
 * @param separator the field separator (e.g. {@code ','}, {@code ';'}, {@code '\t'})
 * @param bom whether to prepend the UTF-8 BOM ({@code U+FEFF}) once to the whole document
 * @param lineEnding the row terminator (e.g. {@code "\r\n"} or {@code "\n"})
 * @param quote the enclosure character used by RFC-4180 quoting (e.g. {@code '"'})
 */
public record CsvFormat(char separator, boolean bom, String lineEnding, char quote)
        implements ExportFormat {

    /** The UTF-8 byte-order mark; prepended once when {@link #bom()} is set so Excel reads UTF-8. */
    public static final char UTF8_BOM = '﻿';

    /** Validates the dialect. */
    public CsvFormat {
        if (lineEnding == null || lineEnding.isEmpty()) {
            throw new IllegalArgumentException("lineEnding must be non-empty");
        }
        if (separator == quote) {
            throw new IllegalArgumentException("separator and quote must differ");
        }
    }

    /**
     * Builds a CSV dialect.
     *
     * @param separator the field separator
     * @param bom whether to prepend the UTF-8 BOM
     * @param lineEnding the row terminator
     * @param quote the enclosure character
     * @return the dialect
     */
    public static CsvFormat of(char separator, boolean bom, String lineEnding, char quote) {
        return new CsvFormat(separator, bom, lineEnding, quote);
    }

    /**
     * The standard CSV dialect, byte-identical to the pre-sealing {@code ExportFormat.CSV} enum
     * constant: comma separator, CRLF line ending, double-quote enclosure, no BOM.
     *
     * @return the standard dialect
     */
    public static CsvFormat standard() {
        return new CsvFormat(',', false, "\r\n", '"');
    }

    /**
     * The Excel-Italian / locale-CSV dialect Excel opens cleanly in {@code ;}-locale regions:
     * semicolon separator, UTF-8 BOM, CRLF, double-quote enclosure.
     *
     * @return the Excel-IT dialect
     */
    public static CsvFormat excelItalian() {
        return new CsvFormat(';', true, "\r\n", '"');
    }

    /**
     * The tab-separated dialect: a tab separator, CRLF, double-quote enclosure, no BOM.
     *
     * @return the TSV-ish dialect
     */
    public static CsvFormat tabSeparated() {
        return new CsvFormat('\t', false, "\r\n", '"');
    }

    @Override
    public String contentType() {
        return "text/csv";
    }

    @Override
    public String extension() {
        return "csv";
    }

    @Override
    public String displayName() {
        return "CSV";
    }

    @Override
    public String assemble(List<String> headers, List<List<String>> rows) {
        StringBuilder out = new StringBuilder();
        if (bom) {
            out.append(UTF8_BOM);
        }
        // Commons CSV owns the RFC-4180 quoting/escaping; this dialect only configures it.
        CSVFormat format =
                CSVFormat.RFC4180
                        .builder()
                        .setDelimiter(separator)
                        .setQuote(quote)
                        .setRecordSeparator(lineEnding)
                        .get();
        try (CSVPrinter printer = new CSVPrinter(out, format)) {
            printer.printRecord(headers);
            for (List<String> row : rows) {
                printer.printRecord(row);
            }
        } catch (IOException e) {
            // The Appendable is a StringBuilder: it never throws. Surface defensively.
            throw new UncheckedIOException(e);
        }
        return out.toString();
    }
}
