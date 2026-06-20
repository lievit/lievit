/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * The panel authentication <strong>page models</strong> (the gap the coverage audit names: a panel's
 * {@code registration()/passwordReset()/emailVerification()} were boolean flags that render nothing;
 * these are the real pages behind the flags).
 *
 * <p>Each {@link io.lievit.kit.auth.AuthPage} is the auth analog of
 * {@link io.lievit.kit.settings.SettingsPage}: a schema-form page that owns the
 * mount -> hydrate -> validate -> delegate lifecycle and renders an
 * {@link io.lievit.kit.auth.AuthFormView}. The four concrete pages
 * ({@link io.lievit.kit.auth.LoginPage}, {@link io.lievit.kit.auth.RegisterPage},
 * {@link io.lievit.kit.auth.PasswordResetPage}, {@link io.lievit.kit.auth.EmailVerificationPage})
 * differ only in their schema, labels, and links.
 *
 * <p>The kit stays framework-pure: the page owns the form + validation + render; the host-supplied
 * {@link io.lievit.kit.auth.AuthHandler} owns the side effect (verify a password, create a user, send
 * a reset link) and returns an {@link io.lievit.kit.auth.AuthOutcome}. The panel never reaches into a
 * {@code UserDetailsService} or a mailer.
 */
@NullMarked
package io.lievit.kit.auth;

import org.jspecify.annotations.NullMarked;
