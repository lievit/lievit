/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * The panel authentication <strong>page models</strong> (the gap the coverage audit names: a panel's
 * {@code registration()/passwordReset()/emailVerification()} were boolean flags that render nothing;
 * these are the real pages behind the flags).
 *
 * <p>Each {@link dev.lievit.kit.auth.AuthPage} is the auth analog of
 * {@link dev.lievit.kit.settings.SettingsPage}: a schema-form page that owns the
 * mount -> hydrate -> validate -> delegate lifecycle and renders an
 * {@link dev.lievit.kit.auth.AuthFormView}. The four concrete pages
 * ({@link dev.lievit.kit.auth.LoginPage}, {@link dev.lievit.kit.auth.RegisterPage},
 * {@link dev.lievit.kit.auth.PasswordResetPage}, {@link dev.lievit.kit.auth.EmailVerificationPage})
 * differ only in their schema, labels, and links.
 *
 * <p>The kit stays framework-pure: the page owns the form + validation + render; the host-supplied
 * {@link dev.lievit.kit.auth.AuthHandler} owns the side effect (verify a password, create a user, send
 * a reset link) and returns an {@link dev.lievit.kit.auth.AuthOutcome}. The panel never reaches into a
 * {@code UserDetailsService} or a mailer.
 */
@NullMarked
package dev.lievit.kit.auth;

import org.jspecify.annotations.NullMarked;
