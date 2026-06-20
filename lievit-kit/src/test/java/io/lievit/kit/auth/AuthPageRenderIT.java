/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit.auth;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.TestPropertySource;

import io.lievit.spring.LievitWireService;
import io.lievit.spring.WireCallResult;

/**
 * The auth page render IT (the audit's top gap closed): the four backing {@link AuthPage} models are
 * driven through the REAL lievit runtime (codec + registry + dispatcher + JTE adapter), proving each
 * flag now backs a page that actually renders its credential fields and reacts to a submit, not a
 * boolean that renders nothing. Asserts the rendered DOM (the silent-slot lesson: the projected
 * markup, not the structure) and the submit effects (redirect / flash) end to end.
 *
 * <p>It boots a Spring context, so it is an {@code *IT} (the failsafe loop of ADR-0007).
 */
@SpringBootTest(classes = AuthTestApp.class)
@TestPropertySource(
        properties = {"lievit.signing-key=test-signing-key-0123456789abcdef-0123456789"})
class AuthPageRenderIT {

    @Autowired LievitWireService wireService;

    private static final ObjectMapper JSON = new ObjectMapper();

    private static final String LOGIN = LoginComponent.class.getName();
    private static final String REGISTER = RegisterComponent.class.getName();
    private static final String PASSWORD_RESET = PasswordResetComponent.class.getName();
    private static final String EMAIL_VERIFICATION = EmailVerificationComponent.class.getName();

    private JsonNode readEffects(WireCallResult result) {
        try {
            assertThat(result.effects()).as("expected an effects header").isNotNull();
            return JSON.readTree(result.effects());
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    /**
     * @spec.given the login page mounted through the runtime
     * @spec.when  the JTE template renders the initial form
     * @spec.then  the response is the login surface with the heading, the email + password fields
     *     (their HTML input types + accessibility attributes), the submit button, and the secondary
     *     links, proving the flag now backs a page that RENDERS (not a boolean that renders nothing)
     */
    @Test
    void renders_the_login_page_fields_and_links_through_the_runtime() {
        WireCallResult mounted = wireService.mount(LOGIN);

        assertThat(mounted.html())
                .contains("data-auth-form")
                .contains("<h1 data-auth-heading>Sign in</h1>")
                .contains("data-auth-field=\"email\"")
                .contains("type=\"email\"")
                .contains("aria-required=\"true\"")
                .contains("data-auth-field=\"password\"")
                .contains("type=\"password\"")
                .contains("data-auth-submit")
                .contains("href=\"/admin/password-reset\"")
                .contains("href=\"/admin/register\"");
        assertThat(mounted.snapshot()).isNotBlank();
    }

    /**
     * @spec.given the mounted login page and the correct credentials
     * @spec.when  the state is set over the wire and submit is called
     * @spec.then  the handler accepts, the page emits the redirect effect to the panel home, proving
     *     the submit reaches the host AuthHandler and acts on its outcome
     */
    @Test
    void a_valid_login_submit_redirects_through_the_runtime() {
        WireCallResult mounted = wireService.mount(LOGIN);

        WireCallResult submitted =
                wireService.call(
                        mounted.snapshot(),
                        Map.of("state", Map.of("email", "agent@example.com", "password", "secret-password")),
                        List.of("submit"),
                        "test-client");

        assertThat(readEffects(submitted).get("redirect").asText()).isEqualTo("/admin");
    }

    /**
     * @spec.given the mounted login page and wrong credentials
     * @spec.when  submit is called
     * @spec.then  no redirect is emitted and the form re-renders with the bad-credentials form-level
     *     message as an alert, the submitted email kept (input not lost)
     */
    @Test
    void a_bad_login_submit_re_renders_with_the_credentials_error() {
        WireCallResult mounted = wireService.mount(LOGIN);

        WireCallResult submitted =
                wireService.call(
                        mounted.snapshot(),
                        Map.of("state", Map.of("email", "agent@example.com", "password", "wrong")),
                        List.of("submit"),
                        "test-client");

        if (submitted.effects() != null) {
            assertThat(readEffects(submitted).has("redirect")).isFalse();
        }
        assertThat(submitted.html())
                .contains("data-auth-message")
                .contains("These credentials do not match our records.")
                .contains("value=\"agent@example.com\"");
    }

    /**
     * @spec.given the mounted login page and a submit missing the required password
     * @spec.when  submit is called
     * @spec.then  the schema validation blocks it, the form re-renders with the password field error
     *     bound by aria-describedby (the field-level validation render, not a generic message)
     */
    @Test
    void a_login_submit_missing_a_required_field_shows_the_field_error() {
        WireCallResult mounted = wireService.mount(LOGIN);

        WireCallResult submitted =
                wireService.call(
                        mounted.snapshot(),
                        Map.of("state", Map.of("email", "agent@example.com")),
                        List.of("submit"),
                        "test-client");

        assertThat(submitted.html())
                .contains("data-auth-field-error=\"password\"")
                .contains("aria-invalid=\"true\"")
                .contains("id=\"password-error\"");
    }

    /**
     * @spec.given the register page mounted, then a submit with a taken email
     * @spec.when  the form renders, then the taken-email submit is processed
     * @spec.then  the mount renders the name/email/password/confirm fields, and the taken-email submit
     *     re-renders with the handler's per-field "email already taken" error
     */
    @Test
    void register_renders_its_fields_and_surfaces_a_taken_email_through_the_runtime() {
        WireCallResult mounted = wireService.mount(REGISTER);
        assertThat(mounted.html())
                .contains("<h1 data-auth-heading>Create an account</h1>")
                .contains("data-auth-field=\"name\"")
                .contains("data-auth-field=\"email\"")
                .contains("data-auth-field=\"password\"")
                .contains("data-auth-field=\"password_confirmation\"");

        WireCallResult submitted =
                wireService.call(
                        mounted.snapshot(),
                        Map.of(
                                "state",
                                Map.of(
                                        "name", "Agent Smith",
                                        "email", "taken@example.com",
                                        "password", "longenough1",
                                        "password_confirmation", "longenough1")),
                        List.of("submit"),
                        "test-client");

        assertThat(submitted.html())
                .contains("data-auth-field-error=\"email\"")
                .contains("This email is already taken.");
    }

    /**
     * @spec.given the password-reset page mounted, then a valid email submitted
     * @spec.when  the form renders, then the submit is processed
     * @spec.then  the mount renders the single email field, and the submit shows the confirmation
     *     banner (status role, not alert) without a redirect: it stays on the page and confirms
     */
    @Test
    void password_reset_renders_then_confirms_through_the_runtime() {
        WireCallResult mounted = wireService.mount(PASSWORD_RESET);
        assertThat(mounted.html())
                .contains("<h1 data-auth-heading>Reset your password</h1>")
                .contains("data-auth-field=\"email\"")
                .contains("href=\"/admin/login\"");

        WireCallResult submitted =
                wireService.call(
                        mounted.snapshot(),
                        Map.of("state", Map.of("email", "agent@example.com")),
                        List.of("submit"),
                        "test-client");

        assertThat(submitted.html())
                .contains("data-auth-message")
                // A confirmation banner is a polite status, not an assertive alert (non-error path).
                .contains("role=\"status\"")
                .doesNotContain("data-auth-message-error=\"true\"")
                .contains("We have emailed you a password reset link.");
    }

    /**
     * @spec.given the email-verification page mounted, then the correct code submitted
     * @spec.when  the form renders, then the submit is processed
     * @spec.then  the mount renders the code field, and the correct-code submit shows the "verified"
     *     confirmation, proving the OTP-backed verify page reaches the host handler
     */
    @Test
    void email_verification_renders_then_verifies_through_the_runtime() {
        WireCallResult mounted = wireService.mount(EMAIL_VERIFICATION);
        assertThat(mounted.html())
                .contains("<h1 data-auth-heading>Verify your email address</h1>")
                .contains("data-auth-field=\"code\"");

        WireCallResult submitted =
                wireService.call(
                        mounted.snapshot(),
                        Map.of("state", Map.of("code", "123456")),
                        List.of("submit"),
                        "test-client");

        assertThat(submitted.html()).contains("Your email address has been verified.");
    }
}
