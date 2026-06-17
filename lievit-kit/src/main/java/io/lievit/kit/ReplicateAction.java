/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit;

import java.util.Objects;
import java.util.function.UnaryOperator;

/**
 * The built-in replicate action (the Filament {@code ReplicateAction}): duplicates the targeted
 * record through the repository, optionally transforming the copy first (e.g. clearing the id,
 * suffixing the title), then flashes a success notification.
 *
 * <p>The targeted record id rides {@link AdminActionContext#recordId()}; the copy transform defaults
 * to the identity (the repository's {@code create} is expected to assign a fresh id).
 *
 * @param <T> the resource row type
 */
public final class ReplicateAction<T> extends AdminAction<T> {

    private final UnaryOperator<T> beforeReplica;

    /**
     * Builds a replicate action that copies the record as-is.
     */
    public ReplicateAction() {
        this(UnaryOperator.identity());
    }

    /**
     * Builds a replicate action that transforms the copy before persisting it.
     *
     * @param beforeReplica transforms the record into the copy to persist
     */
    public ReplicateAction(UnaryOperator<T> beforeReplica) {
        super("replicate", "Replicate", AdminOperation.CREATE);
        this.beforeReplica = Objects.requireNonNull(beforeReplica, "beforeReplica");
        icon("heroicon-o-square-2-stack");
    }

    @Override
    protected AdminActionResult perform(AdminActionContext<T> context) {
        String id = context.recordId();
        if (id == null) {
            throw new IllegalStateException("ReplicateAction requires a recordId in the context");
        }
        T original = context.repository().findById(id).orElse(null);
        if (original == null) {
            return AdminActionResult.completed(null);
        }
        context.repository().create(beforeReplica.apply(original));
        AdminNotification.success("Replicated.").flashOnto(context.effects());
        String to = context.routes().list();
        context.effects().redirect(to);
        return AdminActionResult.completed(to);
    }
}
