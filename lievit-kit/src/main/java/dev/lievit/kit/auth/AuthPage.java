/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit.auth;

import java.util.List;
import java.util.Map;
import java.util.Objects;

import dev.lievit.kit.schema.SchemaForm;
import dev.lievit.kit.schema.SchemaState;
import dev.lievit.kit.support.EvaluationContext.Operation;

/**
 * A backing <strong>page model</strong> for a panel's authentication flow (the gap the audit names:
 * the panel's {@code registration()/passwordReset()/emailVerification()} were boolean flags that
 * <em>render nothing</em>; this is the real page behind the flag). It is the auth analog of
 * {@link dev.lievit.kit.settings.SettingsPage}: a schema-form page that owns the
 * mount -> hydrate -> validate -> delegate lifecycle and renders an {@link AuthFormView}.
 *
 * <p>The kit stays framework-pure: the page validates the schema and, on success, hands the
 * validated, dehydrated credentials to the host {@link AuthHandler} (verify a password, create a
 * user, send a reset link) which returns the {@link AuthOutcome}. The four concrete pages
 * ({@link LoginPage}, {@link RegisterPage}, {@link PasswordResetPage},
 * {@link EmailVerificationPage}) differ only in their {@link #schema()}, labels, and links.
 */
public abstract class AuthPage {

    private final AuthHandler handler;

    /**
     * @param handler the host-supplied side-effect SPI invoked on a valid submit
     */
    protected AuthPage(AuthHandler handler) {
        this.handler = Objects.requireNonNull(handler, "handler");
    }

    /**
     * The url slug for this page (for example {@code "login"} -> {@code /admin/login}).
     *
     * @return the slug
     */
    public abstract String slug();

    /**
     * The page heading.
     *
     * @return the heading
     */
    public abstract String heading();

    /**
     * The submit button label (for example {@code "Sign in"}).
     *
     * @return the submit label
     */
    public abstract String submitLabel();

    /**
     * Builds the page's schema form (the credential fields). Rebuilt per request, the kit way.
     *
     * @return the schema form
     */
    public abstract SchemaForm schema();

    /**
     * The secondary navigation links shown under the form (for example "Forgot your password?").
     *
     * @return the links, in display order (empty if none)
     */
    public List<AuthFormView.Link> links() {
        return List.of();
    }

    /**
     * Mounts the page: a fresh, blank render view-model (no errors, no message).
     *
     * @return the initial view-model
     */
    public AuthFormView mount() {
        SchemaForm form = schema().operating(Operation.CREATE, null);
        SchemaState state = SchemaState.empty();
        form.hydrate(state);
        return AuthFormView.of(
                heading(), form, state, Map.of(), null, false, submitLabel(), links());
    }

    /**
     * Validates and processes a submit: validate the schema, and on success dehydrate the credentials
     * and delegate to the {@link AuthHandler}. A schema-validation failure re-renders the form with
     * the submitted values + the per-field errors (the input is never lost). A handler failure
     * re-renders with the handler's field errors and/or form-level message.
     *
     * @param submitted the submitted field values (a flat field-name to value map)
     * @return either the {@link AuthOutcome} (on a handler decision) or a re-render view (on a schema
     *     failure); the caller branches on {@link Result#outcome()} being present
     */
    public Result submit(Map<String, ?> submitted) {
        Objects.requireNonNull(submitted, "submitted");
        SchemaForm form = schema().operating(Operation.CREATE, null);
        @SuppressWarnings({"unchecked", "rawtypes"})
        SchemaState state = SchemaState.of((Map) submitted);
        Map<String, String> errors = form.validate(state);
        if (!errors.isEmpty()) {
            AuthFormView view =
                    AuthFormView.of(
                            heading(), form, state, errors, null, true, submitLabel(), links());
            return new Result(null, view);
        }
        Map<String, Object> credentials = dehydrateNonNull(form, state);
        AuthOutcome outcome = handler.handle(credentials);
        if (outcome.success()) {
            return new Result(outcome, null);
        }
        // Handler failure: surface its field errors and/or its form-level message on a re-render.
        AuthFormView view =
                AuthFormView.of(
                        heading(),
                        form,
                        state,
                        outcome.fieldErrors(),
                        outcome.message(),
                        true,
                        submitLabel(),
                        links());
        return new Result(outcome, view);
    }

    private static Map<String, Object> dehydrateNonNull(SchemaForm form, SchemaState state) {
        Map<String, Object> credentials = new java.util.LinkedHashMap<>();
        form.dehydrate(state)
                .forEach(
                        (key, value) -> {
                            if (value != null) {
                                credentials.put(key, value);
                            }
                        });
        return credentials;
    }

    /**
     * The submit result: the handler {@link AuthOutcome} when the schema was valid (and on a handler
     * failure the {@code reRender} view is also present), or only a {@code reRender} view when the
     * schema validation itself failed before the handler ran.
     *
     * @param outcome the handler outcome, or {@code null} when the schema validation failed first
     * @param reRender the view to re-render, or {@code null} on a clean success
     */
    public record Result(
            @org.jspecify.annotations.Nullable AuthOutcome outcome,
            @org.jspecify.annotations.Nullable AuthFormView reRender) {

        /** @return whether the submit succeeded (a clean success: navigate / confirm) */
        public boolean isSuccess() {
            return outcome != null && outcome.success();
        }
    }
}
