/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit.auth;

import java.util.Map;

/**
 * The host-supplied SPI an {@link AuthPage} delegates its side effect to once the submitted schema is
 * valid (the seam that keeps the kit framework-pure: the page owns the form + validation + render, the
 * host owns the credential check / user creation / token send).
 *
 * <p>One handler per page kind, wired by the adopter:
 * <ul>
 *   <li>{@code LoginPage} -> verify the email + password, start the session, return
 *       {@link AuthOutcome#redirect}.
 *   <li>{@code RegisterPage} -> create the user (or return field errors like "email taken").
 *   <li>{@code PasswordResetPage} -> send the reset link / set the new password.
 *   <li>{@code EmailVerificationPage} -> consume the verification code.
 * </ul>
 *
 * <p>The handler receives the dehydrated, already-validated field values and returns the
 * {@link AuthOutcome}; it never sees raw request state and is not responsible for schema validation
 * (that already passed).
 */
@FunctionalInterface
public interface AuthHandler {

    /**
     * Performs the page's side effect against the validated credentials.
     *
     * @param credentials the validated, dehydrated field values keyed by field name (for example
     *     {@code email}, {@code password})
     * @return the outcome (success with a redirect / confirmation, or a failure to re-render)
     */
    AuthOutcome handle(Map<String, ? extends Object> credentials);
}
