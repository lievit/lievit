/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit.schema;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;

import io.lievit.kit.SelectOption;
import io.lievit.kit.support.EvaluationContext;
import io.lievit.kit.support.EvaluationContext.Operation;

/**
 * Specifies the schema field palette on the state engine: TextInput (type/maxLength/affixes),
 * Checkbox (boolean cast), Radio + CheckboxList (option sets, multi binding), Select
 * (searchable/multi + reactive options), and FileUpload (constraints). Each binds a state path,
 * carries helper-text/hint/affixes, and validates through its rule set.
 */
class SchemaFieldsTest {

    private static EvaluationContext ctx(Map<String, Object> state) {
        return EvaluationContext.readOnly(null, null, Operation.CREATE, state);
    }

    /**
     * @spec.given a TextInput with a humanized name, helper text, an affix and a max length
     * @spec.when  its accessors are read and a too-long value is validated
     * @spec.then  it binds the path, exposes the affix surface, and enforces the length rule
     */
    @Test
    void text_input_binds_path_carries_affixes_and_enforces_max_length() {
        TextInput field =
                TextInput.make("postal_code")
                        .helperText("Five digits")
                        .prefix("#")
                        .maxLength(5);

        assertThat(field.statePath()).isEqualTo("postal_code");
        assertThat(field.label()).isEqualTo("Postal Code");
        assertThat(field.helperText()).isEqualTo("Five digits");
        assertThat(field.prefix()).isEqualTo("#");
        assertThat(field.maxLength()).isEqualTo(5);

        SchemaState state = SchemaState.of(Map.of("postal_code", "123456"));
        assertThat(field.validate(state, ctx(Map.of()))).isPresent();
    }

    /**
     * @spec.given a TextInput made an email type
     * @spec.when  an invalid email is validated
     * @spec.then  the type wired the email format rule
     */
    @Test
    void text_input_email_type_wires_the_email_rule() {
        TextInput field = TextInput.make("email").email();

        assertThat(field.type()).isEqualTo(TextInput.Type.EMAIL);
        SchemaState state = SchemaState.of(Map.of("email", "nope"));
        assertThat(field.validate(state, ctx(Map.of()))).isPresent();
    }

    /**
     * @spec.given a Checkbox
     * @spec.when  a raw "true"/"false" wire value is read back through the field
     * @spec.then  the boolean cast round-trips it to a real Boolean
     */
    @Test
    void checkbox_casts_wire_strings_to_a_boolean() {
        Checkbox field = Checkbox.make("active");

        assertThat(field.read(SchemaState.of(Map.of("active", "true")))).isTrue();
        assertThat(field.read(SchemaState.of(Map.of("active", "false")))).isFalse();
    }

    /**
     * @spec.given a Radio with an inline option set
     * @spec.when  the options and layout are read
     * @spec.then  the single-choice field exposes the options in order and the inline flag
     */
    @Test
    void radio_carries_an_inline_option_set() {
        Radio field =
                Radio.make("plan")
                        .inline()
                        .options(List.of(SelectOption.of("free", "Free"), SelectOption.of("pro", "Pro")));

        assertThat(field.isInline()).isTrue();
        assertThat(field.options()).extracting(SelectOption::value).containsExactly("free", "pro");
    }

    /**
     * @spec.given a searchable CheckboxList
     * @spec.when  a comma-joined wire value is read back
     * @spec.then  the multi-value cast hydrates it to a list and the search flag is set
     */
    @Test
    void checkbox_list_binds_a_list_of_values() {
        CheckboxList field =
                CheckboxList.make("tags")
                        .searchable()
                        .options(List.of(SelectOption.of("a", "A"), SelectOption.of("b", "B")));

        assertThat(field.isSearchable()).isTrue();
        assertThat(field.read(SchemaState.of(Map.of("tags", "a,b")))).containsExactly("a", "b");
    }

    /**
     * @spec.given a searchable, multiple Select with a REACTIVE option set keyed on country
     * @spec.when  options are resolved with the live country set to IT then FR
     * @spec.then  the options recompute from the live state (dependent dropdown)
     */
    @Test
    void select_resolves_reactive_options_from_live_state() {
        Select field =
                Select.make("region")
                        .searchable()
                        .multiple()
                        .optionsUsing(
                                c ->
                                        c.getString("country").equals("IT")
                                                ? List.of(SelectOption.of("er", "Emilia-Romagna"))
                                                : List.of(SelectOption.of("idf", "Île-de-France")));

        assertThat(field.isMultiple()).isTrue();
        assertThat(field.isSearchable()).isTrue();
        assertThat(field.resolveOptions(ctx(Map.of("country", "IT"))))
                .extracting(SelectOption::value)
                .containsExactly("er");
        assertThat(field.resolveOptions(ctx(Map.of("country", "FR"))))
                .extracting(SelectOption::value)
                .containsExactly("idf");
    }

    /**
     * @spec.given a multiple, image-only FileUpload with an accept list and a max size
     * @spec.when  its constraints are read
     * @spec.then  the field exposes multiple/image/accepted-types/max-size
     */
    @Test
    void file_upload_carries_its_constraints() {
        FileUpload field =
                FileUpload.make("photos")
                        .multiple()
                        .image()
                        .acceptedFileTypes(List.of("image/png", "image/jpeg"))
                        .maxSize(2048);

        assertThat(field.isMultiple()).isTrue();
        assertThat(field.isImage()).isTrue();
        assertThat(field.acceptedFileTypes()).containsExactly("image/png", "image/jpeg");
        assertThat(field.maxSizeKb()).isEqualTo(2048);
        assertThat(field.statePath()).isEqualTo("photos");
    }

    /**
     * @spec.given a required field that is hidden
     * @spec.when  it is validated
     * @spec.then  a hidden field is not validated (its rules do not fire)
     */
    @Test
    void a_hidden_field_is_not_validated() {
        TextInput field = TextInput.make("vat").required().hidden(true);

        assertThat(field.validate(SchemaState.empty(), ctx(Map.of()))).isEmpty();
    }
}
