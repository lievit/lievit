/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package com.iambilotta.lievit.kit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;

import org.junit.jupiter.api.Test;

/**
 * Specifies the concrete {@link Field} subtypes: each carries the base name+label contract and
 * adds type-specific configuration through a fluent factory API. The test style mirrors
 * {@link FormTest} and {@link TableTest}: pure builders, no Spring context.
 */
class FieldTypesTest {

    // ── TextField ────────────────────────────────────────────────────────────

    /**
     * @spec.given a TextField made with explicit name and label
     * @spec.when  name() and label() are read
     * @spec.then  they match the factory arguments and the field is a Field instance
     */
    @Test
    void text_field_carries_name_and_label() {
        TextField field = TextField.make("ref", "Reference");

        assertThat(field.name()).isEqualTo("ref");
        assertThat(field.label()).isEqualTo("Reference");
        assertThat(field).isInstanceOf(Field.class);
    }

    /**
     * @spec.given a TextField made with a name only
     * @spec.when  label() is read
     * @spec.then  it is the humanized form of the name
     */
    @Test
    void text_field_humanizes_label_when_only_name_is_given() {
        TextField field = TextField.make("postal_code");

        assertThat(field.label()).isEqualTo("Postal Code");
    }

    // ── TextareaField ─────────────────────────────────────────────────────────

    /**
     * @spec.given a TextareaField with no explicit row count
     * @spec.when  rows() is read
     * @spec.then  it returns the default row count
     */
    @Test
    void textarea_field_defaults_to_three_rows() {
        TextareaField field = TextareaField.make("notes");

        assertThat(field.rows()).isEqualTo(TextareaField.DEFAULT_ROWS);
    }

    /**
     * @spec.given a TextareaField with an explicit row count
     * @spec.when  rows() is read
     * @spec.then  it returns the configured count
     */
    @Test
    void textarea_field_carries_configured_row_count() {
        TextareaField field = TextareaField.make("description").rows(8);

        assertThat(field.rows()).isEqualTo(8);
    }

    /**
     * @spec.given a TextareaField
     * @spec.when  rows() is called with a non-positive value
     * @spec.then  an IllegalArgumentException is thrown
     */
    @Test
    void textarea_field_rejects_non_positive_row_count() {
        TextareaField field = TextareaField.make("notes");

        assertThatThrownBy(() -> field.rows(0))
                .isInstanceOf(IllegalArgumentException.class);
    }

    // ── SelectField ───────────────────────────────────────────────────────────

    /**
     * @spec.given a SelectField with two options
     * @spec.when  options() is read
     * @spec.then  the option list is kept in declaration order
     */
    @Test
    void select_field_keeps_options_in_declaration_order() {
        List<SelectOption> opts = List.of(
                SelectOption.of("draft", "Draft"),
                SelectOption.of("published", "Published"));
        SelectField field = SelectField.make("status", opts);

        assertThat(field.options())
                .extracting(SelectOption::value)
                .containsExactly("draft", "published");
        assertThat(field.options())
                .extracting(SelectOption::label)
                .containsExactly("Draft", "Published");
    }

    /**
     * @spec.given a SelectField
     * @spec.when  the caller tries to add to the returned options list
     * @spec.then  the list is unmodifiable (no caller mutation leaks in)
     */
    @Test
    void select_field_options_list_is_unmodifiable() {
        SelectField field = SelectField.make("status", List.of(SelectOption.of("a", "A")));

        assertThatThrownBy(() -> field.options().add(SelectOption.of("b", "B")))
                .isInstanceOf(UnsupportedOperationException.class);
    }

    // ── ToggleField ───────────────────────────────────────────────────────────

    /**
     * @spec.given a ToggleField with no labels configured
     * @spec.when  onLabel() and offLabel() are read
     * @spec.then  they return empty strings (the rendering template provides its own affordances)
     */
    @Test
    void toggle_field_defaults_to_empty_state_labels() {
        ToggleField field = ToggleField.make("active");

        assertThat(field.onLabel()).isEmpty();
        assertThat(field.offLabel()).isEmpty();
    }

    /**
     * @spec.given a ToggleField with explicit on/off labels
     * @spec.when  onLabel() and offLabel() are read
     * @spec.then  they return the configured strings
     */
    @Test
    void toggle_field_carries_configured_state_labels() {
        ToggleField field = ToggleField.make("active").onLabel("Yes").offLabel("No");

        assertThat(field.onLabel()).isEqualTo("Yes");
        assertThat(field.offLabel()).isEqualTo("No");
    }

    // ── DateField ─────────────────────────────────────────────────────────────

    /**
     * @spec.given a DateField with no format configured
     * @spec.when  pattern() is read
     * @spec.then  it returns null (the template applies its own default)
     */
    @Test
    void date_field_has_no_pattern_by_default() {
        DateField field = DateField.make("createdAt");

        assertThat(field.pattern()).isNull();
    }

    /**
     * @spec.given a DateField with an explicit format pattern
     * @spec.when  pattern() is read
     * @spec.then  it returns the configured pattern string
     */
    @Test
    void date_field_carries_configured_format_pattern() {
        DateField field = DateField.make("createdAt", "Created At").format("dd/MM/yyyy");

        assertThat(field.pattern()).isEqualTo("dd/MM/yyyy");
    }

    // ── Form integration ──────────────────────────────────────────────────────

    /**
     * @spec.given a Form with one TextField and one TextareaField added via the typed overload
     * @spec.when  fields() is read
     * @spec.then  both fields appear in declaration order with the correct types
     */
    @Test
    void form_accepts_typed_fields_via_field_instance_overload() {
        record Item(String title, String body) {}

        Form<Item> form = Form.<Item>create()
                .field(TextField.make("title"))
                .field(TextareaField.make("body").rows(5));

        assertThat(form.fields()).extracting(Field::name).containsExactly("title", "body");
        assertThat(form.fields().get(0)).isInstanceOf(TextField.class);
        assertThat(form.fields().get(1)).isInstanceOf(TextareaField.class);
        assertThat(((TextareaField) form.fields().get(1)).rows()).isEqualTo(5);
    }
}
