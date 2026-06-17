/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicReference;

import org.junit.jupiter.api.Test;

/**
 * Specifies global table search: a column marked {@link TextColumn#searchable()} makes the table
 * searchable, a request's search term is carried to the bounded {@link RecordRepository.Query}, and
 * the list view surfaces both the searchable flag and the active term (the Filament
 * {@code CanSearchRecords} + column {@code CanBeSearchable}, wired to the query).
 */
class TableSearchTest {

    record Person(String name) {}

    /**
     * @spec.given a table with one searchable column and one plain column
     * @spec.when  the searchable flag is queried
     * @spec.then  the table reports it has searchable columns
     */
    @Test
    void a_searchable_column_makes_the_table_searchable() {
        Table<Person> table =
                Table.<Person>create()
                        .column(TextColumn.make("Name", Person::name).searchable())
                        .column(TextColumn.make("Slug", Person::name));

        assertThat(table.hasSearchableColumns()).isTrue();
    }

    /**
     * @spec.given a table with no searchable column
     * @spec.when  the searchable flag is queried
     * @spec.then  the table reports it has none
     */
    @Test
    void a_table_with_no_searchable_column_is_not_searchable() {
        Table<Person> table = Table.<Person>create().column("Name", Person::name);

        assertThat(table.hasSearchableColumns()).isFalse();
    }

    /**
     * @spec.given a list request carrying a search term
     * @spec.when  the list view is built
     * @spec.then  the term reaches the repository query and the view's controls expose it
     */
    @Test
    void a_search_term_reaches_the_query_and_the_controls() {
        AtomicReference<RecordRepository.Query> seen = new AtomicReference<>();
        Resource<Person> resource = resource(seen);

        AdminListView view =
                AdminListView.of(resource, ListRequest.firstPage(10).withSearch("par"));

        assertThat(seen.get().search()).isEqualTo("par");
        assertThat(seen.get().hasSearch()).isTrue();
        assertThat(view.controls().search()).isEqualTo("par");
        assertThat(view.controls().searchable()).isTrue();
    }

    /**
     * @spec.given a list request with a blank search term
     * @spec.when  the query is built
     * @spec.then  the query reports no active search
     */
    @Test
    void a_blank_search_term_is_not_an_active_search() {
        RecordRepository.Query query = ListRequest.firstPage(10).withSearch("  ").toQuery();

        assertThat(query.hasSearch()).isFalse();
    }

    private static Resource<Person> resource(AtomicReference<RecordRepository.Query> seen) {
        RecordRepository<Person> repo =
                new RecordRepository<>() {
                    @Override
                    public Page<Person> page(Query query) {
                        seen.set(query);
                        return Page.of(List.of(new Person("Parma")), 1);
                    }

                    @Override
                    public Optional<Person> findById(String id) {
                        return Optional.empty();
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
        return new Resource<>(repo) {
            @Override
            public String slug() {
                return "people";
            }

            @Override
            public String label() {
                return "People";
            }

            @Override
            public Table<Person> table() {
                return Table.<Person>create()
                        .column(TextColumn.make("Name", Person::name).searchable());
            }
        };
    }
}
