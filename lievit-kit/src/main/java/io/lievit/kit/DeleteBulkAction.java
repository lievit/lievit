/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit;

/**
 * The built-in bulk delete (the Filament {@code DeleteBulkAction}): deletes every authorized
 * selected record through the repository, flashes a result notification, and (by default) clears
 * the selection. Destructive: it requires confirmation.
 *
 * @param <T> the resource row type
 */
public final class DeleteBulkAction<T> extends BulkAction<T> {

    /** Builds the delete-bulk action. */
    public DeleteBulkAction() {
        super(
                "delete-selected",
                "Delete selected",
                AdminOperation.DELETE,
                (records, context) -> {
                    Table<T> table = context.resource().table();
                    for (T record : records) {
                        context.repository().delete(table.idOf(record));
                    }
                });
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
