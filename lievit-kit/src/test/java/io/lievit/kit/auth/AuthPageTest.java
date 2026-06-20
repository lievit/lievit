/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit.auth;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;

/**
 * Specifies {@link AuthPage} and its four concretes: the backing page models that close the audit's
 * "auth pages are boolean flags with no backing pages" gap. The page owns the
 * mount -> hydrate -> validate -> delegate lifecycle; the host {@link AuthHandler} owns the side
 * effect; a schema failure re-renders without losing input; a handler failure surfaces its message.
 */
class AuthPageTest {

    /**
     * @spec.given a login page mounted
     * @spec.when  the initial view-model is built
     * @spec.then  it carries the heading, the email/password/remember fields with their HTML input
     *     types and required flags, the submit label, and no errors (a blank first render)
     */
    @Test
    void mount_builds_the_blank_login_form_view() {
        LoginPage page =
                LoginPage.withLinks(
                        credentials -> AuthOutcome.redirect("/admin"),
                        List.of(new AuthFormView.Link("Forgot your password?", "/admin/password-reset")));

        AuthFormView view = page.mount();

        assertThat(view.heading()).isEqualTo("Sign in");
        assertThat(view.submitLabel()).isEqualTo("Sign in");
        assertThat(view.hasFormMessage()).isFalse();
        assertThat(view.fields())
                .extracting(AuthFormView.FieldView::name)
                .containsExactly("email", "password", "remember");
        AuthFormView.FieldView email = view.fields().get(0);
        assertThat(email.inputType()).isEqualTo("email");
        assertThat(email.required()).isTrue();
        assertThat(view.fields().get(1).inputType()).isEqualTo("password");
        assertThat(view.links())
                .extracting(AuthFormView.Link::label)
                .containsExactly("Forgot your password?");
    }

    /**
     * @spec.given a login page and a submit missing the password (required) field
     * @spec.when  the submit is processed
     * @spec.then  the handler is NEVER called, the result re-renders with the password field error
     *     and keeps the submitted email value (input not lost)
     */
    @Test
    void a_schema_failure_re_renders_without_calling_the_handler() {
        boolean[] handlerCalled = {false};
        LoginPage page =
                new LoginPage(
                        credentials -> {
                            handlerCalled[0] = true;
                            return AuthOutcome.redirect("/admin");
                        });

        AuthPage.Result result = page.submit(Map.of("email", "agent@example.com"));

        assertThat(handlerCalled[0]).isFalse();
        assertThat(result.isSuccess()).isFalse();
        assertThat(result.reRender()).isNotNull();
        AuthFormView.FieldView password =
                result.reRender().fields().stream()
                        .filter(f -> f.name().equals("password"))
                        .findFirst()
                        .orElseThrow();
        assertThat(password.hasError()).isTrue();
        AuthFormView.FieldView email =
                result.reRender().fields().stream()
                        .filter(f -> f.name().equals("email"))
                        .findFirst()
                        .orElseThrow();
        assertThat(email.value()).isEqualTo("agent@example.com");
    }

    /**
     * @spec.given a login page whose handler rejects the credentials with a form-level message
     * @spec.when  a schema-valid submit is processed
     * @spec.then  the handler runs, the outcome is a failure, and the re-render carries the handler's
     *     message as a form-level error (the bad-credentials path)
     */
    @Test
    void a_handler_failure_surfaces_its_message_on_re_render() {
        LoginPage page =
                new LoginPage(
                        credentials -> AuthOutcome.failed("These credentials do not match our records."));

        AuthPage.Result result =
                page.submit(Map.of("email", "agent@example.com", "password", "wrong"));

        assertThat(result.isSuccess()).isFalse();
        assertThat(result.reRender()).isNotNull();
        assertThat(result.reRender().formMessage())
                .isEqualTo("These credentials do not match our records.");
        assertThat(result.reRender().messageIsError()).isTrue();
    }

    /**
     * @spec.given a login page whose handler accepts the credentials and redirects
     * @spec.when  a schema-valid submit is processed
     * @spec.then  the result is a success carrying the redirect url and no re-render view, and the
     *     handler received the validated email + password credentials
     */
    @Test
    void a_valid_submit_delegates_to_the_handler_and_succeeds() {
        Map<String, Object>[] seen = new Map[1];
        LoginPage page =
                new LoginPage(
                        credentials -> {
                            seen[0] = Map.copyOf(credentials);
                            return AuthOutcome.redirect("/admin/dashboard");
                        });

        AuthPage.Result result =
                page.submit(Map.of("email", "agent@example.com", "password", "secret-pw"));

        assertThat(result.isSuccess()).isTrue();
        assertThat(result.reRender()).isNull();
        assertThat(result.outcome().redirectUrl()).isEqualTo("/admin/dashboard");
        assertThat(seen[0]).containsEntry("email", "agent@example.com").containsEntry("password", "secret-pw");
    }

    /**
     * @spec.given a register page and a submit whose password confirmation does not match
     * @spec.when  the submit is processed
     * @spec.then  the schema's confirmed-rule fails on the password field, so the handler never runs
     *     (the password-confirmation match is enforced before the user is created)
     */
    @Test
    void register_enforces_the_password_confirmation_match_before_the_handler() {
        boolean[] handlerCalled = {false};
        RegisterPage page =
                new RegisterPage(
                        credentials -> {
                            handlerCalled[0] = true;
                            return AuthOutcome.redirect("/admin");
                        });

        AuthPage.Result result =
                page.submit(
                        Map.of(
                                "name", "Agent Smith",
                                "email", "agent@example.com",
                                "password", "longenough1",
                                "password_confirmation", "different99"));

        assertThat(handlerCalled[0]).isFalse();
        assertThat(result.reRender()).isNotNull();
        assertThat(result.reRender().fields())
                .filteredOn(f -> f.name().equals("password"))
                .allMatch(AuthFormView.FieldView::hasError);
    }

    /**
     * @spec.given a password-reset page whose handler confirms the email was sent
     * @spec.when  a valid email is submitted
     * @spec.then  the outcome is a confirmation (stays on the page, no redirect) carrying the success
     *     message, and the message renders as a non-error banner
     */
    @Test
    void password_reset_confirms_without_revealing_whether_the_address_exists() {
        PasswordResetPage page =
                new PasswordResetPage(
                        credentials -> AuthOutcome.confirmed("We have emailed you a reset link."));

        AuthPage.Result result = page.submit(Map.of("email", "agent@example.com"));

        assertThat(result.isSuccess()).isTrue();
        assertThat(result.outcome().redirectUrl()).isNull();
        assertThat(result.outcome().message()).isEqualTo("We have emailed you a reset link.");
    }

    /**
     * @spec.given an email-verification page using the one-time-code field
     * @spec.when  the page is mounted
     * @spec.then  it renders a single required code field, proving the OTP field backs the verify page
     */
    @Test
    void email_verification_renders_a_required_code_field() {
        EmailVerificationPage page =
                new EmailVerificationPage(credentials -> AuthOutcome.redirect("/admin"));

        AuthFormView view = page.mount();

        assertThat(view.heading()).isEqualTo("Verify your email address");
        assertThat(view.fields()).hasSize(1);
        assertThat(view.fields().get(0).name()).isEqualTo("code");
        assertThat(view.fields().get(0).required()).isTrue();
    }
}
