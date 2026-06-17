/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package com.iambilotta.lievit.kit;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;

import org.junit.jupiter.api.Test;

/**
 * Specifies the {@link AdminTable} builder: it accumulates ordered columns from a fluent DSL, each a
 * label plus a value extractor over the row type, and derives a row id through the declared id
 * function (ADR-0008; the filament-internals.md "Table builder" carried over with a shared parent).
 */
class AdminTableTest {

    record Listing(long ref, String city) {}

    /**
     * @spec.given a table builder for the Listing row type
     * @spec.when  two columns are added fluently
     * @spec.then  the columns are kept in declaration order with their labels
     * @spec.adr   ADR-0008
     */
    @Test
    void keeps_columns_in_declaration_order() {
        AdminTable<Listing> table =
                AdminTable.<Listing>create()
                        .column("Ref", l -> l.ref())
                        .column("City", Listing::city);

        assertThat(table.columns()).extracting(AdminColumn::label).containsExactly("Ref", "City");
    }

    /**
     * @spec.given a table column with a value extractor
     * @spec.when  a row is rendered through that column
     * @spec.then  the column returns the extracted value as text
     * @spec.adr   ADR-0008
     */
    @Test
    void a_column_extracts_its_cell_value_from_a_row() {
        AdminTable<Listing> table = AdminTable.<Listing>create().column("City", Listing::city);

        AdminColumn<Listing> city = table.columns().get(0);

        assertThat(city.cell(new Listing(7, "Parma"))).isEqualTo("Parma");
    }

    /**
     * @spec.given a table with a declared id function
     * @spec.when  a row's id is requested
     * @spec.then  the function's value is returned as the string id used in row routes
     * @spec.adr   ADR-0008
     */
    @Test
    void derives_a_row_id_through_the_declared_id_function() {
        AdminTable<Listing> table =
                AdminTable.<Listing>create().id(l -> String.valueOf(l.ref())).column("City", Listing::city);

        assertThat(table.idOf(new Listing(42, "Reggio"))).isEqualTo("42");
    }

    /**
     * @spec.given a table builder sharing the AdminSchema parent
     * @spec.when  a heading is set
     * @spec.then  the schema parent carries it (the v0.1 shared hierarchy, no later unification)
     * @spec.adr   ADR-0008
     */
    @Test
    void carries_a_heading_through_the_shared_schema_parent() {
        AdminTable<Listing> table = AdminTable.<Listing>create().heading("Listings");

        assertThat(table.heading()).isEqualTo("Listings");
        assertThat(table).isInstanceOf(AdminSchema.class);
    }

    /**
     * @spec.given a table with no declared id function
     * @spec.when  a row id is requested
     * @spec.then  it falls back to the row's own toString, never null
     * @spec.adr   ADR-0008
     */
    @Test
    void falls_back_to_toString_when_no_id_function_is_declared() {
        AdminTable<String> table = AdminTable.create();

        assertThat(table.idOf("row-1")).isEqualTo("row-1");
    }

    /**
     * @spec.given several rows and a configured table
     * @spec.when  the columns are read
     * @spec.then  the column list is an unmodifiable snapshot (no caller mutation leaks in)
     * @spec.adr   ADR-0008
     */
    @Test
    void exposes_columns_as_an_unmodifiable_list() {
        AdminTable<Listing> table = AdminTable.<Listing>create().column("City", Listing::city);
        List<AdminColumn<Listing>> columns = table.columns();

        assertThat(columns).hasSize(1);
        org.assertj.core.api.Assertions.assertThatThrownBy(() -> columns.add(null))
                .isInstanceOf(UnsupportedOperationException.class);
    }
}
