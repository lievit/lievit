/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit.auth;

import java.util.List;

import dev.lievit.kit.schema.SchemaForm;
import dev.lievit.kit.schema.TextInput;

/**
 * The request-password-reset page (the Filament {@code RequestPasswordReset}, gated by
 * {@code Panel.passwordReset()}): one email field; the host {@link AuthHandler} sends the reset link
 * and returns an {@link AuthOutcome#confirmed} "we have emailed you a link" message (Filament does
 * not reveal whether the address exists, so the page always confirms). The set-new-password step is
 * the host's reset-link landing route, outside this page.
 */
public final class PasswordResetPage extends AuthPage {

    private final List<AuthFormView.Link> links;

    /**
     * @param handler the send-reset-link SPI
     */
    public PasswordResetPage(AuthHandler handler) {
        this(handler, List.of());
    }

    private PasswordResetPage(AuthHandler handler, List<AuthFormView.Link> links) {
        super(handler);
        this.links = List.copyOf(links);
    }

    /**
     * @param handler the send-reset-link SPI
     * @param links the secondary links (for example "Back to sign in")
     * @return a password-reset page carrying the given links
     */
    public static PasswordResetPage withLinks(AuthHandler handler, List<AuthFormView.Link> links) {
        return new PasswordResetPage(handler, links);
    }

    @Override
    public String slug() {
        return "password-reset";
    }

    @Override
    public String heading() {
        return "Reset your password";
    }

    @Override
    public String submitLabel() {
        return "Email reset link";
    }

    @Override
    public SchemaForm schema() {
        return SchemaForm.create()
                .components(
                        TextInput.make("email", "Email address").email().required().autocomplete("email"));
    }

    @Override
    public List<AuthFormView.Link> links() {
        return links;
    }
}
