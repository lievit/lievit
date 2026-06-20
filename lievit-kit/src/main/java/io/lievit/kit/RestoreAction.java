/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit;

/**
 * The built-in restore action (the Filament {@code RestoreAction}): restores a soft-deleted record
 * through a {@link SoftDeleteRepository}, then flashes success and returns to the list. Visible only
 * on a trashed record ({@link #isHiddenFor(Object)} hides it on live rows).
 *
 * <p>It gates as a {@link AdminOperation#RESTORE} (its own policy verb, distinct from update so a
 * policy can allow editing but forbid resurrecting a trashed row), and reads the targeted id from
 * {@link AdminActionContext#recordId()}. The trashed-state visibility is
 * the repository's {@link SoftDeleteRepository#isTrashed(Object)} so the kit never guesses.
 *
 * @param <T> the resource row type
 */
public final class RestoreAction<T> extends AdminAction<T> {

    private final SoftDeleteRepository<T> repository;

    /**
     * @param repository the soft-delete-aware repository the restore calls
     */
    public RestoreAction(SoftDeleteRepository<T> repository) {
        super("restore", "Restore", AdminOperation.RESTORE);
        this.repository = java.util.Objects.requireNonNull(repository, "repository");
        icon("heroicon-o-arrow-uturn-left");
        color("success");
        hidden(record -> record != null && !repository.isTrashed(cast(record)));
    }

    @Override
    public boolean requiresConfirmation() {
        return true;
    }

    @Override
    protected AdminActionResult perform(AdminActionContext<T> context) {
        String id = context.recordId();
        if (id == null) {
            throw new IllegalStateException("RestoreAction requires a recordId in the context");
        }
        repository.restore(id);
        AdminNotification.success("Restored.").flashOnto(context.effects());
        String to = context.routes().list();
        context.effects().redirect(to);
        return AdminActionResult.completed(to);
    }

    @SuppressWarnings("unchecked")
    private T cast(Object record) {
        return (T) record;
    }
}
