/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit.schema;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;

import io.lievit.kit.support.EvaluationContext;
import io.lievit.kit.support.EvaluationContext.Operation;

/**
 * Specifies the validation rule surface: the conditional family ({@code requiredIf} reading live
 * state), cross-field comparisons ({@code gte}, {@code same}), the {@code unique}-ignores-current-
 * record-on-edit semantics, set membership, the custom-rule escape hatch, and
 * {@code mutateStateForValidation}.
 */
class ValidationRulesTest {

    private static EvaluationContext ctx(Operation op, Map<String, Object> state) {
        return EvaluationContext.readOnly(null, null, op, state);
    }

    private static EvaluationContext ctx(Map<String, Object> state) {
        return ctx(Operation.CREATE, state);
    }

    /**
     * @spec.given a requiredIf rule keyed on type=business
     * @spec.when  the value is empty under type=business then type=personal
     * @spec.then  it is evaluated against the live state: required only when the trigger matches
     */
    @Test
    void required_if_is_evaluated_against_live_state() {
        RuleSet set = RuleSet.create().rule(Rules.requiredIf("type", "business"));

        assertThat(set.validate("", ctx(Map.of("type", "business")))).isPresent();
        assertThat(set.validate("", ctx(Map.of("type", "personal")))).isEmpty();
        assertThat(set.validate("IT123", ctx(Map.of("type", "business")))).isEmpty();
    }

    /**
     * @spec.given a cross-field gte rule comparing against the sibling minPrice
     * @spec.when  the value is below then at the sibling's live value
     * @spec.then  it compares against the sibling field's live value
     */
    @Test
    void cross_field_gte_compares_against_a_sibling_live_value() {
        RuleSet set = RuleSet.create().rule(Rules.gte("minPrice"));

        assertThat(set.validate("5", ctx(Map.of("minPrice", "10")))).isPresent();
        assertThat(set.validate("12", ctx(Map.of("minPrice", "10")))).isEmpty();
    }

    /**
     * @spec.given a unique rule and a store where "taken@x.com" belongs to the current record
     * @spec.when  validating that value on EDIT (current record) and on CREATE
     * @spec.then  EDIT ignores the current record by default; CREATE flags it as taken
     */
    @Test
    void unique_ignores_the_current_record_on_edit_but_not_on_create() {
        record User(String email) {}
        User current = new User("taken@x.com");
        // "another record holds it" only when the offered value differs from the current record's.
        RuleSet set =
                RuleSet.create()
                        .rule(
                                Rules.unique(
                                        (value, rec) -> {
                                            boolean valueExistsSomewhere = value.equals("taken@x.com");
                                            boolean isCurrentRecordsOwnValue =
                                                    rec instanceof User u && u.email().equals(value);
                                            return valueExistsSomewhere && !isCurrentRecordsOwnValue;
                                        }));

        EvaluationContext edit =
                EvaluationContext.readOnly("taken@x.com", current, Operation.EDIT, Map.of());
        EvaluationContext create =
                EvaluationContext.readOnly("taken@x.com", null, Operation.CREATE, Map.of());

        assertThat(set.validate("taken@x.com", edit)).isEmpty();
        assertThat(set.validate("taken@x.com", create)).isPresent();
    }

    /**
     * @spec.given an in rule over an allowed set
     * @spec.when  validating an allowed then a disallowed value
     * @spec.then  membership is enforced
     */
    @Test
    void set_membership_in_enforces_an_allowed_set() {
        RuleSet set = RuleSet.create().rule(Rules.in(List.of("draft", "published")));

        assertThat(set.validate("draft", ctx(Map.of()))).isEmpty();
        assertThat(set.validate("archived", ctx(Map.of()))).isPresent();
    }

    /**
     * @spec.given a same rule comparing password against password_confirmation
     * @spec.when  the two siblings differ then match
     * @spec.then  equality against the sibling's live value is enforced
     */
    @Test
    void same_enforces_equality_with_a_sibling() {
        RuleSet set = RuleSet.create().rule(Rules.same("password_confirmation"));

        assertThat(set.validate("a", ctx(Map.of("password_confirmation", "b")))).isPresent();
        assertThat(set.validate("a", ctx(Map.of("password_confirmation", "a")))).isEmpty();
    }

    /**
     * @spec.given a custom rule supplied as the escape hatch
     * @spec.when  it is added to a set and evaluated
     * @spec.then  an arbitrary kit constraint participates like a built-in
     */
    @Test
    void a_custom_rule_is_an_escape_hatch() {
        RuleSet set =
                RuleSet.create()
                        .rule((value, c) -> "EVEN".equals(value) ? null : "Must be EVEN.");

        assertThat(set.validate("EVEN", ctx(Map.of()))).isEmpty();
        assertThat(set.validate("ODD", ctx(Map.of()))).contains("Must be EVEN.");
    }

    /**
     * @spec.given a min rule and a mutateStateForValidation stripping a currency prefix
     * @spec.when  validating a raw "€ 5" value against min 3
     * @spec.then  the normalized value (5) is validated, not the raw string length
     */
    @Test
    void mutate_state_for_validation_validates_a_normalized_value() {
        RuleSet set =
                RuleSet.create()
                        .mutateStateForValidation(v -> String.valueOf(v).replace("€", "").trim())
                        .rule(Rules.gte("floor"));

        assertThat(set.validate("€ 5", ctx(Map.of("floor", "3")))).isEmpty();
        assertThat(set.validate("€ 2", ctx(Map.of("floor", "3")))).isPresent();
    }

    /**
     * @spec.given a required rule with a custom validation attribute name
     * @spec.when  it fails
     * @spec.then  the failure message uses the custom attribute name
     */
    @Test
    void a_custom_validation_attribute_is_used_in_the_message() {
        RuleSet set = RuleSet.create().validationAttribute("email address").rule(Rules.required());

        assertThat(set.validate("", ctx(Map.of()))).contains("The email address is required.");
    }

    /**
     * @spec.given email and url rules
     * @spec.when  validating well- and ill-formed values
     * @spec.then  format rules pass valid input and flag invalid (JSR-380-mapped formats)
     */
    @Test
    void format_rules_validate_email_and_url() {
        assertThat(RuleSet.create().rule(Rules.email()).validate("a@b.com", ctx(Map.of()))).isEmpty();
        assertThat(RuleSet.create().rule(Rules.email()).validate("nope", ctx(Map.of()))).isPresent();
        assertThat(RuleSet.create().rule(Rules.url()).validate("https://x.io", ctx(Map.of()))).isEmpty();
        assertThat(RuleSet.create().rule(Rules.url()).validate("x.io", ctx(Map.of()))).isPresent();
    }
}
