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
 * Specifies the per-row action resolution of {@link AdminListView}: the actions a {@link Table}
 * registers via {@link Table#actions} are resolved against each record at build time into generic
 * {@link RowAction}s on each {@link AdminListView.Row} (a URL action becomes a link, anything else a
 * wire dispatch by the action name carrying the row id; a hidden action is dropped; a destructive
 * action maps to the destructive variant + confirm).
 */
class AdminListViewRowActionTest {

    record City(int id, String name) {}

    private static RecordRepository<City> repo(List<City> all) {
        return new RecordRepository<>() {
            @Override
            public Page<City> page(Query query) {
                return Page.of(all, all.size());
            }

            @Override
            public Optional<City> findById(String id) {
                return all.stream().filter(c -> String.valueOf(c.id()).equals(id)).findFirst();
            }

            @Override
            public City create(City record) {
                return record;
            }

            @Override
            public City update(String id, City record) {
                return record;
            }

            @Override
            public void delete(String id) {}
        };
    }

    private static Resource<City> resource(Table<City> table) {
        RecordRepository<City> repo = repo(List.of(new City(1, "Turin"), new City(2, "Rome")));
        return new Resource<>(repo) {
            @Override
            public String slug() {
                return "cities";
            }

            @Override
            public String label() {
                return "Cities";
            }

            @Override
            public Table<City> table() {
                return table;
            }
        };
    }

    /**
     * @spec.given a table with a per-row URL action mapping each row to its edit URL
     * @spec.when  the list view is built
     * @spec.then  every row carries one link RowAction with the resolved href
     */
    @Test
    void a_per_row_url_action_resolves_to_a_link_action_with_the_row_url() {
        Table<City> table =
                Table.<City>create()
                        .id(c -> String.valueOf(c.id()))
                        .column(TextColumn.make("Name", City::name))
                        .actions(UrlAction.make("edit", "Edit",
                                r -> "/admin/cities/" + ((City) r).id() + "/edit"));

        AdminListView built = AdminListView.of(resource(table), ListRequest.firstPage(10), null);

        RowAction first = built.rows().get(0).actions().get(0);
        assertThat(first.label()).isEqualTo("Edit");
        assertThat(first.hasHref()).isTrue();
        assertThat(first.href()).isEqualTo("/admin/cities/1/edit");
        assertThat(built.rows().get(1).actions().get(0).href()).isEqualTo("/admin/cities/2/edit");
    }

    /**
     * @spec.given a table with a non-URL (wire) action that requires confirmation
     * @spec.when  the list view is built
     * @spec.then  each row carries a wire RowAction named after the action, carrying the row id, with
     *     the confirmation prompt set
     */
    @Test
    void a_non_url_action_resolves_to_a_wire_action_carrying_the_row_id() {
        Action<City> approve =
                Action.<City>make("approve", "Approve", AdminOperation.UPDATE)
                        .requiresConfirmation(true)
                        .action(c -> {});
        Table<City> table =
                Table.<City>create()
                        .id(c -> String.valueOf(c.id()))
                        .column(TextColumn.make("Name", City::name))
                        .actions(approve);

        AdminListView built = AdminListView.of(resource(table), ListRequest.firstPage(10), null);

        RowAction first = built.rows().get(0).actions().get(0);
        assertThat(first.hasWire()).isTrue();
        assertThat(first.wire()).isEqualTo("approve");
        assertThat(first.wireArgs()).containsEntry("id", "1");
        assertThat(first.requiresConfirmation()).isTrue();
    }

    /**
     * @spec.given a destructive built-in delete action registered as a per-row action
     * @spec.when  the list view is built
     * @spec.then  the resolved RowAction is the destructive variant and requires confirmation
     */
    @Test
    void a_destructive_action_maps_to_the_destructive_variant() {
        Table<City> table =
                Table.<City>create()
                        .id(c -> String.valueOf(c.id()))
                        .column(TextColumn.make("Name", City::name))
                        .actions(new DeleteAction<>());

        AdminListView built = AdminListView.of(resource(table), ListRequest.firstPage(10), null);

        RowAction action = built.rows().get(0).actions().get(0);
        assertThat(action.variant()).isEqualTo("destructive");
        assertThat(action.requiresConfirmation()).isTrue();
    }

    /**
     * @spec.given an action hidden for the rows whose id is even
     * @spec.when  the list view is built
     * @spec.then  only the odd-id row carries the action, the even-id row carries none
     */
    @Test
    void an_action_hidden_for_a_record_is_dropped_from_that_rows_list() {
        AdminAction<City> edit =
                Action.<City>make("edit", "Edit", AdminOperation.UPDATE)
                        .action(c -> {})
                        .hidden(r -> r instanceof City c && c.id() % 2 == 0);
        Table<City> table =
                Table.<City>create()
                        .id(c -> String.valueOf(c.id()))
                        .column(TextColumn.make("Name", City::name))
                        .actions(edit);

        AdminListView built = AdminListView.of(resource(table), ListRequest.firstPage(10), null);

        assertThat(built.rows().get(0).actions()).hasSize(1); // id 1, odd -> shown
        assertThat(built.rows().get(1).actions()).isEmpty(); // id 2, even -> hidden
    }

    /**
     * @spec.given a table with no registered per-row actions
     * @spec.when  the list view is built
     * @spec.then  every row reports no actions (the host falls back to its legacy edit affordance)
     */
    @Test
    void a_table_without_actions_yields_rows_with_no_actions() {
        Table<City> table =
                Table.<City>create()
                        .id(c -> String.valueOf(c.id()))
                        .column(TextColumn.make("Name", City::name));

        AdminListView built = AdminListView.of(resource(table), ListRequest.firstPage(10), null);

        assertThat(built.rows().get(0).hasActions()).isFalse();
        assertThat(built.rows().get(0).actions()).isEmpty();
    }
}
