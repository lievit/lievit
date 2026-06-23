/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit.importer;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVRecord;

/**
 * A CSV parser for an uploaded import file: detects the delimiter (comma / semicolon / tab),
 * extracts the header row, and yields each data row as a header→cell map. Handles the dialects an
 * admin upload throws at it: quoted fields with embedded delimiters and newlines, doubled quotes
 * ({@code ""}) as an escaped quote, and a leading UTF-8 BOM.
 *
 * <p>The byte-level parsing is Apache Commons CSV's {@link CSVParser} over {@link CSVFormat#RFC4180}
 * (ADR-0084): RFC-4180 quoting/escaping/embedded-delimiter/embedded-newline handling is the
 * library's, not hand-rolled. This type owns only the kit concerns the library does not: stripping a
 * leading UTF-8 BOM and auto-detecting the delimiter from the header line.
 */
public final class CsvSource {

    private final List<String> headers;
    private final List<List<String>> rows;
    private final char delimiter;

    private CsvSource(List<String> headers, List<List<String>> rows, char delimiter) {
        this.headers = List.copyOf(headers);
        this.rows = rows.stream().map(List::copyOf).toList();
        this.delimiter = delimiter;
    }

    /**
     * Parses CSV text, auto-detecting the delimiter from the header line.
     *
     * @param csv the raw CSV text (a leading UTF-8 BOM is stripped)
     * @return the parsed source
     */
    public static CsvSource parse(String csv) {
        Objects.requireNonNull(csv, "csv");
        String text = stripBom(csv);
        char delimiter = detectDelimiter(text);
        return parse(text, delimiter);
    }

    /**
     * Parses CSV text with an explicit delimiter.
     *
     * @param csv the raw CSV text
     * @param delimiter the field delimiter
     * @return the parsed source
     */
    public static CsvSource parse(String csv, char delimiter) {
        List<List<String>> records = tokenize(stripBom(csv), delimiter);
        if (records.isEmpty()) {
            return new CsvSource(List.of(), List.of(), delimiter);
        }
        List<String> headers = records.get(0);
        List<List<String>> dataRows = records.subList(1, records.size());
        return new CsvSource(headers, dataRows, delimiter);
    }

    /**
     * Tokenizes CSV text into records via Apache Commons CSV's {@link CSVParser} (ADR-0084): RFC-4180
     * quoting/escaping, embedded delimiters and newlines, and doubled-quote unescaping are the
     * library's. Empty lines are ignored, matching the original "skip blank rows" behaviour. The
     * first record (when present) is the header row.
     */
    private static List<List<String>> tokenize(String text, char delimiter) {
        CSVFormat format =
                CSVFormat.RFC4180
                        .builder()
                        .setDelimiter(delimiter)
                        .setIgnoreEmptyLines(true)
                        .get();
        List<List<String>> records = new ArrayList<>();
        try (CSVParser parser = CSVParser.parse(text, format)) {
            for (CSVRecord record : parser) {
                records.add(List.of(record.values()));
            }
        } catch (IOException e) {
            // Parsing an in-memory String never does real I/O. Surface defensively.
            throw new UncheckedIOException(e);
        }
        return records;
    }

    /** @return the header column names, in file order */
    public List<String> headers() {
        return headers;
    }

    /** @return the detected/used field delimiter */
    public char delimiter() {
        return delimiter;
    }

    /** @return the number of data rows (excludes the header) */
    public int rowCount() {
        return rows.size();
    }

    /** @return each data row as a raw cell list, in file order */
    public List<List<String>> rawRows() {
        return rows;
    }

    /**
     * Yields each data row as a header→cell map, applying a header→importer-column rename mapping so
     * the importer reads cells by its own column name regardless of the file's header text.
     *
     * @param headerToColumn maps a file header to the importer column name it feeds (a header absent
     *     from the map is dropped); pass an empty map to use the file headers verbatim
     * @return the mapped data rows, in file order
     */
    public List<Map<String, String>> mappedRows(Map<String, String> headerToColumn) {
        Objects.requireNonNull(headerToColumn, "headerToColumn");
        List<Map<String, String>> out = new ArrayList<>();
        for (List<String> row : rows) {
            Map<String, String> mapped = new LinkedHashMap<>();
            for (int i = 0; i < headers.size(); i++) {
                String header = headers.get(i);
                String target = headerToColumn.isEmpty() ? header : headerToColumn.get(header);
                if (target == null) {
                    continue;
                }
                String value = i < row.size() ? row.get(i) : "";
                mapped.put(target, value);
            }
            out.add(mapped);
        }
        return out;
    }

    private static String stripBom(String s) {
        return s.startsWith("﻿") ? s.substring(1) : s;
    }

    private static char detectDelimiter(String text) {
        int newline = text.indexOf('\n');
        String firstLine = newline >= 0 ? text.substring(0, newline) : text;
        char best = ',';
        int bestCount = -1;
        for (char candidate : new char[] {',', ';', '\t'}) {
            int count = (int) firstLine.chars().filter(c -> c == candidate).count();
            if (count > bestCount) {
                bestCount = count;
                best = candidate;
            }
        }
        return best;
    }
}
