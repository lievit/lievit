/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit.exporter;

import java.util.List;

/**
 * An export output format (the Filament {@code ExportFormat} enum: CSV / XLSX). A format owns the
 * serialization of a header row + a growing list of data rows into the final document bytes-as-text,
 * so the export job can assemble chunk-by-chunk and the completion notification can offer a download
 * per format.
 *
 * <p>v0.1 ships CSV (RFC-4180-ish quoting) and a minimal XLSX written as a SpreadsheetML 2003 XML
 * document (the {@code .xls}-readable single-sheet dialect every spreadsheet opens) so the kit needs
 * no Apache POI dependency on its persistence-agnostic floor. An adopter who needs OOXML wires a
 * POI-backed format.
 */
public enum ExportFormat {

    /** Comma-separated values. */
    CSV("text/csv", "csv") {
        @Override
        public String assemble(List<String> headers, List<List<String>> rows) {
            StringBuilder out = new StringBuilder();
            out.append(csvLine(headers)).append("\r\n");
            for (List<String> row : rows) {
                out.append(csvLine(row)).append("\r\n");
            }
            return out.toString();
        }
    },

    /** A spreadsheet, written as SpreadsheetML 2003 XML (POI-free). */
    XLSX("application/vnd.ms-excel", "xls") {
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
    };

    private final String contentType;
    private final String extension;

    ExportFormat(String contentType, String extension) {
        this.contentType = contentType;
        this.extension = extension;
    }

    /** @return the MIME content type for the download */
    public String contentType() {
        return contentType;
    }

    /** @return the file extension (no dot) */
    public String extension() {
        return extension;
    }

    /**
     * Assembles the full document text from a header row and the data rows.
     *
     * @param headers the header cells
     * @param rows the data rows
     * @return the document text
     */
    public abstract String assemble(List<String> headers, List<List<String>> rows);

    private static String csvLine(List<String> cells) {
        StringBuilder line = new StringBuilder();
        for (int i = 0; i < cells.size(); i++) {
            if (i > 0) {
                line.append(',');
            }
            line.append(escapeCsv(cells.get(i)));
        }
        return line.toString();
    }

    private static String escapeCsv(String cell) {
        if (cell.contains(",") || cell.contains("\"") || cell.contains("\n") || cell.contains("\r")) {
            return '"' + cell.replace("\"", "\"\"") + '"';
        }
        return cell;
    }

    private static String xmlRow(List<String> cells) {
        StringBuilder row = new StringBuilder("<Row>");
        for (String cell : cells) {
            row.append("<Cell><Data ss:Type=\"String\">").append(escapeXml(cell)).append("</Data></Cell>");
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
