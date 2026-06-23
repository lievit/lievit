/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit.importer;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.junit.jupiter.api.Test;

import io.lievit.component.LievitEffects;
import io.lievit.kit.job.InMemoryJobStore;
import io.lievit.kit.job.JobRun;
import io.lievit.kit.job.SynchronousJobRunner;

/**
 * Specifies the CSV import action (the Filament {@code ImportAction} + {@code Importer}): header→
 * column mapping (including auto-guessing from candidate headers), a successful import over a CSV,
 * per-row validation/casting failures captured into a downloadable report, and the max-row cap.
 */
class ImportActionTest {

    record Person(String name, int age) {}

    private ImportAction importerOver(List<Person> sink) {
        Importer importer =
                Importer.of(
                        List.of(
                                ImportColumn.make("name").required().guess("Full Name", "name"),
                                ImportColumn.of("age", Integer::parseInt).guess("Age")),
                        (attrs, ctx) ->
                                sink.add(new Person((String) attrs.get("name"), (int) attrs.get("age"))));
        return ImportAction.of(importer, new SynchronousJobRunner(new InMemoryJobStore()));
    }

    /**
     * @spec.given a CSV whose headers differ from the column names
     * @spec.when  the action proposes a mapping
     * @spec.then  it guesses each column from its candidate headers (case-insensitive)
     */
    @Test
    void it_guesses_the_header_to_column_mapping() {
        ImportAction action = importerOver(new ArrayList<>());

        ImportAction.MappingProposal proposal =
                action.proposeMapping("Full Name,Age\nAda,36\n");

        assertThat(proposal.fileHeaders()).containsExactly("Full Name", "Age");
        assertThat(proposal.guessedMapping())
                .containsEntry("Full Name", "name")
                .containsEntry("Age", "age");
    }

    /**
     * @spec.given a valid CSV and the guessed mapping
     * @spec.when  the import runs
     * @spec.then  every row is resolved (cast) and persisted, and the run completes with no failures
     */
    @Test
    void it_imports_every_valid_row() {
        List<Person> sink = new ArrayList<>();
        ImportAction action = importerOver(sink);
        String csv = "Full Name,Age\nAda,36\nGrace,45\n";
        Map<String, String> mapping = action.proposeMapping(csv).guessedMapping();

        Optional<JobRun> run = action.run(csv, mapping, LievitEffects.capturing(), "alice");

        assertThat(run).isPresent();
        assertThat(run.get().progress().successful()).isEqualTo(2);
        assertThat(run.get().progress().failed()).isZero();
        assertThat(sink).containsExactly(new Person("Ada", 36), new Person("Grace", 45));
        assertThat(run.get().startedBy()).isEqualTo("alice");
    }

    /**
     * @spec.given a CSV with one row missing a required cell and one with a bad cast
     * @spec.when  the import runs
     * @spec.then  the good row persists, the two bad rows are captured with reasons, and the
     *     failed-rows CSV carries an error column
     */
    @Test
    void it_captures_failed_rows_with_reasons() {
        List<Person> sink = new ArrayList<>();
        ImportAction action = importerOver(sink);
        String csv = "name,age\nAda,36\n,40\nGrace,notanumber\n";

        Optional<JobRun> run = action.run(csv, Map.of(), LievitEffects.capturing(), null);

        assertThat(run).isPresent();
        assertThat(sink).containsExactly(new Person("Ada", 36));
        assertThat(run.get().progress().successful()).isEqualTo(1);
        assertThat(run.get().progress().failed()).isEqualTo(2);
        assertThat(run.get().progress().failedRows())
                .extracting(f -> f.reason())
                .anySatisfy(r -> assertThat(r).contains("required"))
                .anySatisfy(r -> assertThat(r).contains("invalid"));
        String failedCsv = action.failedRowsCsv(run.get());
        assertThat(failedCsv).startsWith("name,age,error");
        assertThat(failedCsv).contains("Grace");
    }

    /**
     * @spec.given an importer with a max-row cap below the file's row count
     * @spec.when  the import runs
     * @spec.then  it is rejected (no job, nothing persisted)
     */
    @Test
    void it_enforces_the_max_row_cap() {
        List<Person> sink = new ArrayList<>();
        Importer importer =
                Importer.of(
                                List.of(ImportColumn.make("name"), ImportColumn.of("age", Integer::parseInt)),
                                (attrs, ctx) -> sink.add(new Person((String) attrs.get("name"), 0)))
                        .maxRows(1);
        ImportAction action = ImportAction.of(importer, new SynchronousJobRunner(new InMemoryJobStore()));

        Optional<JobRun> run =
                action.run("name,age\nAda,1\nGrace,2\n", Map.of(), LievitEffects.capturing(), null);

        assertThat(run).isEmpty();
        assertThat(sink).isEmpty();
    }

    /**
     * @spec.given a CSV with quoted fields containing a comma and a doubled quote
     * @spec.when  it is parsed
     * @spec.then  the quoted delimiter is preserved and the doubled quote unescaped
     */
    @Test
    void it_parses_quoted_fields() {
        CsvSource source = CsvSource.parse("name,note\n\"Ada, the first\",\"she said \"\"hi\"\"\"\n");

        assertThat(source.headers()).containsExactly("name", "note");
        assertThat(source.rawRows()).singleElement().asList()
                .containsExactly("Ada, the first", "she said \"hi\"");
    }

    /**
     * @spec.given a quoted field carrying an embedded newline
     * @spec.when  it is parsed
     * @spec.then  the newline stays inside the one field, not read as a row boundary (RFC-4180)
     */
    @Test
    void it_parses_an_embedded_newline_inside_quotes() {
        CsvSource source = CsvSource.parse("name,note\n\"Ada\",\"line1\nline2\"\n");

        assertThat(source.rowCount()).isEqualTo(1);
        assertThat(source.rawRows()).singleElement().asList()
                .containsExactly("Ada", "line1\nline2");
    }

    /**
     * @spec.given a row with a leading-space field and an empty field
     * @spec.when  it is parsed
     * @spec.then  the surrounding space is preserved and the empty field stays an empty string
     *     (RFC-4180 does not trim; the empty cell is not dropped)
     */
    @Test
    void it_preserves_spaces_and_empty_fields() {
        CsvSource source = CsvSource.parse("a,b,c\n  padded  ,,z\n");

        assertThat(source.rawRows()).singleElement().asList()
                .containsExactly("  padded  ", "", "z");
    }

    /**
     * @spec.given a semicolon-delimited file with a quoted field containing the semicolon
     * @spec.when  it is parsed with delimiter auto-detection
     * @spec.then  the semicolon dialect is detected and the quoted delimiter stays inside the field
     */
    @Test
    void it_autodetects_a_semicolon_dialect_and_keeps_the_quoted_delimiter() {
        CsvSource source = CsvSource.parse("name;note\nAda;\"a;b\"\n");

        assertThat(source.delimiter()).isEqualTo(';');
        assertThat(source.headers()).containsExactly("name", "note");
        assertThat(source.rawRows()).singleElement().asList().containsExactly("Ada", "a;b");
    }
}
