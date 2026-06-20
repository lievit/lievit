/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit.auth;

import java.util.List;

import io.lievit.kit.schema.Rules;
import io.lievit.kit.schema.SchemaForm;
import io.lievit.kit.schema.TextInput;

/**
 * The panel self-registration page (the Filament {@code Register}, gated by {@code Panel.registration()}).
 * Name + email + password + password-confirmation; the host {@link AuthHandler} creates the user (or
 * returns a field error like "email taken"). The password-confirmation match is enforced in the
 * schema (the {@code confirmed} rule), so the handler only ever sees a matched password.
 */
public final class RegisterPage extends AuthPage {

    private final List<AuthFormView.Link> links;

    /**
     * @param handler the user-creation SPI
     */
    public RegisterPage(AuthHandler handler) {
        this(handler, List.of());
    }

    private RegisterPage(AuthHandler handler, List<AuthFormView.Link> links) {
        super(handler);
        this.links = List.copyOf(links);
    }

    /**
     * @param handler the user-creation SPI
     * @param links the secondary links (for example "Already registered? Sign in")
     * @return a register page carrying the given links
     */
    public static RegisterPage withLinks(AuthHandler handler, List<AuthFormView.Link> links) {
        return new RegisterPage(handler, links);
    }

    @Override
    public String slug() {
        return "register";
    }

    @Override
    public String heading() {
        return "Create an account";
    }

    @Override
    public String submitLabel() {
        return "Register";
    }

    @Override
    public SchemaForm schema() {
        return SchemaForm.create()
                .components(
                        TextInput.make("name", "Name").required().maxLength(255),
                        TextInput.make("email", "Email address").email().required().autocomplete("email"),
                        TextInput.make("password", "Password")
                                .password()
                                .required()
                                .revealable()
                                .minLength(8)
                                .rule(Rules.confirmed("password")),
                        TextInput.make("password_confirmation", "Confirm password")
                                .password()
                                .required()
                                .revealable());
    }

    @Override
    public List<AuthFormView.Link> links() {
        return links;
    }
}
