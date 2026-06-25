/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit.schema;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;

import dev.lievit.kit.SelectOption;
import dev.lievit.kit.support.EvaluationContext;
import dev.lievit.kit.support.EvaluationContext.Operation;

/**
 * Specifies the P2 form escape-hatches that drop onto the schema engine without an engine rewrite:
 * {@link ViewField} (a custom template bound to field state), {@link CodeEditor} (a highlighted code
 * field), {@link MorphToSelect} (polymorphic relation: pick type then record), and
 * {@link ModalTableSelect} (pick a related record from a searchable table modal). Each binds a state
 * path and round-trips through the standard {@link SchemaForm} lifecycle.
 */
class EscapeHatchFieldsTest {

    private static EvaluationContext ctx(Map<String, Object> state) {
        return EvaluationContext.readOnly(null, null, Operation.CREATE, state);
    }

    // ── ViewField (#239) ──────────────────────────────────────────────────────

    /**
     * @spec.given a ViewField bound to a state path with a custom template and view data
     * @spec.when  its template, binding, and view data are read
     * @spec.then  it carries the template name, binds the state path, and exposes the view data
     */
    @Test
    void view_field_renders_a_custom_template_wired_to_its_state_path() {
        ViewField<String> field =
                ViewField.<String>make("rating", "forms/star-rating").viewData("max", 5);

        assertThat(field.view()).isEqualTo("forms/star-rating");
        assertThat(field.statePath()).isEqualTo("rating");
        assertThat(field.viewData()).containsEntry("max", 5);
        assertThat(field.read(SchemaState.of(Map.of("rating", "4")))).isEqualTo("4");
    }

    /**
     * @spec.given a required ViewField inside a form
     * @spec.when  the form dehydrates and the field validates an empty value
     * @spec.then  the custom view participates in the engine: it dehydrates and its rules fire
     */
    @Test
    void view_field_round_trips_and_validates_like_any_field() {
        ViewField<String> field = ViewField.<String>make("payload", "forms/json").required();
        SchemaForm form = SchemaForm.create().components(field);

        assertThat(form.dehydrate(SchemaState.of(Map.of("payload", "x")))).containsEntry("payload", "x");
        assertThat(field.validate(SchemaState.of(Map.of("payload", "")), ctx(Map.of()))).isPresent();
    }

    // ── CodeEditor (#237) ──────────────────────────────────────────────────────

    /**
     * @spec.given a CodeEditor for JSON with soft wraps
     * @spec.when  the language, wraps, and a raw value are read
     * @spec.then  the language and wraps are carried and the code round-trips verbatim
     */
    @Test
    void code_editor_carries_language_and_round_trips_verbatim() {
        CodeEditor field = CodeEditor.make("config").language(CodeEditor.Language.JSON).softWraps();

        assertThat(field.language()).isEqualTo(CodeEditor.Language.JSON);
        assertThat(field.hasSoftWraps()).isTrue();
        assertThat(field.read(SchemaState.of(Map.of("config", "{\"a\":1}")))).isEqualTo("{\"a\":1}");
    }

    // ── MorphToSelect (#237) ───────────────────────────────────────────────────

    /**
     * @spec.given a MorphToSelect over two types with their own record options
     * @spec.when  the type and record paths and the per-type options are inspected
     * @spec.then  it binds id + type columns and offers each type's records once that type is chosen
     */
    @Test
    void morph_to_select_sets_both_the_type_and_the_id() {
        MorphToSelect field =
                MorphToSelect.make("commentable")
                        .types(
                                List.of(
                                        MorphToSelect.Type.of(
                                                "post", "Post", List.of(SelectOption.of("1", "Hello"))),
                                        MorphToSelect.Type.of(
                                                "video", "Video", List.of(SelectOption.of("9", "Clip")))));

        assertThat(field.statePath()).isEqualTo("commentable_id");
        assertThat(field.typePath()).isEqualTo("commentable_type");
        assertThat(field.typeOptions())
                .extracting(SelectOption::value)
                .containsExactly("post", "video");

        // no type chosen yet: no record options
        assertThat(field.resolveRecordOptions(ctx(Map.of()))).isEmpty();
        // the chosen type narrows the record options to that type's records
        assertThat(field.resolveRecordOptions(ctx(Map.of("commentable_type", "video"))))
                .extracting(SelectOption::label)
                .containsExactly("Clip");
    }

    // ── ModalTableSelect (#237) ─────────────────────────────────────────────────

    /**
     * @spec.given a ModalTableSelect over candidate rows with two columns
     * @spec.when  the modal rows are resolved
     * @spec.then  each candidate becomes a row carrying its id value and the two cell strings
     */
    @Test
    void modal_table_select_opens_a_table_to_choose_a_related_record() {
        record Owner(String id, String name, String city) {}
        ModalTableSelect<Owner> field =
                ModalTableSelect.<Owner>make("owner_id")
                        .candidates(List.of(new Owner("o1", "Acme", "Rome"), new Owner("o2", "Globex", "Milan")))
                        .rowValue(Owner::id)
                        .column("Name", Owner::name)
                        .column("City", Owner::city);

        assertThat(field.isSearchable()).isTrue();
        assertThat(field.columns()).extracting(ModalTableSelect.TableColumn::label).containsExactly("Name", "City");

        List<ModalTableSelect.Row> rows = field.resolveRows(ctx(Map.of()));
        assertThat(rows).extracting(ModalTableSelect.Row::value).containsExactly("o1", "o2");
        assertThat(rows.get(0).cells()).containsExactly("Acme", "Rome");
    }

    /**
     * @spec.given a multiple ModalTableSelect
     * @spec.when  a comma-joined wire value is read back
     * @spec.then  the multi-value cast hydrates it to a list, like a multiple Select
     */
    @Test
    void modal_table_select_multiple_binds_a_list() {
        record Tag(String id, String label) {}
        ModalTableSelect<Tag> field =
                ModalTableSelect.<Tag>make("tag_ids").rowValue(Tag::id).column("Label", Tag::label).multiple();

        assertThat(field.isMultiple()).isTrue();
        assertThat(field.read(SchemaState.of(Map.of("tag_ids", "a,b,c")))).isEqualTo(List.of("a", "b", "c"));
    }
}
