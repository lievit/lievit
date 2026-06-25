/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;

/**
 * Specifies {@link AdminFormView}: it derives one field-view per declared form field (label, type
 * tag, current value, per-field errors), routes field-keyed errors to their field and field-less
 * errors to the record-level bucket, and keeps submitted values on a re-render after a failed submit.
 */
class AdminFormViewTest {

    static Form<Object> formWithCity() {
        return Form.create().heading("Listing").field(TextField.make("city"));
    }

    /**
     * @spec.given a form with one text field
     * @spec.when  a blank create view is built
     * @spec.then  the field appears with its label, its type tag, an empty value, and no errors
     * @spec.adr   ADR-0008
     */
    @Test
    void builds_a_blank_create_view_from_the_form_fields() {
        AdminFormView view = AdminFormView.forCreate(formWithCity());

        assertThat(view.editing()).isFalse();
        assertThat(view.fields()).hasSize(1);
        AdminFormView.FieldView field = view.fields().get(0);
        assertThat(field.name()).isEqualTo("city");
        assertThat(field.label()).isEqualTo("City");
        assertThat(field.type()).isEqualTo("TextField");
        assertThat(field.value()).isEmpty();
        assertThat(field.hasErrors()).isFalse();
    }

    /**
     * @spec.given a failed submit carrying a field error and a record-level error
     * @spec.when  the view is rebuilt with the submitted values and the errors
     * @spec.then  the field error lands on its field, the field-less error in recordErrors, and the
     *     submitted value is kept
     * @spec.adr   ADR-0008
     */
    @Test
    void routes_errors_to_their_field_and_keeps_submitted_values() {
        List<FieldError> errors =
                List.of(FieldError.of("city", "must not be blank"), FieldError.of("", "general"));

        AdminFormView view =
                AdminFormView.withErrors(formWithCity(), false, Map.of("city", "Parma"), errors);

        AdminFormView.FieldView field = view.fields().get(0);
        assertThat(field.value()).isEqualTo("Parma");
        assertThat(field.errors()).containsExactly("must not be blank");
        assertThat(view.recordErrors()).containsExactly("general");
    }
}
