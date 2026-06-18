/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.spring.validation;

import static io.lievit.test.Lievit.test;

import org.junit.jupiter.api.Test;

import io.lievit.test.LievitTest;

/**
 * Validation-depth end-to-end (ADR-0038, #185 + #187), over the real wire pipeline: real-time
 * per-field validation ({@code validateOnly} on a live update surfaces only the updated field's
 * error), the {@code validate}-everything submit path, and the imperative cross-field error bag
 * ({@code addError}). Builds on the shipped Bean Validation + FieldValidator stack, no parallel
 * engine.
 */
@LievitTest(classes = ValidationTestApp.class)
class ValidationDepthIT {

    /**
     * @spec.given a mounted signup form, both email and password still empty (both invalid)
     * @spec.when  the client live-updates only the email to an invalid value, with no action
     * @spec.then  only the email error surfaces (validateOnly): the empty password's error is NOT
     *     surfaced because the user has not reached that field yet
     * @spec.adr   ADR-0038
     * @spec.us    US-validate-only-one-field
     */
    @Test
    void a_live_update_surfaces_only_the_updated_fields_error() {
        test(SignupComponent.class)
                .mount()
                .model("email", "not-an-email")
                .update()
                .assertHasError("email", "valid email")
                .assertNoErrors("password");
    }

    /**
     * @spec.given a mounted signup form
     * @spec.when  the client live-updates only the password to a valid value, with no action
     * @spec.then  no error surfaces for the still-empty email (validateOnly does not validate it),
     *     and the password is clean
     * @spec.adr   ADR-0038
     * @spec.us    US-validate-only-one-field
     */
    @Test
    void a_live_update_does_not_surface_an_untouched_fields_error() {
        test(SignupComponent.class)
                .mount()
                .model("password", "longenough")
                .update()
                .assertNoErrors("email")
                .assertNoErrors("password");
    }

    /**
     * @spec.given a mounted signup form with valid email + password but a mismatched confirmation
     * @spec.when  the client submits (the action runs because Bean Validation passes on each field)
     * @spec.then  the action's imperative addError surfaces a cross-field "must match" error on
     *     "confirm", proving the programmatic error bag rides the same effect channel
     * @spec.adr   ADR-0038
     * @spec.us    US-imperative-error-bag
     */
    @Test
    void submit_adds_a_cross_field_error_via_add_error() {
        test(SignupComponent.class)
                .mount()
                .model("email", "alice@example.com")
                .model("password", "s3cur3pw")
                .model("confirm", "different")
                .call("submit")
                .assertHasError("confirm", "must match");
    }

    /**
     * @spec.given a mounted signup form with matching valid email, password, and confirmation
     * @spec.when  the client submits
     * @spec.then  no errors and the action ran (submitted is set): the full validate path plus the
     *     passing cross-field check let the submit through
     * @spec.adr   ADR-0038
     * @spec.us    US-imperative-error-bag
     */
    @Test
    void a_fully_valid_form_submits_with_no_errors() {
        test(SignupComponent.class)
                .mount()
                .model("email", "alice@example.com")
                .model("password", "s3cur3pw")
                .model("confirm", "s3cur3pw")
                .call("submit")
                .assertNoErrors()
                .assertWireMatches(comp -> comp.submitted);
    }
}
