/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit.auth;

import java.util.List;

import io.lievit.kit.schema.Checkbox;
import io.lievit.kit.schema.SchemaForm;
import io.lievit.kit.schema.TextInput;

/**
 * The panel login page (the Filament {@code Login}): the always-on auth page. Email + password +
 * a "remember me" toggle; the host {@link AuthHandler} verifies the credentials and starts the
 * session. Links to register / reset are shown only when those flows are enabled, wired by the
 * adopter via {@link #withLinks}.
 */
public final class LoginPage extends AuthPage {

    private final List<AuthFormView.Link> links;

    /**
     * @param handler the credential-verification SPI
     */
    public LoginPage(AuthHandler handler) {
        this(handler, List.of());
    }

    private LoginPage(AuthHandler handler, List<AuthFormView.Link> links) {
        super(handler);
        this.links = List.copyOf(links);
    }

    /**
     * @param handler the credential-verification SPI
     * @param links the secondary links to show (register / forgot-password), in display order
     * @return a login page carrying the given links
     */
    public static LoginPage withLinks(AuthHandler handler, List<AuthFormView.Link> links) {
        return new LoginPage(handler, links);
    }

    @Override
    public String slug() {
        return "login";
    }

    @Override
    public String heading() {
        return "Sign in";
    }

    @Override
    public String submitLabel() {
        return "Sign in";
    }

    @Override
    public SchemaForm schema() {
        return SchemaForm.create()
                .components(
                        TextInput.make("email", "Email address").email().required().autocomplete("email"),
                        TextInput.make("password", "Password").password().required().revealable(),
                        Checkbox.make("remember"));
    }

    @Override
    public List<AuthFormView.Link> links() {
        return links;
    }
}
