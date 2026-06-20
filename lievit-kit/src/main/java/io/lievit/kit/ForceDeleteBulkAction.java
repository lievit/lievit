/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit;

/**
 * The built-in bulk force-delete (the Filament {@code ForceDeleteBulkAction}): permanently removes
 * every authorized selected record through the {@link SoftDeleteRepository#forceDelete(String)},
 * bypassing the soft-delete marker, gating each as {@link AdminOperation#FORCE_DELETE}. Destructive
 * and confirmed.
 *
 * @param <T> the resource row type
 */
public final class ForceDeleteBulkAction<T> extends BulkAction<T> {

    /**
     * @param repository the soft-delete-aware repository the force-delete calls
     */
    public ForceDeleteBulkAction(SoftDeleteRepository<T> repository) {
        super(
                "force-delete-selected",
                "Force delete selected",
                AdminOperation.FORCE_DELETE,
                (records, context) -> {
                    Table<T> table = context.resource().table();
                    for (T record : records) {
                        repository.forceDelete(table.idOf(record));
                    }
                });
        icon("heroicon-o-trash");
    }

    @Override
    public boolean requiresConfirmation() {
        return true;
    }

    @Override
    public boolean isDestructive() {
        return true;
    }
}
