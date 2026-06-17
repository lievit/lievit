/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit;

import java.util.Objects;

/**
 * A first-class admin action (the filament-internals.md "Action as a first-class object"): a named,
 * labelled operation a page or row triggers, which runs server-side and emits its outcome on the
 * lievit {@link io.lievit.component.LievitEffects effects substrate} (a flash
 * notification + a redirect).
 *
 * <p>Every action gates itself through the {@link AdminAuthorizer} before it touches the repository
 * (the boundary-not-the-view lesson), and reports its outcome as an {@link AdminActionResult} so the
 * page component can branch without exceptions. v0.1 ships the three built-ins:
 * {@link CreateAction}, {@link EditAction}, {@link DeleteAction}.
 *
 * <p>Confirmation for a destructive action is, in v0.1, a simple server-confirmed flag
 * ({@link #requiresConfirmation()}): the page renders a confirm affordance and only calls the action
 * once confirmed. A Lit modal confirmation is deferred to the nested-component wave; this flag is the
 * data the page needs either way.
 *
 * @param <T> the resource row type the action operates on
 */
public abstract class AdminAction<T> {

    private final String name;
    private final String label;
    private final AdminOperation operation;

    /**
     * @param name the action name (stable id, the {@code @LievitAction}-side handle the page wires)
     * @param label the human label shown on the button
     * @param operation the CRUD operation this action performs (the authorizer gate)
     */
    protected AdminAction(String name, String label, AdminOperation operation) {
        this.name = Objects.requireNonNull(name, "name");
        this.label = Objects.requireNonNull(label, "label");
        this.operation = Objects.requireNonNull(operation, "operation");
    }

    /** @return the stable action name */
    public final String name() {
        return name;
    }

    /** @return the human button label */
    public final String label() {
        return label;
    }

    /** @return the CRUD operation this action performs */
    public final AdminOperation operation() {
        return operation;
    }

    /**
     * @return whether the page must confirm with the user before invoking this action (defaults to
     *     {@code false}; a destructive action like {@link DeleteAction} overrides to {@code true})
     */
    public boolean requiresConfirmation() {
        return false;
    }

    /**
     * @return whether this action is destructive (styling + the confirmation default); defaults to
     *     {@code false}
     */
    public boolean isDestructive() {
        return false;
    }

    /**
     * Runs the action: checks authorization, performs the operation, and emits the success effects
     * (flash + redirect) onto the context's effects sink.
     *
     * @param context the per-invocation context (resource, routes, authorizer, effects, inputs)
     * @return the outcome (completed / invalid / forbidden)
     */
    public final AdminActionResult run(AdminActionContext<T> context) {
        Objects.requireNonNull(context, "context");
        Object record = authorizationRecord(context);
        if (!context.authorizer().isAllowed(operation, context.resource(), record)) {
            return AdminActionResult.forbidden();
        }
        return perform(context);
    }

    /**
     * The record handed to the authorizer for a row-scoped operation, or {@code null} for a
     * resource-scoped one. The default is {@code null} (resource-scoped); {@link EditAction} and
     * {@link DeleteAction} resolve the targeted record.
     *
     * @param context the invocation context
     * @return the record to authorize against, or {@code null}
     */
    protected Object authorizationRecord(AdminActionContext<T> context) {
        return context.recordId() == null
                ? null
                : context.repository().findById(context.recordId()).orElse(null);
    }

    /**
     * Performs the operation after authorization has passed; concrete actions implement the write
     * and the effects.
     *
     * @param context the invocation context
     * @return the outcome
     */
    protected abstract AdminActionResult perform(AdminActionContext<T> context);
}
