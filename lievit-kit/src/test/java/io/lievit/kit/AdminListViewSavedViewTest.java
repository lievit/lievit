/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;

/**
 * Specifies the {@link AdminListView} saved-view extension: when an active {@link SavedView} declares
 * visible columns, the rendered headers AND row cells are filtered + reordered to those keys (the
 * header/cell alignment preserved by construction), while an empty list (or a null view) renders
 * every column in declaration order, unchanged.
 */
class AdminListViewSavedViewTest {

    record Person(int id, String name, String role, String city) {}

    private static Resource<Person> resource() {
        List<Person> all = new ArrayList<>();
        all.add(new Person(1, "Ada", "dev", "Turin"));
        all.add(new Person(2, "Bob", "ops", "Rome"));
        RecordRepository<Person> repo =
                new RecordRepository<>() {
                    @Override
                    public Page<Person> page(Query query) {
                        return Page.of(all, all.size());
                    }

                    @Override
                    public Optional<Person> findById(String id) {
                        return all.stream().filter(p -> String.valueOf(p.id()).equals(id)).findFirst();
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
                        .id(p -> String.valueOf(p.id()))
                        .column(TextColumn.make("Name", Person::name))
                        .column(TextColumn.make("Role", Person::role))
                        .column(TextColumn.make("City", Person::city));
            }
        };
    }

    /**
     * @spec.given an active view selecting columns [city, name] (reordered, role hidden)
     * @spec.when  the list view is built with that active view
     * @spec.then  the headers AND the row cells are filtered + reordered to [City, Name]
     */
    @Test
    void an_active_view_filters_and_reorders_headers_and_cells() {
        SavedView view =
                SavedView.user("v1", "people", "ada", "Slim", FilterState.EMPTY,
                        List.of("city", "name"), Sort.NONE, 0, false);

        AdminListView built = AdminListView.of(resource(), ListRequest.firstPage(10), view);

        assertThat(built.headers()).containsExactly("City", "Name");
        assertThat(built.rows().get(0).textCells()).containsExactly("Turin", "Ada");
        assertThat(built.rows().get(1).textCells()).containsExactly("Rome", "Bob");
    }

    /**
     * @spec.given an active view with an empty visible-column list
     * @spec.when  the list view is built
     * @spec.then  every column renders in declaration order (unchanged)
     */
    @Test
    void an_empty_visible_column_list_leaves_columns_unchanged() {
        SavedView view =
                SavedView.user("v1", "people", "ada", "All", FilterState.EMPTY, List.of(),
                        Sort.NONE, 0, false);

        AdminListView built = AdminListView.of(resource(), ListRequest.firstPage(10), view);

        assertThat(built.headers()).containsExactly("Name", "Role", "City");
    }

    /**
     * @spec.given a null active view (no saved view applied)
     * @spec.when  the list view is built
     * @spec.then  every column renders in declaration order (the unchanged default)
     */
    @Test
    void a_null_view_renders_the_full_table() {
        AdminListView built = AdminListView.of(resource(), ListRequest.firstPage(10), null);

        assertThat(built.headers()).containsExactly("Name", "Role", "City");
    }

    /**
     * @spec.given an active view naming an unknown column key alongside a known one
     * @spec.when  the list view is built
     * @spec.then  the unknown key is skipped, only the known column renders
     */
    @Test
    void unknown_visible_column_keys_are_skipped() {
        SavedView view =
                SavedView.user("v1", "people", "ada", "Odd", FilterState.EMPTY,
                        List.of("name", "ghost"), Sort.NONE, 0, false);

        AdminListView built = AdminListView.of(resource(), ListRequest.firstPage(10), view);

        assertThat(built.headers()).containsExactly("Name");
    }
}
