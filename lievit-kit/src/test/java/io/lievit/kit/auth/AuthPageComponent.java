/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit.auth;

import java.util.Map;

import io.lievit.component.LievitEffects;

/**
 * The shared submit logic for the four auth-page components in the render IT. It is NOT a
 * {@code @LievitComponent} and declares no wire members: the lievit core binds only the wire
 * fields/actions declared on the component class itself, so each concrete component declares its own
 * {@code state} + {@code view} + {@code submit} and delegates the work here (the same factoring as
 * the hello {@code FormPageDriver}).
 *
 * <p>It drives the {@link AuthPage}'s {@code mount -> submit} lifecycle, queuing the redirect + flash
 * effects on a clean success and returning the view to re-render otherwise, so the IT proves the page
 * renders + the submit reacts end to end (the audit's "no backing pages" gap closed).
 */
public abstract class AuthPageComponent {

    private final AuthPage page;

    /**
     * @param page the backing auth page model this component drives
     */
    protected AuthPageComponent(AuthPage page) {
        this.page = page;
    }

    /** @return the current auth-form view-model the shared template paints off {@code _instance} */
    public abstract AuthFormView view();

    /** @return the initial blank view-model the concrete component seeds its {@code view} with */
    protected AuthFormView initialView() {
        return page.mount();
    }

    /**
     * Validates + delegates the submit; on success queues the redirect + flash effects and returns a
     * fresh confirmed view, otherwise returns the re-render view (with the field/form errors).
     *
     * @param state the submitted field values
     * @param effects the current wire-call effects sink
     * @return the next view to render
     */
    protected AuthFormView doSubmit(Map<String, String> state, LievitEffects effects) {
        AuthPage.Result result = page.submit(state);
        if (result.isSuccess() && result.outcome() != null) {
            AuthOutcome outcome = result.outcome();
            if (outcome.message() != null) {
                io.lievit.kit.AdminNotification.success(outcome.message()).flashOnto(effects);
            }
            if (outcome.redirectUrl() != null) {
                effects.redirect(outcome.redirectUrl());
            }
            // Re-render a fresh blank/confirmed view so a stay-on-page confirmation message shows.
            return AuthFormView.of(
                    page.heading(),
                    page.schema(),
                    io.lievit.kit.schema.SchemaState.empty(),
                    Map.of(),
                    outcome.message(),
                    false,
                    page.submitLabel(),
                    page.links());
        }
        if (result.reRender() != null) {
            return result.reRender();
        }
        return initialView();
    }
}
