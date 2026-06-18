/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit.exporter;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

import org.junit.jupiter.api.Test;

import io.lievit.component.LievitEffects;
import io.lievit.kit.RecordRepository;
import io.lievit.kit.job.InMemoryJobStore;
import io.lievit.kit.job.JobRun;
import io.lievit.kit.job.SynchronousJobRunner;

/**
 * Specifies the export actions (the Filament {@code ExportAction} / {@code ExportBulkAction} +
 * {@code Exporter}): column selection (default vs explicit), a CSV export over a query, an XLSX
 * export, the max-row cap, and a bulk export over a resolved selection.
 */
class ExportActionTest {

    record Person(String id, String name, int age) {}

    private final Map<String, String> stored = new ConcurrentHashMap<>();

    private ExportAction<Person> action() {
        Exporter<Person> exporter =
                Exporter.of(
                        ExportColumn.<Person>of("name", Person::name).label("Full name"),
                        ExportColumn.<Person>of("age", Person::age),
                        ExportColumn.<Person>of("id", Person::id).disabledByDefault());
        return ExportAction.of(
                exporter,
                new SynchronousJobRunner(new InMemoryJobStore()),
                (runId, format, document) -> {
                    String url = "/downloads/" + runId + "." + format.extension();
                    stored.put(url, document);
                    return url;
                });
    }

    /**
     * @spec.given an exporter with a default-off id column
     * @spec.when  its default column names are read
     * @spec.then  only the enabled-by-default columns are listed
     */
    @Test
    void default_columns_exclude_the_disabled_one() {
        assertThat(action().exporter().defaultColumnNames()).containsExactly("name", "age");
    }

    /**
     * @spec.given a CSV export over two rows with the default columns
     * @spec.when  it runs
     * @spec.then  the stored document carries the labelled header and both rows, and the run completes
     */
    @Test
    void it_exports_a_csv_over_a_query() {
        ExportAction<Person> action = action();

        JobRun run =
                action.run(
                        List.of(new Person("1", "Ada", 36), new Person("2", "Grace", 45)),
                        List.of(),
                        ExportFormat.CSV,
                        LievitEffects.capturing(),
                        "alice");

        assertThat(run.progress().successful()).isEqualTo(2);
        String url = run.resultLocation();
        assertThat(url).isNotNull();
        String csv = stored.get(url);
        assertThat(csv).contains("Full name,age");
        assertThat(csv).contains("Ada,36");
        assertThat(csv).contains("Grace,45");
        assertThat(csv).doesNotContain("\n1,"); // id column not selected
    }

    /**
     * @spec.given an explicit column selection including the default-off id
     * @spec.when  an XLSX export runs
     * @spec.then  the document is SpreadsheetML carrying the selected columns in order
     */
    @Test
    void it_exports_xlsx_with_an_explicit_selection() {
        ExportAction<Person> action = action();

        JobRun run =
                action.run(
                        List.of(new Person("1", "Ada", 36)),
                        List.of("id", "name"),
                        ExportFormat.XLSX,
                        LievitEffects.capturing(),
                        null);

        String xml = stored.get(run.resultLocation());
        assertThat(xml).contains("<Workbook");
        assertThat(xml).contains("<Data ss:Type=\"String\">id</Data>");
        assertThat(xml).contains("<Data ss:Type=\"String\">Ada</Data>");
    }

    /**
     * @spec.given an exporter capped at one row over a two-row query
     * @spec.when  it runs
     * @spec.then  only the capped number of rows is written
     */
    @Test
    void it_bounds_the_export_to_the_max_rows() {
        Exporter<Person> exporter =
                Exporter.of(ExportColumn.<Person>of("name", Person::name)).maxRows(1);
        ExportAction<Person> action =
                ExportAction.of(
                        exporter,
                        new SynchronousJobRunner(new InMemoryJobStore()),
                        (runId, format, document) -> {
                            stored.put("u", document);
                            return "u";
                        });

        JobRun run =
                action.run(
                        List.of(new Person("1", "Ada", 1), new Person("2", "Grace", 2)),
                        List.of(),
                        ExportFormat.CSV,
                        LievitEffects.capturing(),
                        null);

        assertThat(run.progress().successful()).isEqualTo(1);
        assertThat(stored.get("u")).contains("Ada").doesNotContain("Grace");
    }

    /**
     * @spec.given a bulk export over a selection of ids
     * @spec.when  it resolves the ids and exports
     * @spec.then  only the resolvable selected records are exported
     */
    @Test
    void bulk_export_resolves_the_selection() {
        RecordRepository<Person> repo =
                new RecordRepository<>() {
                    final Map<String, Person> rows =
                            Map.of("1", new Person("1", "Ada", 36), "2", new Person("2", "Grace", 45));

                    @Override
                    public Page<Person> page(Query query) {
                        return Page.of(List.copyOf(rows.values()), rows.size());
                    }

                    @Override
                    public Optional<Person> findById(String id) {
                        return Optional.ofNullable(rows.get(id));
                    }

                    @Override
                    public Person create(Person record) {
                        return record;
                    }

                    @Override
                    public Person update(String id, Person record) {
                        return record;
                    }

                    @Override
                    public void delete(String id) {}
                };
        ExportBulkAction<Person> bulk = ExportBulkAction.of(action());

        JobRun run =
                bulk.run(
                        repo,
                        List.of("1", "missing"),
                        List.of(),
                        ExportFormat.CSV,
                        LievitEffects.capturing(),
                        null);

        assertThat(run.progress().successful()).isEqualTo(1);
        assertThat(stored.get(run.resultLocation())).contains("Ada").doesNotContain("Grace");
    }
}
