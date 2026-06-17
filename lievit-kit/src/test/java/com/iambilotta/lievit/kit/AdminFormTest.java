/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package com.iambilotta.lievit.kit;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

/**
 * Specifies the {@link AdminForm} builder: it accumulates ordered fields (a name plus a label) from
 * a fluent DSL and shares the {@link AdminSchema} parent with {@link AdminTable} from v0.1, so the
 * two builders never need a later breaking unification (the Filament v3-&gt;v4 Schema lesson).
 */
class AdminFormTest {

    record Listing(long ref, String city) {}

    /**
     * @spec.given a form builder for the Listing row type
     * @spec.when  two fields are added fluently
     * @spec.then  the fields are kept in declaration order with their names and labels
     * @spec.adr   ADR-0008
     */
    @Test
    void keeps_fields_in_declaration_order() {
        AdminForm<Listing> form =
                AdminForm.<Listing>create().field("ref", "Reference").field("city", "City");

        assertThat(form.fields()).extracting(AdminField::name).containsExactly("ref", "city");
        assertThat(form.fields()).extracting(AdminField::label).containsExactly("Reference", "City");
    }

    /**
     * @spec.given a field whose label is omitted
     * @spec.when  the field is added by name only
     * @spec.then  the label defaults to a humanized form of the name
     * @spec.adr   ADR-0008
     */
    @Test
    void humanizes_the_label_when_only_a_name_is_given() {
        AdminForm<Listing> form = AdminForm.<Listing>create().field("city");

        assertThat(form.fields().get(0).label()).isEqualTo("City");
    }

    /**
     * @spec.given a form and a table built for the same row type
     * @spec.when  their types are compared
     * @spec.then  both are AdminSchema, the common parent shared from v0.1
     * @spec.adr   ADR-0008
     */
    @Test
    void shares_the_schema_parent_with_the_table_builder() {
        AdminForm<Listing> form = AdminForm.create();
        AdminTable<Listing> table = AdminTable.create();

        assertThat(form).isInstanceOf(AdminSchema.class);
        assertThat(table).isInstanceOf(AdminSchema.class);
    }
}
