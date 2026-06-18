/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit;

/**
 * The built-in force-delete action (the Filament {@code ForceDeleteAction}): permanently removes a
 * record through a {@link SoftDeleteRepository#forceDelete(String)}, bypassing the soft-delete
 * marker, then flashes success and returns to the list. Visible only on a trashed record.
 *
 * <p>Destructive and {@link #requiresConfirmation() requires confirmation}; the warning that it
 * cannot be undone is the default destructive confirmation copy.
 *
 * @param <T> the resource row type
 */
public final class ForceDeleteAction<T> extends AdminAction<T> {

    private final SoftDeleteRepository<T> repository;

    /**
     * @param repository the soft-delete-aware repository the force-delete calls
     */
    public ForceDeleteAction(SoftDeleteRepository<T> repository) {
        super("forceDelete", "Force delete", AdminOperation.DELETE);
        this.repository = java.util.Objects.requireNonNull(repository, "repository");
        icon("heroicon-o-trash");
        hidden(record -> record != null && !repository.isTrashed(cast(record)));
    }

    @Override
    public boolean requiresConfirmation() {
        return true;
    }

    @Override
    public boolean isDestructive() {
        return true;
    }

    @Override
    protected AdminActionResult perform(AdminActionContext<T> context) {
        String id = context.recordId();
        if (id == null) {
            throw new IllegalStateException("ForceDeleteAction requires a recordId in the context");
        }
        repository.forceDelete(id);
        AdminNotification.success("Deleted permanently.").flashOnto(context.effects());
        String to = context.routes().list();
        context.effects().redirect(to);
        return AdminActionResult.completed(to);
    }

    @SuppressWarnings("unchecked")
    private T cast(Object record) {
        return (T) record;
    }
}
