/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;

import org.junit.jupiter.api.Test;

import io.lievit.kit.exporter.CsvFormat;
import io.lievit.kit.importer.CsvSource;

/**
 * Pins RFC-4180 correctness end-to-end across the kit's CSV seam (ADR-0084: the hand-rolled CSV
 * mechanics were replaced by Apache Commons CSV). Each test exports cells through {@link
 * CsvFormat#assemble} and parses them back through {@link CsvSource}, asserting the value survives
 * the round trip byte-for-byte. These are exactly the edge cases that silently corrupt data when the
 * quoting/escaping is hand-rolled: an embedded delimiter, an embedded quote, an embedded newline,
 * surrounding spaces, the empty field, and a formula-looking value.
 */
class RfcCsvRoundTripTest {

    /** Exports one row, parses it back, returns the single data row's cells. */
    private static List<String> roundTrip(CsvFormat format, List<String> headers, List<String> row) {
        String csv = format.assemble(headers, List.of(row));
        CsvSource parsed = CsvSource.parse(csv, format.separator());
        assertThat(parsed.headers()).isEqualTo(headers);
        assertThat(parsed.rawRows()).hasSize(1);
        return parsed.rawRows().get(0);
    }

    /**
     * @spec.given a field that contains the field delimiter (a comma under a comma dialect)
     * @spec.when  it is exported then re-parsed
     * @spec.then  the comma stays inside the one field: the delimiter is not split on
     */
    @Test
    void a_field_containing_the_delimiter_round_trips() {
        List<String> back =
                roundTrip(CsvFormat.standard(), List.of("a", "b"), List.of("x,y", "z"));

        assertThat(back).containsExactly("x,y", "z");
    }

    /**
     * @spec.given a field that contains the quote character (a double-quote)
     * @spec.when  it is exported then re-parsed
     * @spec.then  the quote is doubled on write and un-doubled on read, surviving intact
     */
    @Test
    void a_field_containing_a_double_quote_round_trips() {
        List<String> back =
                roundTrip(CsvFormat.standard(), List.of("a"), List.of("say \"hi\" now"));

        assertThat(back).containsExactly("say \"hi\" now");
    }

    /**
     * @spec.given a field that contains an embedded newline (a multi-line cell)
     * @spec.when  it is exported then re-parsed
     * @spec.then  the newline stays inside the one field: it is not read as a record boundary
     */
    @Test
    void a_field_containing_a_newline_round_trips() {
        List<String> back =
                roundTrip(CsvFormat.standard(), List.of("a", "b"), List.of("line1\nline2", "tail"));

        assertThat(back).containsExactly("line1\nline2", "tail");
    }

    /**
     * @spec.given a field with leading and trailing spaces
     * @spec.when  it is exported then re-parsed
     * @spec.then  the spaces are preserved (RFC-4180 does not trim; the parser must not either)
     */
    @Test
    void leading_and_trailing_spaces_are_preserved() {
        List<String> back =
                roundTrip(CsvFormat.standard(), List.of("a", "b"), List.of("  padded  ", "y"));

        assertThat(back).containsExactly("  padded  ", "y");
    }

    /**
     * @spec.given an empty field between two delimiters
     * @spec.when  it is exported then re-parsed
     * @spec.then  the empty field survives as an empty string, not dropped (cell count preserved)
     */
    @Test
    void an_empty_field_round_trips_as_empty_string() {
        List<String> back =
                roundTrip(CsvFormat.standard(), List.of("a", "b", "c"), List.of("x", "", "z"));

        assertThat(back).containsExactly("x", "", "z");
    }

    /**
     * @spec.given a value that looks like a spreadsheet formula ({@code =1+1}, {@code @cmd})
     * @spec.when  it is exported then re-parsed
     * @spec.then  the text is preserved verbatim (RFC-4180 is content-neutral; no mangling)
     */
    @Test
    void a_formula_looking_value_round_trips_verbatim() {
        List<String> back =
                roundTrip(CsvFormat.standard(), List.of("a", "b"), List.of("=1+1", "@SUM(A1)"));

        assertThat(back).containsExactly("=1+1", "@SUM(A1)");
    }

    /**
     * @spec.given a field carrying the delimiter, a quote, and a newline all at once
     * @spec.when  it is exported then re-parsed
     * @spec.then  the worst-case combination survives a single round trip intact
     */
    @Test
    void a_field_with_delimiter_quote_and_newline_together_round_trips() {
        String nasty = "a,b \"c\"\nd";
        List<String> back = roundTrip(CsvFormat.standard(), List.of("h"), List.of(nasty));

        assertThat(back).containsExactly(nasty);
    }

    /**
     * @spec.given the same nasty value under a semicolon (Excel-IT) dialect
     * @spec.when  it is exported with {@code ;} + BOM then re-parsed with the {@code ;} separator
     * @spec.then  the value survives: quoting keys off the configured separator, not a hard-coded comma
     */
    @Test
    void the_nasty_value_round_trips_under_a_semicolon_dialect() {
        CsvFormat semi = CsvFormat.of(';', false, "\r\n", '"');
        String nasty = "a;b \"c\"\nd";
        List<String> back = roundTrip(semi, List.of("h"), List.of(nasty));

        assertThat(back).containsExactly(nasty);
    }
}
