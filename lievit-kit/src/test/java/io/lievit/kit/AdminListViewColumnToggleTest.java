/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;

/**
 * Specifies the toggleable-column projection of {@link AdminListView}: a column marked
 * {@link TextColumn#toggleable() toggleable} appears in the {@link AdminListView#columnToggles()}
 * dropdown with its current visibility; a column {@link TextColumn#toggleable(boolean) hidden by
 * default} starts hidden (not in the rendered header set) yet still appears in the dropdown so it can
 * be toggled back on (Filament's {@code CanBeToggled}). An active saved view that pins visible columns
 * overrides the auto-projection.
 */
class AdminListViewColumnToggleTest {

    record Person(int id, String name, String role, String email) {}

    private static Resource<Person> resource(Table<Person> table) {
        RecordRepository<Person> repo =
                new RecordRepository<>() {
                    @Override
                    public Page<Person> page(Query query) {
                        return Page.of(List.of(new Person(1, "Ada", "dev", "ada@x.io")), 1);
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
                return table;
            }
        };
    }

    private static Table<Person> table() {
        return Table.<Person>create()
                .id(p -> String.valueOf(p.id()))
                .column(TextColumn.make("Name", Person::name))
                .column(TextColumn.make("Role", Person::role).toggleable())
                .column(TextColumn.make("Email", Person::email).toggleable(true));
    }

    /**
     * @spec.given a table with a toggleable column and a toggleable-hidden-by-default column
     * @spec.when  the list view is built with no active view
     * @spec.then  the hidden-by-default column is NOT in the rendered headers (auto-projected out),
     *     the always-on and the opt-in-visible columns are
     */
    @Test
    void a_hidden_by_default_toggleable_column_is_auto_projected_out() {
        AdminListView built = AdminListView.of(resource(table()), ListRequest.firstPage(10), null);

        assertThat(built.headers()).containsExactly("Name", "Role"); // Email hidden by default
        assertThat(built.rows().get(0).textCells()).containsExactly("Ada", "dev");
    }

    /**
     * @spec.given the same table
     * @spec.when  the column toggles are read
     * @spec.then  both toggleable columns appear, the visible one flagged visible and the
     *     hidden-by-default one flagged hidden (so the dropdown can offer it back)
     */
    @Test
    void both_toggleable_columns_appear_in_the_toggle_list_with_their_visibility() {
        AdminListView built = AdminListView.of(resource(table()), ListRequest.firstPage(10), null);

        assertThat(built.hasColumnToggles()).isTrue();
        assertThat(built.columnToggles()).hasSize(2);
        AdminListView.ColumnToggle role =
                built.columnToggles().stream().filter(t -> t.key().equals("role")).findFirst().orElseThrow();
        AdminListView.ColumnToggle email =
                built.columnToggles().stream().filter(t -> t.key().equals("email")).findFirst().orElseThrow();
        assertThat(role.visible()).isTrue();
        assertThat(email.visible()).isFalse();
    }

    /**
     * @spec.given a table with no toggleable column
     * @spec.when  the column toggles are read
     * @spec.then  the toggle list is empty (the "Columns" dropdown does not render)
     */
    @Test
    void a_table_with_no_toggleable_column_has_no_toggles() {
        Table<Person> plain =
                Table.<Person>create()
                        .id(p -> String.valueOf(p.id()))
                        .column(TextColumn.make("Name", Person::name));

        AdminListView built = AdminListView.of(resource(plain), ListRequest.firstPage(10), null);

        assertThat(built.hasColumnToggles()).isFalse();
        assertThat(built.columnToggles()).isEmpty();
    }

    /**
     * @spec.given an active saved view pinning the email column visible (overriding its default-hidden)
     * @spec.when  the list view is built with that view
     * @spec.then  email renders, and the email toggle reports visible
     */
    @Test
    void an_active_view_pinning_a_hidden_by_default_column_makes_it_visible() {
        SavedView view =
                SavedView.user("v1", "people", "ada", "Wide", FilterState.EMPTY,
                        List.of("name", "email"), Sort.NONE, 0, false);

        AdminListView built = AdminListView.of(resource(table()), ListRequest.firstPage(10), view);

        assertThat(built.headers()).containsExactly("Name", "Email");
        AdminListView.ColumnToggle email =
                built.columnToggles().stream().filter(t -> t.key().equals("email")).findFirst().orElseThrow();
        assertThat(email.visible()).isTrue();
        AdminListView.ColumnToggle role =
                built.columnToggles().stream().filter(t -> t.key().equals("role")).findFirst().orElseThrow();
        assertThat(role.visible()).isFalse(); // not in the pinned set
    }
}
