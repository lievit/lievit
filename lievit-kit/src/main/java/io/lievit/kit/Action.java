/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit;

import java.util.Objects;
import java.util.function.BiConsumer;
import java.util.function.Consumer;

import org.jspecify.annotations.Nullable;

/**
 * A custom single-record action (the Filament {@code Action} on a table row, beyond the CRUD
 * built-ins): {@code Action.make("approve", ...).requiresConfirmation().action((record, ctx) -> ...)}
 * runs an arbitrary server-side closure over the resolved record, then completes. The classic
 * non-CRUD row affordance ("Approve", "Publish", "Send reminder") whose body mutates the domain
 * through the app's own code rather than the generic create/update/delete path.
 *
 * <p>Unlike {@link FormAction} it carries no form (it acts on the existing record directly); like
 * every {@link AdminAction} it gates through the {@link AdminAuthorizer} before the closure runs and
 * reports its outcome as an {@link AdminActionResult} so the page can branch without exceptions. The
 * closure receives the resolved record and the {@link AdminActionContext} (for the effects sink: a
 * flash + redirect rides {@link AdminActionContext#effects()}); a record-only overload exists for the
 * common case that ignores the context.
 *
 * <p>Confirmation is the inherited server-confirmed flag ({@link #requiresConfirmation()}); the modal
 * copy is customizable fluently ({@link #confirmationHeading}, {@link #confirmationDescription},
 * {@link #confirmationSubmitLabel}) so the page renders a tailored confirm affordance.
 *
 * @param <T> the resource row type
 */
public final class Action<T> extends AdminAction<T> {

    private @Nullable BiConsumer<T, AdminActionContext<T>> body;
    private boolean requiresConfirmation;
    private @Nullable String confirmationHeading;
    private @Nullable String confirmationDescription;
    private @Nullable String confirmationSubmitLabel;

    private Action(String name, String label, AdminOperation operation) {
        super(name, label, operation);
    }

    /**
     * Builds a custom action under an explicit operation (the authorizer gate).
     *
     * @param name the stable action name
     * @param label the human button label
     * @param operation the CRUD operation the per-record authorizer gates
     * @param <T> the row type
     * @return a new custom action (set its body with {@link #action})
     */
    public static <T> Action<T> make(String name, String label, AdminOperation operation) {
        return new Action<>(name, label, operation);
    }

    /**
     * Sets the action body, receiving the resolved record and the invocation context (for the effects
     * sink).
     *
     * @param handler runs over the resolved record and the context
     * @return this action
     */
    public Action<T> action(BiConsumer<T, AdminActionContext<T>> handler) {
        this.body = Objects.requireNonNull(handler, "handler");
        return this;
    }

    /**
     * Sets the action body as a record-only handler (the common case that ignores the context).
     *
     * @param handler runs over the resolved record
     * @return this action
     */
    public Action<T> action(Consumer<T> handler) {
        Objects.requireNonNull(handler, "handler");
        this.body = (record, ctx) -> handler.accept(record);
        return this;
    }

    /**
     * Requires a confirmation before the action runs (the Filament {@code requiresConfirmation(bool)}
     * fluent setter). The page renders a confirm affordance and only invokes the action once
     * confirmed. The no-arg {@link #requiresConfirmation()} is the boolean reader (inherited shape),
     * so the setter carries the flag explicitly.
     *
     * @param value whether the action requires confirmation
     * @return this action
     */
    public Action<T> requiresConfirmation(boolean value) {
        this.requiresConfirmation = value;
        return this;
    }

    /**
     * Sets the confirmation modal heading (implies {@link #requiresConfirmation()}).
     *
     * @param heading the confirm modal heading
     * @return this action
     */
    public Action<T> confirmationHeading(String heading) {
        this.confirmationHeading = Objects.requireNonNull(heading, "heading");
        this.requiresConfirmation = true;
        return this;
    }

    /**
     * Sets the confirmation modal description (implies {@link #requiresConfirmation()}).
     *
     * @param description the confirm modal description
     * @return this action
     */
    public Action<T> confirmationDescription(String description) {
        this.confirmationDescription = Objects.requireNonNull(description, "description");
        this.requiresConfirmation = true;
        return this;
    }

    /**
     * Sets the confirmation modal submit-button label (implies {@link #requiresConfirmation()}).
     *
     * @param submitLabel the confirm button label
     * @return this action
     */
    public Action<T> confirmationSubmitLabel(String submitLabel) {
        this.confirmationSubmitLabel = Objects.requireNonNull(submitLabel, "submitLabel");
        this.requiresConfirmation = true;
        return this;
    }

    @Override
    public boolean requiresConfirmation() {
        return requiresConfirmation;
    }

    @Override
    public ConfirmationModal confirmationModal() {
        ConfirmationModal base = super.confirmationModal();
        return new ConfirmationModal(
                confirmationHeading != null ? confirmationHeading : base.heading(),
                confirmationDescription != null ? confirmationDescription : base.description(),
                confirmationSubmitLabel != null ? confirmationSubmitLabel : base.submitLabel(),
                base.cancelLabel(),
                base.icon());
    }

    @Override
    protected AdminActionResult perform(AdminActionContext<T> context) {
        if (body == null) {
            throw new IllegalStateException(
                    "an Action needs a body; set it with action((record, ctx) -> ...) or action(record -> ...)");
        }
        String id = context.recordId();
        if (id == null) {
            throw new IllegalStateException("a custom Action requires a recordId in the context");
        }
        T record = context.repository().findById(id).orElse(null);
        if (record == null) {
            return AdminActionResult.completed(null);
        }
        body.accept(record, context);
        return AdminActionResult.completed(null);
    }
}
