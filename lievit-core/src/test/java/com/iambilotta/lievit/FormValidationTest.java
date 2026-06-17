/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package com.iambilotta.lievit;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Specifies the Bean Validation integration on {@link LievitFormObject}: a valid form returns an
 * empty result, a form with violations returns a result keyed by field name, and
 * {@link FormValidationResult} helper methods work correctly (ADR-0015).
 */
class FormValidationTest {

    // --- Fixture ------------------------------------------------------------

    public static class RegisterForm implements LievitFormObject {
        @NotBlank(message = "Email is required")
        @Email(message = "Email must be valid")
        public String email = "";

        @NotBlank(message = "Password is required")
        @Size(min = 8, message = "Password must be at least 8 characters")
        public String password = "";

        public String confirm = ""; // no constraints: always passes
    }

    // --- Valid form ---------------------------------------------------------

    /**
     * @spec.given a RegisterForm whose fields satisfy all constraints
     * @spec.when  validate() is called
     * @spec.then  the result is valid (no violations)
     * @spec.adr   ADR-0015
     */
    @Test
    void valid_form_returns_empty_result() {
        RegisterForm form = new RegisterForm();
        form.email = "alice@example.com";
        form.password = "s3cur3pw";

        FormValidationResult result = form.validate();

        assertThat(result.isValid()).isTrue();
        assertThat(result.hasErrors()).isFalse();
        assertThat(result.violations()).isEmpty();
    }

    // --- Invalid email ------------------------------------------------------

    /**
     * @spec.given a RegisterForm with a blank email
     * @spec.when  validate() is called
     * @spec.then  the result carries a violation keyed by "email" (the field name)
     * @spec.adr   ADR-0015
     */
    @Test
    void blank_email_produces_violation_for_email_field() {
        RegisterForm form = new RegisterForm();
        form.email = "";
        form.password = "s3cur3pw";

        FormValidationResult result = form.validate();

        assertThat(result.hasErrors()).isTrue();
        assertThat(result.errorsFor("email")).isNotEmpty();
        assertThat(result.errorsFor("password")).isEmpty();
    }

    /**
     * @spec.given a RegisterForm with an invalid email format
     * @spec.when  validate() is called
     * @spec.then  the result carries an @Email violation keyed by "email"
     * @spec.adr   ADR-0015
     */
    @Test
    void invalid_email_format_produces_email_violation() {
        RegisterForm form = new RegisterForm();
        form.email = "not-an-email";
        form.password = "s3cur3pw";

        FormValidationResult result = form.validate();

        assertThat(result.hasErrors()).isTrue();
        assertThat(result.errorsFor("email")).anyMatch(m -> m.contains("valid"));
    }

    // --- Short password -----------------------------------------------------

    /**
     * @spec.given a RegisterForm with a password shorter than 8 characters
     * @spec.when  validate() is called
     * @spec.then  the result carries a @Size violation keyed by "password"
     * @spec.adr   ADR-0015
     */
    @Test
    void short_password_produces_violation_for_password_field() {
        RegisterForm form = new RegisterForm();
        form.email = "alice@example.com";
        form.password = "short";

        FormValidationResult result = form.validate();

        assertThat(result.hasErrors()).isTrue();
        assertThat(result.errorsFor("password")).anyMatch(m -> m.contains("8"));
    }

    // --- Multiple violations ------------------------------------------------

    /**
     * @spec.given a RegisterForm with both email and password invalid
     * @spec.when  validate() is called
     * @spec.then  the result carries violations for both fields; allErrors() includes all messages
     * @spec.adr   ADR-0015
     */
    @Test
    void multiple_invalid_fields_produce_violations_for_each() {
        RegisterForm form = new RegisterForm();
        form.email = "";
        form.password = "";

        FormValidationResult result = form.validate();

        assertThat(result.hasErrors()).isTrue();
        assertThat(result.errorsFor("email")).isNotEmpty();
        assertThat(result.errorsFor("password")).isNotEmpty();
        assertThat(result.allErrors()).hasSizeGreaterThanOrEqualTo(2);
    }

    // --- errorsFor on valid field -------------------------------------------

    /**
     * @spec.given a RegisterForm with only email invalid
     * @spec.when  errorsFor("confirm") is queried (confirm has no constraint and passes)
     * @spec.then  the result is an empty list (no violations for the valid field)
     * @spec.adr   ADR-0015
     */
    @Test
    void errors_for_returns_empty_list_for_valid_field() {
        RegisterForm form = new RegisterForm();
        form.email = "bad";
        form.password = "s3cur3pw";

        FormValidationResult result = form.validate();

        assertThat(result.errorsFor("confirm")).isEmpty();
        assertThat(result.errorsFor("nonExistent")).isEmpty();
    }

    // --- FormValidationResult.VALID -----------------------------------------

    /**
     * @spec.given the singleton VALID constant
     * @spec.when  its accessors are called
     * @spec.then  it is valid, has no errors, errorsFor returns empty, allErrors is empty
     * @spec.adr   ADR-0015
     */
    @Test
    void valid_constant_has_no_violations() {
        assertThat(FormValidationResult.VALID.isValid()).isTrue();
        assertThat(FormValidationResult.VALID.hasErrors()).isFalse();
        assertThat(FormValidationResult.VALID.errorsFor("anything")).isEmpty();
        assertThat(FormValidationResult.VALID.allErrors()).isEmpty();
    }
}
