/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit.exporter;

import java.util.List;

/**
 * A configurable CSV dialect (the configurable face of {@link ExportFormat}): a field {@code
 * separator}, a {@code bom} flag (the UTF-8 byte-order mark every Excel reads to pick the encoding),
 * a {@code lineEnding}, and a {@code quote} (enclosure) character. RFC-4180 quoting keys off the
 * <em>configured</em> separator: a cell is quoted when it contains the separator, the quote char, a
 * CR, or an LF, and embedded quotes are doubled.
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
        out.append(line(headers)).append(lineEnding);
        for (List<String> row : rows) {
            out.append(line(row)).append(lineEnding);
        }
        return out.toString();
    }

    private String line(List<String> cells) {
        StringBuilder line = new StringBuilder();
        for (int i = 0; i < cells.size(); i++) {
            if (i > 0) {
                line.append(separator);
            }
            line.append(escape(cells.get(i)));
        }
        return line.toString();
    }

    /** RFC-4180 quoting against the configured separator + quote char. */
    private String escape(String cell) {
        boolean mustQuote =
                cell.indexOf(separator) >= 0
                        || cell.indexOf(quote) >= 0
                        || cell.indexOf('\n') >= 0
                        || cell.indexOf('\r') >= 0;
        if (mustQuote) {
            String doubled = cell.replace(String.valueOf(quote), String.valueOf(quote) + quote);
            return quote + doubled + quote;
        }
        return cell;
    }
}
