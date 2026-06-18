/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.component;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;

/**
 * Specifies {@link FieldValidator#validateOnly(Object, String)} (ADR-0038, Livewire
 * {@code validateOnly($field)} parity): validate the instance but surface only the named field's
 * violations, the seam that powers real-time per-field validation on a {@code wire:model} update
 * without leaking other still-invalid fields' errors to the client.
 */
class ValidateOnlyTest {

    /** A validator that always reports two invalid fields, to prove the filter. */
    private static final FieldValidator TWO_BAD_FIELDS =
            instance ->
                    Map.of(
                            "email", List.of("must be a valid email address"),
                            "name", List.of("must not be blank"));

    /**
     * @spec.given a validator reporting violations for both "email" and "name"
     * @spec.when  validateOnly is called for "email"
     * @spec.then  only the "email" violations are returned; "name" is filtered out (a fresh update to
     *     email must not surface the still-empty name's error)
     * @spec.adr   ADR-0038
     * @spec.us    US-validate-only-one-field
     */
    @Test
    void validate_only_returns_just_the_named_fields_violations() {
        Map<String, List<String>> only = TWO_BAD_FIELDS.validateOnly(new Object(), "email");

        assertThat(only).containsOnlyKeys("email");
        assertThat(only.get("email")).containsExactly("must be a valid email address");
    }

    /**
     * @spec.given a validator reporting violations only for "email"
     * @spec.when  validateOnly is called for the valid "name"
     * @spec.then  the result is empty: a field with no violation surfaces no error
     * @spec.adr   ADR-0038
     */
    @Test
    void validate_only_a_valid_field_returns_no_errors() {
        FieldValidator emailBad = instance -> Map.of("email", List.of("bad"));

        Map<String, List<String>> only = emailBad.validateOnly(new Object(), "name");

        assertThat(only).isEmpty();
    }

    /**
     * @spec.given a validator reporting a violation on a nested dotted path "form.email"
     * @spec.when  validateOnly is called for the form-object field "form.email"
     * @spec.then  the dotted path matches exactly and its violation is returned (form-object fields
     *     validate per dotted field, Livewire {@code form.email} parity)
     * @spec.adr   ADR-0038
     */
    @Test
    void validate_only_matches_a_dotted_form_object_field() {
        FieldValidator nested =
                instance ->
                        Map.of(
                                "form.email", List.of("must be valid"),
                                "form.password", List.of("too short"));

        Map<String, List<String>> only = nested.validateOnly(new Object(), "form.email");

        assertThat(only).containsOnlyKeys("form.email");
    }

    /**
     * @spec.given a validator reporting indexed array-element violations (items[0].qty, items[1].qty)
     * @spec.when  validateOnly is called with the star rule key "items.*.qty"
     * @spec.then  every indexed element matching the star pattern is returned: a single
     *     {@code items.*.qty} rule validates all array elements (Livewire dot-star parity)
     * @spec.adr   ADR-0038
     * @spec.us    US-array-element-rules
     */
    @Test
    void validate_only_with_a_star_rule_matches_all_array_elements() {
        FieldValidator indexed =
                instance ->
                        Map.of(
                                "items[0].qty", List.of("must be positive"),
                                "items[1].qty", List.of("must be positive"),
                                "name", List.of("blank"));

        Map<String, List<String>> only = indexed.validateOnly(new Object(), "items.*.qty");

        assertThat(only).containsOnlyKeys("items[0].qty", "items[1].qty");
    }
}
