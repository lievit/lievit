/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package com.iambilotta.lievit.component;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;

import com.iambilotta.lievit.LievitAction;
import com.iambilotta.lievit.LievitComponent;
import com.iambilotta.lievit.Wire;

/**
 * Specifies the real-time validation-to-effect mapping in the {@link WireDispatcher}: a
 * {@link FieldValidator} that returns errors causes them to appear as the {@code errors} effect in
 * the {@link LievitEffects} sink, and the actions are skipped. A passing validator produces no
 * errors effect and the action runs normally.
 */
class FieldValidatorTest {

    @LievitComponent(template = "reg")
    static class RegistrationComponent {

        @Wire String email = "";
        boolean submitted = false;

        @LievitAction
        void submit() {
            this.submitted = true;
        }
    }

    /**
     * @spec.given a component with an email field set to an invalid value by a client update
     * @spec.when  the dispatcher runs a wire call whose FieldValidator returns an error for "email"
     * @spec.then  the effects sink carries the validation errors and the action is skipped (the
     *     submit flag stays false), proving that validation fires before actions and is authoritative
     */
    @Test
    void validation_errors_appear_in_effects_and_actions_are_skipped() {
        FieldValidator validator =
                instance -> {
                    RegistrationComponent comp = (RegistrationComponent) instance;
                    if (comp.email == null || !comp.email.contains("@")) {
                        return Map.of("email", List.of("must be a valid email address"));
                    }
                    return Map.of();
                };

        WireDispatcher dispatcher =
                new WireDispatcher(new com.iambilotta.lievit.wire.PayloadGuard(), validator);
        ComponentMetadata meta = ComponentMetadata.of(RegistrationComponent.class);
        RegistrationComponent instance = new RegistrationComponent();

        WireCall result =
                dispatcher.call(
                        meta,
                        instance,
                        Map.of("email", ""),
                        Map.of("email", "not-an-email"),
                        List.of("submit"));

        // The errors effect is set.
        assertThat(result.effects().validationErrors())
                .containsKey("email")
                .extractingByKey("email")
                .asList()
                .containsExactly("must be a valid email address");

        // The action did not run (submitted stays false).
        assertThat(instance.submitted).isFalse();
    }

    /**
     * @spec.given a component with a valid email field
     * @spec.when  the dispatcher runs a wire call whose FieldValidator returns no errors
     * @spec.then  the effects sink has no validation errors and the action runs (submit flag is true)
     */
    @Test
    void no_validation_errors_when_input_is_valid_and_action_runs() {
        FieldValidator validator =
                instance -> {
                    RegistrationComponent comp = (RegistrationComponent) instance;
                    if (comp.email == null || !comp.email.contains("@")) {
                        return Map.of("email", List.of("must be a valid email address"));
                    }
                    return Map.of();
                };

        WireDispatcher dispatcher =
                new WireDispatcher(new com.iambilotta.lievit.wire.PayloadGuard(), validator);
        ComponentMetadata meta = ComponentMetadata.of(RegistrationComponent.class);
        RegistrationComponent instance = new RegistrationComponent();

        WireCall result =
                dispatcher.call(
                        meta,
                        instance,
                        Map.of("email", ""),
                        Map.of("email", "user@example.com"),
                        List.of("submit"));

        // No errors.
        assertThat(result.effects().validationErrors()).isNull();
        // The action ran.
        assertThat(instance.submitted).isTrue();
    }

    /**
     * @spec.given a component and the no-op validator (default)
     * @spec.when  the dispatcher runs a wire call with any input
     * @spec.then  the no-op produces no errors and the action runs: zero overhead when validation
     *     is not configured
     */
    @Test
    void no_op_validator_produces_no_errors_and_runs_action() {
        WireDispatcher dispatcher = new WireDispatcher(); // uses NoOpFieldValidator
        ComponentMetadata meta = ComponentMetadata.of(RegistrationComponent.class);
        RegistrationComponent instance = new RegistrationComponent();

        WireCall result =
                dispatcher.call(
                        meta,
                        instance,
                        Map.of("email", ""),
                        Map.of("email", "not-valid"),
                        List.of("submit"));

        assertThat(result.effects().validationErrors()).isNull();
        assertThat(instance.submitted).isTrue();
    }

    /**
     * @spec.given a component and a validator that clears errors when the input is fixed
     * @spec.when  first call has an invalid email (errors returned), second call has a valid one
     * @spec.then  the second call has no errors (same input always yields same result: idempotent)
     */
    @Test
    void validation_is_idempotent_same_input_same_errors() {
        FieldValidator validator =
                instance -> {
                    RegistrationComponent comp = (RegistrationComponent) instance;
                    if (comp.email == null || !comp.email.contains("@")) {
                        return Map.of("email", List.of("must be a valid email address"));
                    }
                    return Map.of();
                };

        WireDispatcher dispatcher =
                new WireDispatcher(new com.iambilotta.lievit.wire.PayloadGuard(), validator);
        ComponentMetadata meta = ComponentMetadata.of(RegistrationComponent.class);

        // Invalid input → errors.
        WireCall first =
                dispatcher.call(
                        meta,
                        new RegistrationComponent(),
                        Map.of("email", ""),
                        Map.of("email", "bad"),
                        List.of());
        assertThat(first.effects().validationErrors()).containsKey("email");

        // Same invalid input again → same errors (idempotent).
        WireCall again =
                dispatcher.call(
                        meta,
                        new RegistrationComponent(),
                        Map.of("email", ""),
                        Map.of("email", "bad"),
                        List.of());
        assertThat(again.effects().validationErrors())
                .isEqualTo(first.effects().validationErrors());

        // Valid input → no errors.
        WireCall fixed =
                dispatcher.call(
                        meta,
                        new RegistrationComponent(),
                        Map.of("email", ""),
                        Map.of("email", "user@example.com"),
                        List.of());
        assertThat(fixed.effects().validationErrors()).isNull();
    }
}
