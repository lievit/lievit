/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit.exporter;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;

import org.junit.jupiter.api.Test;

/**
 * Specifies the configurable CSV serialization ({@link CsvFormat} as the configurable face of {@link
 * ExportFormat}): the default dialect stays byte-identical to the pre-sealing enum, the Excel-IT
 * dialect produces the expected {@code ;} + BOM + CRLF bytes, RFC-4180 quoting keys off the
 * configured separator, the BOM is prepended exactly once, and the XLSX format is unchanged.
 */
class CsvFormatTest {

    private static final List<String> HEADERS = List.of("name", "age");
    private static final List<List<String>> ROWS = List.of(List.of("Ada", "36"), List.of("Grace", "45"));

    /**
     * @spec.given the default {@link ExportFormat#CSV} singleton
     * @spec.when  it assembles a header + two rows
     * @spec.then  the bytes are exactly comma-separated, CRLF-terminated, no BOM (back-compat)
     */
    @Test
    void default_csv_is_byte_identical_to_the_original_enum() {
        String doc = ExportFormat.CSV.assemble(HEADERS, ROWS);

        assertThat(doc).isEqualTo("name,age\r\nAda,36\r\nGrace,45\r\n");
        assertThat(doc).doesNotStartWith("﻿");
        assertThat(ExportFormat.CSV.contentType()).isEqualTo("text/csv");
        assertThat(ExportFormat.CSV.extension()).isEqualTo("csv");
        assertThat(ExportFormat.CSV.displayName()).isEqualTo("CSV");
    }

    /**
     * @spec.given the standard preset is the same dialect the default constant uses
     * @spec.when  both assemble the same input
     * @spec.then  the standard preset equals the {@link ExportFormat#CSV} default
     */
    @Test
    void standard_preset_equals_the_default_constant() {
        assertThat(CsvFormat.standard().assemble(HEADERS, ROWS))
                .isEqualTo(ExportFormat.CSV.assemble(HEADERS, ROWS));
    }

    /**
     * @spec.given the Excel-Italian dialect ({@code ;} + UTF-8 BOM + CRLF)
     * @spec.when  it assembles a header + two rows
     * @spec.then  the bytes are exactly the BOM, then semicolon-separated CRLF-terminated lines
     */
    @Test
    void excel_italian_produces_the_bom_semicolon_crlf_bytes() {
        String doc = CsvFormat.excelItalian().assemble(HEADERS, ROWS);

        assertThat(doc).isEqualTo("﻿name;age\r\nAda;36\r\nGrace;45\r\n");
    }

    /**
     * @spec.given a cell containing a semicolon under a semicolon separator
     * @spec.when  the dialect serializes it
     * @spec.then  the cell is RFC-4180 quoted because the separator appears in it
     */
    @Test
    void quoting_keys_off_the_configured_separator_when_semicolon() {
        String doc =
                CsvFormat.of(';', false, "\r\n", '"')
                        .assemble(List.of("a"), List.of(List.of("x;y")));

        assertThat(doc).isEqualTo("a\r\n\"x;y\"\r\n");
    }

    /**
     * @spec.given the same {@code x;y} cell under a comma separator
     * @spec.when  the default-comma dialect serializes it
     * @spec.then  the semicolon is NOT a separator there, so the cell is left unquoted
     */
    @Test
    void quoting_does_not_trigger_on_a_non_separator_character() {
        String doc = ExportFormat.CSV.assemble(List.of("a"), List.of(List.of("x;y")));

        assertThat(doc).isEqualTo("a\r\nx;y\r\n");
    }

    /**
     * @spec.given the tab-separated preset
     * @spec.when  it assembles a header + a row
     * @spec.then  cells are tab-separated, CRLF-terminated, no BOM
     */
    @Test
    void tab_separated_uses_a_tab_between_cells() {
        String doc =
                CsvFormat.tabSeparated().assemble(List.of("a", "b"), List.of(List.of("1", "2")));

        assertThat(doc).isEqualTo("a\tb\r\n1\t2\r\n");
    }

    /**
     * @spec.given a BOM-enabled dialect over a header + two rows
     * @spec.when  it assembles
     * @spec.then  exactly one BOM char is present and it is the very first char
     */
    @Test
    void bom_is_prepended_exactly_once() {
        String doc = CsvFormat.excelItalian().assemble(HEADERS, ROWS);

        assertThat(doc.charAt(0)).isEqualTo('﻿');
        assertThat(doc.chars().filter(c -> c == '﻿').count()).isEqualTo(1L);
    }

    /**
     * @spec.given a cell with an embedded quote and a cell with an embedded newline
     * @spec.when  the default dialect serializes them
     * @spec.then  embedded quotes are doubled and newline-bearing cells are quoted (RFC-4180)
     */
    @Test
    void embedded_quotes_and_newlines_are_rfc4180_quoted() {
        String doc =
                ExportFormat.CSV.assemble(
                        List.of("a", "b"), List.of(List.of("say \"hi\"", "line1\nline2")));

        assertThat(doc).isEqualTo("a,b\r\n\"say \"\"hi\"\"\",\"line1\nline2\"\r\n");
    }

    /**
     * @spec.given an embedded newline cell under the Excel-IT line ending CRLF
     * @spec.when  the dialect serializes it
     * @spec.then  the cell's own newline is preserved inside the quotes, distinct from the row CRLF
     */
    @Test
    void embedded_newline_is_preserved_inside_quotes_distinct_from_row_terminator() {
        String doc =
                CsvFormat.excelItalian().assemble(List.of("a"), List.of(List.of("l1\nl2")));

        assertThat(doc).isEqualTo("﻿a\r\n\"l1\nl2\"\r\n");
    }

    /**
     * @spec.given a separator equal to the quote char
     * @spec.when  the dialect is built
     * @spec.then  construction is rejected (the two roles must differ)
     */
    @Test
    void separator_equal_to_quote_is_rejected() {
        assertThatThrownBy(() -> CsvFormat.of('"', false, "\r\n", '"'))
                .isInstanceOf(IllegalArgumentException.class);
    }

    /**
     * @spec.given the XLSX format singleton
     * @spec.when  it assembles a header + a row
     * @spec.then  the SpreadsheetML document and metadata are unchanged from the original enum
     */
    @Test
    void xlsx_format_is_unchanged() {
        String doc = ExportFormat.XLSX.assemble(List.of("name"), List.of(List.of("Ada")));

        assertThat(ExportFormat.XLSX.contentType()).isEqualTo("application/vnd.ms-excel");
        assertThat(ExportFormat.XLSX.extension()).isEqualTo("xls");
        assertThat(ExportFormat.XLSX.displayName()).isEqualTo("XLSX");
        assertThat(doc).contains("<Workbook");
        assertThat(doc).contains("<Data ss:Type=\"String\">name</Data>");
        assertThat(doc).contains("<Data ss:Type=\"String\">Ada</Data>");
    }
}
