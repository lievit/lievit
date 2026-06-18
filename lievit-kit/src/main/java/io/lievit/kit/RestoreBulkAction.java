/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit;

/**
 * The built-in bulk restore (the Filament {@code RestoreBulkAction}): restores every authorized
 * selected record through the {@link SoftDeleteRepository}, gating each as an
 * {@link AdminOperation#UPDATE}. Confirmed, used on a trashed (only-trashed) list view.
 *
 * @param <T> the resource row type
 */
public final class RestoreBulkAction<T> extends BulkAction<T> {

    /**
     * @param repository the soft-delete-aware repository the restore calls
     */
    public RestoreBulkAction(SoftDeleteRepository<T> repository) {
        super(
                "restore-selected",
                "Restore selected",
                AdminOperation.UPDATE,
                (records, context) -> {
                    Table<T> table = context.resource().table();
                    for (T record : records) {
                        repository.restore(table.idOf(record));
                    }
                });
        color("success");
        icon("heroicon-o-arrow-uturn-left");
    }

    @Override
    public boolean requiresConfirmation() {
        return true;
    }
}
