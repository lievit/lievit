/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package com.iambilotta.lievit.example.auth;

import com.iambilotta.lievit.LievitAction;
import com.iambilotta.lievit.LievitComponent;
import com.iambilotta.lievit.LievitProperty;
import com.iambilotta.lievit.Wire;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;

/**
 * Registration form component: binds username + password inputs, validates them, persists a new
 * user row, and sets {@code redirectTo} so the client-side JS can navigate to the login page.
 *
 * <p>{@code error} and {@code redirectTo} are {@code locked}: the server sets them; a client update
 * to either is rejected 403 (ADR-0001 locked-field amendment).
 */
@LievitComponent(template = "auth/register")
public class RegisterComponent {

    /** Bound to the username input field (l:model). Client-editable. */
    @Wire
    public String username = "";

    /** Bound to the password input field (l:model). Client-editable. */
    @Wire
    public String password = "";

    /** Bound to the password-confirm input field (l:model). Client-editable. */
    @Wire
    public String passwordConfirm = "";

    /**
     * Server-set error message; locked so a client cannot pre-clear it.
     * Empty string means no error.
     */
    @Wire
    @LievitProperty(locked = true)
    public String error = "";

    /**
     * Server-set redirect target after successful registration; locked to prevent open-redirect
     * injection. Empty string means no redirect yet.
     */
    @Wire
    @LievitProperty(locked = true)
    public String redirectTo = "";

    private final JdbcTemplate jdbc;
    private final PasswordEncoder encoder;

    public RegisterComponent(JdbcTemplate jdbc, PasswordEncoder encoder) {
        this.jdbc = jdbc;
        this.encoder = encoder;
    }

    /**
     * Validates the inputs, inserts the user, and sets {@code redirectTo} so the template's
     * client-side handler can navigate to the login page.
     */
    @LievitAction
    public void register() {
        error = "";
        redirectTo = "";

        if (username == null || username.isBlank()) {
            error = "Username is required.";
            return;
        }
        if (password == null || password.isBlank()) {
            error = "Password is required.";
            return;
        }
        if (!password.equals(passwordConfirm)) {
            error = "Passwords do not match.";
            return;
        }

        Integer count = jdbc.queryForObject(
                "SELECT COUNT(*) FROM users WHERE username = ?", Integer.class, username);
        if (count != null && count > 0) {
            error = "Username already taken.";
            return;
        }

        String hash = encoder.encode(password);
        jdbc.update("INSERT INTO users (username, password_hash) VALUES (?, ?)", username, hash);
        redirectTo = "/login?registered=true";
    }
}
