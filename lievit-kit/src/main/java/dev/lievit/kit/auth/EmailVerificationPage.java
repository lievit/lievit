/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit.auth;

import java.util.List;

import dev.lievit.kit.schema.OneTimeCodeInput;
import dev.lievit.kit.schema.SchemaForm;

/**
 * The email-verification page (the Filament {@code EmailVerification}, gated by
 * {@code Panel.emailVerification()}): the user enters the one-time code sent to their address; the
 * host {@link AuthHandler} consumes the code and, on success, marks the email verified and redirects
 * to the panel. Uses the {@link OneTimeCodeInput} field (six digits) so the code box renders as the
 * familiar segmented OTP input, not a bare text field.
 */
public final class EmailVerificationPage extends AuthPage {

    private final List<AuthFormView.Link> links;

    /**
     * @param handler the consume-verification-code SPI
     */
    public EmailVerificationPage(AuthHandler handler) {
        this(handler, List.of());
    }

    private EmailVerificationPage(AuthHandler handler, List<AuthFormView.Link> links) {
        super(handler);
        this.links = List.copyOf(links);
    }

    /**
     * @param handler the consume-verification-code SPI
     * @param links the secondary links (for example "Resend the code")
     * @return an email-verification page carrying the given links
     */
    public static EmailVerificationPage withLinks(AuthHandler handler, List<AuthFormView.Link> links) {
        return new EmailVerificationPage(handler, links);
    }

    @Override
    public String slug() {
        return "email-verification";
    }

    @Override
    public String heading() {
        return "Verify your email address";
    }

    @Override
    public String submitLabel() {
        return "Verify";
    }

    @Override
    public SchemaForm schema() {
        return SchemaForm.create()
                .components(OneTimeCodeInput.make("code").length(6).required());
    }

    @Override
    public List<AuthFormView.Link> links() {
        return links;
    }
}
