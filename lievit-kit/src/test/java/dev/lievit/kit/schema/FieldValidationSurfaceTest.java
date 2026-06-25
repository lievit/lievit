/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit.schema;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;

import dev.lievit.kit.support.EvaluationContext;
import dev.lievit.kit.support.EvaluationContext.Operation;

/**
 * Specifies the field-level validation builder surface (the Filament {@code CanBeValidated} trait on
 * the base field, issue 217): the broadly-applicable rules every field can declare fluently
 * (membership, format, comparison, conditional, db-backed) plus the message/attribute customization,
 * built on the kit's {@link Rules} library and the inherited {@link RuleSet}. Field-type-specific
 * sugar (TextInput.minLength/maxLength) is tested with that field; this pins the shared surface.
 */
class FieldValidationSurfaceTest {

    private static EvaluationContext ctx(Map<String, Object> state) {
        return EvaluationContext.readOnly(null, null, Operation.CREATE, state);
    }

    /** A bare concrete field exercising the inherited validation builder surface. */
    static final class Probe extends SchemaField<String, Probe> {
        Probe(String name) {
            super(name);
        }
    }

    private static Probe field() {
        return new Probe("value");
    }

    /**
     * @spec.given a field with an in/notIn membership rule
     * @spec.when  validating allowed and disallowed values
     * @spec.then  the builder methods produce server-side membership validation
     */
    @Test
    void membership_in_and_not_in_validate_server_side() {
        Probe in = field().in(List.of("draft", "published"));
        assertThat(in.rules().validate("draft", ctx(Map.of()))).isEmpty();
        assertThat(in.rules().validate("archived", ctx(Map.of()))).isPresent();

        Probe notIn = field().notIn(List.of("reserved"));
        assertThat(notIn.rules().validate("ok", ctx(Map.of()))).isEmpty();
        assertThat(notIn.rules().validate("reserved", ctx(Map.of()))).isPresent();
    }

    /**
     * @spec.given a field with an email then a regex builder rule
     * @spec.when  validating well- and ill-formed values
     * @spec.then  the format builders produce validation
     */
    @Test
    void format_email_and_regex_builders_validate() {
        assertThat(field().email().rules().validate("a@b.com", ctx(Map.of()))).isEmpty();
        assertThat(field().email().rules().validate("nope", ctx(Map.of()))).isPresent();
        assertThat(field().regex("^[A-Z]+$").rules().validate("ABC", ctx(Map.of()))).isEmpty();
        assertThat(field().regex("^[A-Z]+$").rules().validate("abc", ctx(Map.of()))).isPresent();
    }

    /**
     * @spec.given fields with numeric and integer builder rules
     * @spec.when  validating numeric and non-numeric input
     * @spec.then  numeric accepts decimals, integer rejects a decimal
     */
    @Test
    void numeric_and_integer_builders_validate() {
        assertThat(field().numeric().rules().validate("3.5", ctx(Map.of()))).isEmpty();
        assertThat(field().numeric().rules().validate("x", ctx(Map.of()))).isPresent();
        assertThat(field().integer().rules().validate("3", ctx(Map.of()))).isEmpty();
        assertThat(field().integer().rules().validate("3.5", ctx(Map.of()))).isPresent();
    }

    /**
     * @spec.given a field with cross-field comparison builders (gt, lte, different)
     * @spec.when  validating against the sibling's live value
     * @spec.then  the comparisons resolve against sibling state paths
     */
    @Test
    void cross_field_comparison_builders_resolve_against_siblings() {
        assertThat(field().gt("floor").rules().validate("5", ctx(Map.of("floor", "3")))).isEmpty();
        assertThat(field().gt("floor").rules().validate("2", ctx(Map.of("floor", "3")))).isPresent();
        assertThat(field().lte("cap").rules().validate("5", ctx(Map.of("cap", "10")))).isEmpty();
        assertThat(field().lte("cap").rules().validate("12", ctx(Map.of("cap", "10")))).isPresent();
        assertThat(field().different("other").rules().validate("a", ctx(Map.of("other", "b")))).isEmpty();
        assertThat(field().different("other").rules().validate("a", ctx(Map.of("other", "a")))).isPresent();
    }

    /**
     * @spec.given a password field with a confirmed builder rule
     * @spec.when  the sibling {@code <name>_confirmation} differs then matches
     * @spec.then  confirmed enforces equality against the conventional confirmation sibling
     */
    @Test
    void confirmed_matches_the_confirmation_sibling() {
        Probe password = new Probe("password");
        password.confirmed();

        assertThat(password.rules().validate("secret", ctx(Map.of("password_confirmation", "other"))))
                .isPresent();
        assertThat(password.rules().validate("secret", ctx(Map.of("password_confirmation", "secret"))))
                .isEmpty();
    }

    /**
     * @spec.given a field with requiredIf and requiredWith conditional builders
     * @spec.when  the trigger sibling matches / is present
     * @spec.then  the field becomes required only under the condition
     */
    @Test
    void conditional_required_builders_read_live_state() {
        Probe ifField = field().requiredIf("type", "business");
        assertThat(ifField.rules().validate("", ctx(Map.of("type", "business")))).isPresent();
        assertThat(ifField.rules().validate("", ctx(Map.of("type", "personal")))).isEmpty();

        Probe withField = field().requiredWith("company");
        assertThat(withField.rules().validate("", ctx(Map.of("company", "Acme")))).isPresent();
        assertThat(withField.rules().validate("", ctx(Map.of()))).isEmpty();
    }

    /**
     * @spec.given a field with a db-backed unique builder ignoring the current record on edit
     * @spec.when  validating the current record's own value on EDIT then a clash on CREATE
     * @spec.then  unique ignores the current record on edit but flags a clash on create
     */
    @Test
    void unique_builder_ignores_the_current_record_on_edit() {
        record User(String email) {}
        User current = new User("taken@x.com");
        Probe email =
                field()
                        .unique(
                                (value, rec) ->
                                        value.equals("taken@x.com")
                                                && !(rec instanceof User u && u.email().equals(value)));

        EvaluationContext edit =
                EvaluationContext.readOnly("taken@x.com", current, Operation.EDIT, Map.of());
        EvaluationContext create =
                EvaluationContext.readOnly("taken@x.com", null, Operation.CREATE, Map.of());

        assertThat(email.rules().validate("taken@x.com", edit)).isEmpty();
        assertThat(email.rules().validate("taken@x.com", create)).isPresent();
    }

    /**
     * @spec.given a field with a db-backed exists builder
     * @spec.when  validating a present then an absent foreign key
     * @spec.then  exists validates the value against the backing store
     */
    @Test
    void exists_builder_validates_a_foreign_key() {
        Probe fk = field().exists(value -> value.equals("42"));
        assertThat(fk.rules().validate("42", ctx(Map.of()))).isEmpty();
        assertThat(fk.rules().validate("99", ctx(Map.of()))).isPresent();
    }

    /**
     * @spec.given a field with a custom validation message for a rule and a custom attribute
     * @spec.when  the rule fails
     * @spec.then  the custom message overrides the default, and the attribute customizes the default
     */
    @Test
    void validation_messages_and_attribute_customize_the_output() {
        Probe withMessage =
                field().email().validationMessages(Map.of("email", "Enter a real email."));
        assertThat(withMessage.rules().validate("nope", ctx(Map.of())))
                .contains("Enter a real email.");

        Probe withAttribute = field().required().validationAttribute("email address");
        assertThat(withAttribute.rules().validate("", ctx(Map.of())))
                .contains("The email address is required.");
    }

    /**
     * @spec.given a field with multiple rules added via rules(Rule...)
     * @spec.when  validating a value that fails the second rule
     * @spec.then  the batch builder adds every rule, evaluated in order
     */
    @Test
    void rules_varargs_adds_a_batch() {
        Probe f = field().rules(Rules.required(), Rules.email());
        assertThat(f.rules().validate("", ctx(Map.of()))).isPresent();
        assertThat(f.rules().validate("nope", ctx(Map.of()))).isPresent();
        assertThat(f.rules().validate("a@b.com", ctx(Map.of()))).isEmpty();
    }
}
