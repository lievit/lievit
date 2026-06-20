/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit.auth;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;

import org.jspecify.annotations.Nullable;

import io.lievit.kit.schema.SchemaField;
import io.lievit.kit.schema.SchemaForm;
import io.lievit.kit.schema.SchemaState;

/**
 * The render view-model an {@link AuthPage} produces: the heading, one {@link FieldView} per declared
 * schema field (its bound name, label, HTML input type, current value, required flag and any
 * submit-time errors), the form-level message, the submit button label, and the navigation links
 * (for example "Forgot your password?" / "Already registered?"). Pure data the JTE auth template
 * iterates; it carries no engine knowledge, the silent-slot lesson: the template paints the resolved
 * strings.
 *
 * @param heading the page heading
 * @param fields one view per declared field, in declaration order
 * @param formMessage a form-level message (a failure reason or a success banner), or {@code null}
 * @param messageIsError whether {@link #formMessage} is an error (vs a success/confirmation banner)
 * @param submitLabel the submit button label
 * @param links the secondary navigation links (label + url), in display order
 */
public record AuthFormView(
        String heading,
        List<FieldView> fields,
        @Nullable String formMessage,
        boolean messageIsError,
        String submitLabel,
        List<Link> links) {

    /** Compact constructor: defends the lists + required text. */
    public AuthFormView {
        Objects.requireNonNull(heading, "heading");
        Objects.requireNonNull(submitLabel, "submitLabel");
        fields = List.copyOf(fields);
        links = List.copyOf(links);
    }

    /**
     * One rendered auth field.
     *
     * @param name the bound field name (the schema state path)
     * @param label the display label
     * @param inputType the HTML input type ({@code text} / {@code email} / {@code password})
     * @param value the current string value (kept across a failed submit so the user does not retype)
     * @param required whether the field is required
     * @param error the submit-time error against this field, or {@code null}
     */
    public record FieldView(
            String name,
            String label,
            String inputType,
            String value,
            boolean required,
            @Nullable String error) {

        /** @return whether this field carries an error */
        public boolean hasError() {
            return error != null;
        }
    }

    /**
     * One secondary navigation link of the auth page.
     *
     * @param label the link text
     * @param url the href
     */
    public record Link(String label, String url) {

        /** Compact constructor: defends the fields. */
        public Link {
            Objects.requireNonNull(label, "label");
            Objects.requireNonNull(url, "url");
        }
    }

    /**
     * Builds the view-model from the page's schema, the current state, and the submit-time field
     * errors (empty on first render).
     *
     * @param heading the page heading
     * @param form the page's schema form
     * @param state the live state (carries the current field values)
     * @param fieldErrors the per-field errors keyed by state path (empty when first rendering or valid)
     * @param formMessage a form-level message, or {@code null}
     * @param messageIsError whether {@code formMessage} is an error
     * @param submitLabel the submit label
     * @param links the secondary links
     * @return the view-model
     */
    public static AuthFormView of(
            String heading,
            SchemaForm form,
            SchemaState state,
            Map<String, String> fieldErrors,
            @Nullable String formMessage,
            boolean messageIsError,
            String submitLabel,
            List<Link> links) {
        List<FieldView> views = new ArrayList<>();
        for (SchemaField<?, ?> field : form.fields()) {
            String name = field.statePath() == null ? field.label() : field.statePath();
            String value = state.getString(name);
            views.add(
                    new FieldView(
                            name,
                            field.label(),
                            inputType(field),
                            value,
                            field.isRequired(),
                            fieldErrors.get(name)));
        }
        return new AuthFormView(heading, views, formMessage, messageIsError, submitLabel, links);
    }

    private static String inputType(SchemaField<?, ?> field) {
        if (field instanceof io.lievit.kit.schema.TextInput input) {
            return input.type().html();
        }
        return "text";
    }

    /** @return whether the view carries a form-level message */
    public boolean hasFormMessage() {
        return formMessage != null;
    }

    /** @return whether the view carries any secondary link */
    public boolean hasLinks() {
        return !links.isEmpty();
    }
}
