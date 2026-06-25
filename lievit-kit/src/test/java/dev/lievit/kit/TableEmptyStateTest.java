/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.Test;

/**
 * Specifies the table empty state and striping: an empty result set surfaces the configured
 * empty-state heading/description on the view controls, and {@link Table#striped()} surfaces the
 * striping flag (the Filament {@code HasEmptyState} + {@code CanBeStriped}).
 */
class TableEmptyStateTest {

    /**
     * @spec.given a table with a configured empty state and no matching rows
     * @spec.when  the list view is built
     * @spec.then  the view has no rows and the controls carry the empty-state heading/description
     */
    @Test
    void an_empty_result_surfaces_the_empty_state() {
        Resource<String> resource = emptyResource();

        AdminListView view = AdminListView.of(resource, ListRequest.firstPage(10));

        assertThat(view.rows()).isEmpty();
        assertThat(view.controls().emptyStateHeading()).isEqualTo("Nothing here");
        assertThat(view.controls().emptyStateDescription()).isEqualTo("Create the first one");
    }

    /**
     * @spec.given a striped table
     * @spec.when  the list view is built
     * @spec.then  the controls report striping is on
     */
    @Test
    void a_striped_table_surfaces_the_striping_flag() {
        Resource<String> resource = emptyResource();

        AdminListView view = AdminListView.of(resource, ListRequest.firstPage(10));

        assertThat(view.controls().striped()).isTrue();
    }

    private static Resource<String> emptyResource() {
        RecordRepository<String> repo =
                new RecordRepository<>() {
                    @Override
                    public Page<String> page(Query query) {
                        return Page.of(List.of(), 0);
                    }

                    @Override
                    public Optional<String> findById(String id) {
                        return Optional.empty();
                    }

                    @Override
                    public String create(String record) {
                        return record;
                    }

                    @Override
                    public String update(String id, String record) {
                        return record;
                    }

                    @Override
                    public void delete(String id) {}
                };
        return new Resource<>(repo) {
            @Override
            public String slug() {
                return "rows";
            }

            @Override
            public String label() {
                return "Rows";
            }

            @Override
            public Table<String> table() {
                return Table.<String>create()
                        .striped()
                        .emptyState("Nothing here", "Create the first one")
                        .column("Value", s -> s);
            }
        };
    }
}
