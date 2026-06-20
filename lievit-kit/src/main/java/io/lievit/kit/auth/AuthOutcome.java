/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit.auth;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;

import org.jspecify.annotations.Nullable;

/**
 * The result of an {@link AuthPage} submit: either a success (with where to redirect and an optional
 * flash message) or a failure (with the per-field errors and/or a form-level message to re-render).
 *
 * <p>The auth pages stay framework-pure: the page validates the schema and, when valid, hands the
 * credentials to the host's {@link AuthHandler} which performs the real side effect (verify a
 * password, create a user, send a reset link) and returns one of these. The page never touches a
 * {@code UserDetailsService} or a mailer directly.
 *
 * @param success whether the submit succeeded
 * @param redirectUrl where to navigate on success (for example the panel home), or {@code null}
 * @param message a flash / form-level message (success banner or failure reason), or {@code null}
 * @param fieldErrors per-field error messages keyed by field name (empty on success)
 */
public record AuthOutcome(
        boolean success,
        @Nullable String redirectUrl,
        @Nullable String message,
        Map<String, String> fieldErrors) {

    /** Compact constructor: defends the error map. */
    public AuthOutcome {
        fieldErrors = Map.copyOf(fieldErrors);
    }

    /**
     * A success that navigates to {@code redirectUrl} with no flash message.
     *
     * @param redirectUrl where to navigate
     * @return the success outcome
     */
    public static AuthOutcome redirect(String redirectUrl) {
        return new AuthOutcome(true, Objects.requireNonNull(redirectUrl, "redirectUrl"), null, Map.of());
    }

    /**
     * A success that shows a confirmation message and stays on the page (the password-reset
     * "we have emailed you a link" and email-verification "verified" cases).
     *
     * @param message the confirmation message
     * @return the success outcome
     */
    public static AuthOutcome confirmed(String message) {
        return new AuthOutcome(true, null, Objects.requireNonNull(message, "message"), Map.of());
    }

    /**
     * A failure with a single form-level message (for example "These credentials do not match our
     * records.").
     *
     * @param message the failure message
     * @return the failure outcome
     */
    public static AuthOutcome failed(String message) {
        return new AuthOutcome(false, null, Objects.requireNonNull(message, "message"), Map.of());
    }

    /**
     * A failure with per-field errors (for example {@code email -> "This email is already taken."}).
     *
     * @param fieldErrors the per-field errors
     * @return the failure outcome
     */
    public static AuthOutcome fieldErrors(Map<String, String> fieldErrors) {
        Map<String, String> defended = new LinkedHashMap<>(fieldErrors);
        return new AuthOutcome(false, null, null, defended);
    }
}
