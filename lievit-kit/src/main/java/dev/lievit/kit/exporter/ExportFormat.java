/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit.exporter;

import java.util.List;

/**
 * An export output format (the Filament {@code ExportFormat} concept: CSV / XLSX). A format owns the
 * serialization of a header row + a growing list of data rows into the final document bytes-as-text,
 * so the export job can assemble chunk-by-chunk and the completion notification can offer a download
 * per format.
 *
 * <p>This is a {@code sealed interface} with two ready singletons, {@link #CSV} (RFC-4180 quoting,
 * comma separator, CRLF, no BOM) and {@link #XLSX} (a minimal SpreadsheetML 2003 XML document, the
 * {@code .xls}-readable single-sheet dialect every spreadsheet opens, so the kit needs no Apache POI
 * dependency on its persistence-agnostic floor). It was an {@code enum} until v0.1 needed locale CSV
 * dialects (Excel-IT wants {@code ;} + UTF-8 BOM): an enum cannot carry per-instance separator / BOM
 * / line-ending / quote configuration, so the type became a sealed interface and the configurable
 * path is the {@link CsvFormat} record. The Filament precedent is {@code getCsvDelimiter()} returning
 * a single character; here the dialect is a value object the caller passes instead of the {@link
 * #CSV} default. An adopter who needs OOXML wires a POI-backed implementation.
 *
 * <p>{@link #CSV} stays byte-identical to the pre-sealing enum (comma, CRLF, RFC-4180, no BOM); it is
 * exactly {@code CsvFormat.of(',', false, "\r\n", '"')}, so the default path is just the most common
 * dialect.
 */
public sealed interface ExportFormat permits CsvFormat, ExportFormat.Xlsx {

    /** The default CSV: comma separator, CRLF line ending, RFC-4180 double-quote quoting, no BOM. */
    ExportFormat CSV = CsvFormat.standard();

    /** A spreadsheet, written as SpreadsheetML 2003 XML (POI-free). */
    ExportFormat XLSX = new Xlsx();

    /** @return the MIME content type for the download */
    String contentType();

    /** @return the file extension (no dot) */
    String extension();

    /**
     * A human label for the format, surfaced in the download notification (was the enum's
     * {@code name()}).
     *
     * @return the display name
     */
    String displayName();

    /**
     * Assembles the full document text from a header row and the data rows.
     *
     * @param headers the header cells
     * @param rows the data rows
     * @return the document text
     */
    String assemble(List<String> headers, List<List<String>> rows);

    /** The SpreadsheetML 2003 XML format (POI-free); behaviour unchanged from the original enum. */
    final class Xlsx implements ExportFormat {

        Xlsx() {}

        @Override
        public String contentType() {
            return "application/vnd.ms-excel";
        }

        @Override
        public String extension() {
            return "xls";
        }

        @Override
        public String displayName() {
            return "XLSX";
        }

        @Override
        public String assemble(List<String> headers, List<List<String>> rows) {
            StringBuilder out = new StringBuilder();
            out.append("<?xml version=\"1.0\"?>\n")
                    .append("<?mso-application progid=\"Excel.Sheet\"?>\n")
                    .append("<Workbook xmlns=\"urn:schemas-microsoft-com:office:spreadsheet\" ")
                    .append("xmlns:ss=\"urn:schemas-microsoft-com:office:spreadsheet\">\n")
                    .append("<Worksheet ss:Name=\"Export\"><Table>\n");
            out.append(xmlRow(headers));
            for (List<String> row : rows) {
                out.append(xmlRow(row));
            }
            out.append("</Table></Worksheet>\n</Workbook>\n");
            return out.toString();
        }

        private static String xmlRow(List<String> cells) {
            StringBuilder row = new StringBuilder("<Row>");
            for (String cell : cells) {
                row.append("<Cell><Data ss:Type=\"String\">")
                        .append(escapeXml(cell))
                        .append("</Data></Cell>");
            }
            return row.append("</Row>\n").toString();
        }

        private static String escapeXml(String s) {
            return s.replace("&", "&amp;")
                    .replace("<", "&lt;")
                    .replace(">", "&gt;")
                    .replace("\"", "&quot;");
        }
    }
}
