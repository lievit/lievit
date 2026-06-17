/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit.schema;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Map;

import org.junit.jupiter.api.Test;

import io.lievit.kit.support.EvaluationContext.Operation;

/**
 * Specifies the top-level schema engine ({@link SchemaForm}): it ties a tree of components to a
 * live state and drives hydrate / validate / dehydrate across nested layout containers, honoring
 * conditional visibility and the dehydration flags as one coherent engine.
 */
class SchemaFormTest {

    /**
     * @spec.given a schema with fields nested inside a Section and a Tab
     * @spec.when  the leaf fields are collected
     * @spec.then  the engine flattens fields across layout containers in declaration order
     */
    @Test
    void collects_leaf_fields_across_nested_layout_containers() {
        SchemaForm form =
                SchemaForm.create()
                        .components(
                                Section.make("Identity").schema(TextInput.make("name")),
                                Tabs.make()
                                        .tabs(Tabs.Tab.make("Contact").schema(TextInput.make("email"))));

        assertThat(form.fields()).extracting(SchemaField::statePath).containsExactly("name", "email");
    }

    /**
     * @spec.given a schema with a defaulting field and an empty state
     * @spec.when  the whole tree is hydrated
     * @spec.then  the default populates through the engine on mount
     */
    @Test
    void hydrates_defaults_across_the_tree() {
        SchemaForm form =
                SchemaForm.create()
                        .components(
                                Section.make("Prefs")
                                        .schema(TextInput.make("locale").defaultValue("it")));
        SchemaState state = SchemaState.empty();

        form.hydrate(state);

        assertThat(state.getString("locale")).isEqualTo("it");
    }

    /**
     * @spec.given a schema where a VAT field is required only when type=business, under business
     * @spec.when  the whole schema validates with an empty VAT
     * @spec.then  the engine reports one error keyed by the VAT field path (conditional validation)
     */
    @Test
    void validates_visible_fields_with_conditional_rules() {
        SchemaForm form =
                SchemaForm.create()
                        .components(
                                TextInput.make("type"),
                                TextInput.make("vat").rule(Rules.requiredIf("type", "business")));
        SchemaState state = SchemaState.of(Map.of("type", "business", "vat", ""));

        Map<String, String> errors = form.validate(state);

        assertThat(errors).containsKey("vat");
    }

    /**
     * @spec.given a schema with a field hidden under EDIT and dehydratedWhenHidden(false)
     * @spec.when  the schema dehydrates under EDIT
     * @spec.then  the hidden field's value is omitted from the persisted data
     */
    @Test
    void dehydrates_the_tree_honoring_visibility_and_flags() {
        SchemaForm form =
                SchemaForm.create()
                        .operating(Operation.EDIT, null)
                        .components(
                                TextInput.make("name"),
                                TextInput.make("password")
                                        .hiddenOn(Operation.EDIT)
                                        .dehydratedWhenHidden(false));
        SchemaState state = SchemaState.of(Map.of("name", "Ada", "password", "secret"));

        Map<String, Object> persisted = form.dehydrate(state);

        assertThat(persisted).containsEntry("name", "Ada").doesNotContainKey("password");
    }
}
