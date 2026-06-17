/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package com.iambilotta.lievit.kit;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * The render view-model the kit derives from a {@link Resource}'s {@link Form} for the create / edit
 * page: the heading, one {@link FieldView} per declared field (its label, current string value, and
 * any submit-time errors), and the record-level errors not tied to a single field. Pure data the JTE
 * form template iterates; it carries no engine knowledge.
 *
 * @param heading the form heading
 * @param editing whether this is an edit ({@code true}) or a create ({@code false})
 * @param fields one view per declared form field, in declaration order
 * @param recordErrors the validation errors not tied to a single field (empty when valid)
 */
public record AdminFormView(
        String heading, boolean editing, List<FieldView> fields, List<String> recordErrors) {

    /** Compact constructor: defends the lists. */
    public AdminFormView {
        fields = List.copyOf(fields);
        recordErrors = List.copyOf(recordErrors);
    }

    /**
     * One rendered field: its bound name, display label, type tag (so the template picks the right
     * input), the current string value, and any errors against it.
     *
     * @param name the bound field name
     * @param label the display label
     * @param type the field's simple type name (e.g. {@code "TextField"}); drives the input markup
     * @param value the current string value (empty on a fresh create)
     * @param errors the submit-time error messages against this field (empty when valid)
     */
    public record FieldView(
            String name, String label, String type, String value, List<String> errors) {
        /** Compact constructor: defends the error list. */
        public FieldView {
            errors = List.copyOf(errors);
        }

        /** @return whether this field has at least one error */
        public boolean hasErrors() {
            return !errors.isEmpty();
        }
    }

    /**
     * Builds the form view-model.
     *
     * @param form the resource's form
     * @param editing whether this is an edit page
     * @param values the current field values keyed by field name (empty on a fresh create)
     * @param errors the submit-time errors to surface (empty when first rendering or when valid)
     * @param <T> the row type
     * @return the view-model
     */
    public static <T> AdminFormView of(
            Form<T> form, boolean editing, Map<String, String> values, List<FieldError> errors) {
        Map<String, List<String>> byField = new LinkedHashMap<>();
        List<String> recordErrors = new ArrayList<>();
        for (FieldError error : errors) {
            if (error.field().isEmpty()) {
                recordErrors.add(error.message());
            } else {
                byField.computeIfAbsent(error.field(), f -> new ArrayList<>()).add(error.message());
            }
        }

        List<FieldView> fieldViews = new ArrayList<>();
        for (Field field : form.fields()) {
            String value = values.getOrDefault(field.name(), "");
            List<String> fieldErrors = byField.getOrDefault(field.name(), List.of());
            fieldViews.add(
                    new FieldView(
                            field.name(),
                            field.label(),
                            field.getClass().getSimpleName(),
                            value,
                            fieldErrors));
        }

        String heading = form.heading() == null ? (editing ? "Edit" : "Create") : form.heading();
        return new AdminFormView(heading, editing, fieldViews, recordErrors);
    }

    /**
     * Builds the form view-model for a fresh create page (no values, no errors).
     *
     * @param form the resource's form
     * @param <T> the row type
     * @return the view-model
     */
    public static <T> AdminFormView forCreate(Form<T> form) {
        return of(form, false, Map.of(), List.of());
    }

    /**
     * Builds the form view-model for an edit page, prefilled from an existing record.
     *
     * @param form the resource's form (must carry a {@link FormBinder})
     * @param record the record being edited
     * @param <T> the row type
     * @return the view-model
     */
    public static <T> AdminFormView forEdit(Form<T> form, T record) {
        return of(form, true, form.stateOf(record), List.of());
    }

    /**
     * Re-renders a form view after a failed submit: keeps the submitted values and shows the errors.
     *
     * @param form the resource's form
     * @param editing whether this is an edit page
     * @param submitted the values the user just submitted (kept so they are not lost)
     * @param errors the validation errors that blocked the save (non-empty)
     * @param <T> the row type
     * @return the view-model
     */
    public static <T> AdminFormView withErrors(
            Form<T> form,
            boolean editing,
            Map<String, String> submitted,
            List<FieldError> errors) {
        return of(form, editing, submitted, errors);
    }
}
