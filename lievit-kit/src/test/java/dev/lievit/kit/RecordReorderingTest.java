/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

/**
 * Specifies drag-to-reorder (the Filament {@code CanReorderRecords}): {@link Table#reorderable}
 * names the order column the new positions persist to, and a non-reorderable table reports it off.
 * The persistence itself is the page's job through the {@link RecordRepository}; the table only
 * carries the intent.
 */
class RecordReorderingTest {

    /**
     * @spec.given a table made reorderable on a sort_order column
     * @spec.when  the reorder config is read back
     * @spec.then  reorder is on and names the order column
     */
    @Test
    void reorderable_enables_and_names_the_order_column() {
        Table<String> table = Table.<String>create().reorderable("sort_order");

        assertThat(table.isReorderable()).isTrue();
        assertThat(table.reorderColumn()).isEqualTo("sort_order");
    }

    /**
     * @spec.given a plain table
     * @spec.when  reorder state is read
     * @spec.then  reorder is off and the order column is null
     */
    @Test
    void a_plain_table_is_not_reorderable() {
        Table<String> table = Table.create();

        assertThat(table.isReorderable()).isFalse();
        assertThat(table.reorderColumn()).isNull();
    }
}
