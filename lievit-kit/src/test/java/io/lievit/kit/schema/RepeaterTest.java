/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit.schema;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;

import io.lievit.kit.support.EvaluationContext;

/**
 * Specifies the Repeater of a repeated sub-schema (the filament-forms Repeater): a variable-length
 * list of items over one child schema, with add/delete/reorder/clone behavior flags, min/max bounds,
 * default items, a computed item label, and per-item validation with INDEXED error paths
 * ({@code items.0.qty}) over the dot-path state grammar.
 */
class RepeaterTest {

    private static Map<String, Object> item(String name, Object qty) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("name", name);
        m.put("qty", qty);
        return m;
    }

    private static SchemaState withItems(List<Map<String, Object>> items) {
        Map<String, Object> root = new LinkedHashMap<>();
        root.put("items", new ArrayList<>(items));
        return SchemaState.of(root);
    }

    /**
     * @spec.given a Repeater over a name+qty child schema with behavior flags and bounds
     * @spec.when  its configuration is read
     * @spec.then  the child schema, bounds, and behavior flags are exposed
     */
    @Test
    void repeater_carries_child_schema_bounds_and_behavior() {
        Repeater repeater =
                Repeater.make("items")
                        .schema(TextInput.make("name").required(), TextInput.make("qty"))
                        .minItems(1)
                        .maxItems(5)
                        .defaultItems(2)
                        .columns(2)
                        .cloneable()
                        .collapsible()
                        .deletable(false);

        assertThat(repeater.statePath()).isEqualTo("items");
        assertThat(repeater.childSchema()).hasSize(2);
        assertThat(repeater.minItems()).isEqualTo(1);
        assertThat(repeater.maxItems()).isEqualTo(5);
        assertThat(repeater.defaultItems()).isEqualTo(2);
        assertThat(repeater.columns()).isEqualTo(2);
        assertThat(repeater.isCloneable()).isTrue();
        assertThat(repeater.isCollapsible()).isTrue();
        assertThat(repeater.isDeletable()).isFalse();
    }

    /**
     * @spec.given a Repeater holding two items, the second missing a required child field
     * @spec.when  the whole schema validates
     * @spec.then  the failure is keyed by the indexed path items.1.name
     */
    @Test
    void repeater_validates_each_item_with_indexed_error_paths() {
        Repeater repeater =
                Repeater.make("items").schema(TextInput.make("name").required(), TextInput.make("qty"));
        SchemaForm form = SchemaForm.create().components(repeater);
        SchemaState state =
                withItems(List.of(item("Widget", "3"), item("", "1")));

        Map<String, String> errors = form.validate(state);

        assertThat(errors).containsKey("items.1.name");
        assertThat(errors).doesNotContainKey("items.0.name");
    }

    /**
     * @spec.given a Repeater requiring at least 2 items, holding only 1
     * @spec.when  the schema validates
     * @spec.then  the repeater's own min rule fails at its bound path
     */
    @Test
    void repeater_enforces_min_items_on_its_own_list() {
        Repeater repeater =
                Repeater.make("items").schema(TextInput.make("name")).minItems(2);
        SchemaForm form = SchemaForm.create().components(repeater);
        SchemaState state = withItems(List.of(item("only", "1")));

        assertThat(form.validate(state)).containsKey("items");
    }

    /**
     * @spec.given a Repeater with a computed item label over the item's own state
     * @spec.when  the label is resolved for an item context
     * @spec.then  the label reads the item's fields
     */
    @Test
    void repeater_computes_a_per_item_label() {
        Repeater repeater =
                Repeater.make("items")
                        .schema(TextInput.make("name"))
                        .itemLabel(c -> c.getString("name"));
        EvaluationContext itemCtx =
                EvaluationContext.readOnly(
                        null, null, EvaluationContext.Operation.CREATE, Map.of("name", "Widget"));

        assertThat(repeater.resolveItemLabel(itemCtx)).isEqualTo("Widget");
    }

    /**
     * @spec.given a Repeater declared in relationship mode
     * @spec.when  the relationship marker is read
     * @spec.then  the relation name and the relationship flag are set
     */
    @Test
    void repeater_relationship_mode_marks_the_relation() {
        Repeater repeater = Repeater.make("orderLines").relationship("lines");

        assertThat(repeater.isRelationship()).isTrue();
        assertThat(repeater.relationship()).isEqualTo("lines");
    }

    /**
     * @spec.given a state with two repeater items
     * @spec.when  the item count is read
     * @spec.then  the count reflects the bound list length
     */
    @Test
    void repeater_reports_its_item_count() {
        Repeater repeater = Repeater.make("items").schema(TextInput.make("name"));
        SchemaState state = withItems(List.of(item("a", 1), item("b", 2)));

        assertThat(repeater.itemCount(state)).isEqualTo(2);
    }
}
