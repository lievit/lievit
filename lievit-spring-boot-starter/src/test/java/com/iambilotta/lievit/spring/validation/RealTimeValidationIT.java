/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package com.iambilotta.lievit.spring.validation;

import static com.iambilotta.lievit.test.Lievit.test;

import org.junit.jupiter.api.Test;

import com.iambilotta.lievit.test.LievitTest;

/**
 * Real-time server-side validation end-to-end roundtrip (Lievit.test() harness, ADR-0010). Proves:
 *
 * <ul>
 *   <li>An invalid field produces per-field errors in the {@code Lievit-Effects} {@code errors}
 *       bag, readable via {@code assertHasError}.
 *   <li>The action is skipped when validation fails (the form is not submitted).
 *   <li>Fixing the field clears the error ({@code assertNoErrors}).
 *   <li>A valid submit (both fields valid) runs the action (no errors, submit succeeds).
 * </ul>
 *
 * <p>Uses {@link ValidationTestApp}, which activates the autoconfiguration's
 * {@code BeanValidationFieldValidator} (Hibernate Validator on the classpath). The component
 * annotates its {@code @Wire email} and {@code @Wire name} fields with {@code @Email} / {@code
 * @NotBlank} / {@code @Size}. Debounce is a client concern; the server validates on every wire call
 * (idempotent: same input always same result).
 */
@LievitTest(classes = ValidationTestApp.class)
class RealTimeValidationIT {

    /**
     * @spec.given a mounted registration form with an empty email (invalid)
     * @spec.when  the client sends a live update with a blank email via a no-action wire call
     * @spec.then  the effects bag carries an "email" error and the action did not run (submitted
     *     stays false), proving validation fires before actions and is server-authoritative
     */
    @Test
    void invalid_email_produces_an_error_effect_and_skips_the_action() {
        test(RegistrationComponent.class)
                .mount()
                .model("email", "not-an-email")
                .model("name", "Alice")
                .call("submit")
                .assertHasError("email", "valid email")
                .assertNoErrors("name");
    }

    /**
     * @spec.given a mounted registration form
     * @spec.when  the client sends a live update with a blank name (invalid)
     * @spec.then  the effects bag carries a "name" error; the email field (valid) has no error
     */
    @Test
    void blank_name_produces_a_name_error_only() {
        test(RegistrationComponent.class)
                .mount()
                .model("email", "user@example.com")
                .model("name", "")
                .call("submit")
                .assertHasError("name", "required")
                .assertNoErrors("email");
    }

    /**
     * @spec.given a mounted registration form with an invalid email
     * @spec.when  the client sends a corrected (valid) email
     * @spec.then  the error is cleared (no errors for email): fixing the input clears the error
     */
    @Test
    void fixing_the_email_clears_the_error() {
        test(RegistrationComponent.class)
                .mount()
                // First: invalid
                .model("email", "bad")
                .model("name", "Alice")
                .call("submit")
                .assertHasError("email", "valid email")
                // Second: fixed
                .model("email", "alice@example.com")
                .model("name", "Alice")
                .call("submit")
                .assertNoErrors();
    }

    /**
     * @spec.given a mounted registration form with both fields valid
     * @spec.when  the client submits
     * @spec.then  no errors are returned and the action ran (assertWireMatches shows submitted=true)
     */
    @Test
    void valid_form_has_no_errors_and_action_runs() {
        test(RegistrationComponent.class)
                .mount()
                .model("email", "user@example.com")
                .model("name", "Alice")
                .call("submit")
                .assertNoErrors()
                .assertWireMatches(comp -> comp.submitted);
    }

    /**
     * @spec.given the same invalid input sent twice (idempotency check)
     * @spec.when  two consecutive wire calls send the same invalid email
     * @spec.then  both return the same error (same input → same errors, validation is idempotent)
     */
    @Test
    void validation_is_idempotent_same_input_same_error() {
        test(RegistrationComponent.class)
                .mount()
                .model("email", "bad")
                .model("name", "Alice")
                .call("submit")
                .assertHasError("email", "valid email")
                // Repeat the same input.
                .model("email", "bad")
                .model("name", "Alice")
                .call("submit")
                .assertHasError("email", "valid email");
    }
}
