/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit;

import java.util.Objects;

/**
 * The built-in relation-manager bulk detach (the Filament {@code DetachBulkAction}): detaches every
 * authorized selected related record from a parent through a {@link RelationshipRepository}, the bulk
 * counterpart of a {@link RelationshipAction} detach. It runs through the shared {@link BulkAction}
 * loop, so it reuses the per-record authorization filtering, chunking, and
 * deselect-after-completion; only the body differs (it unlinks rather than deletes).
 *
 * <p>Bound to its {@code parentId} at construction (a relation manager always renders under a known
 * parent), it detaches each selected related record's id from that parent and flashes a success
 * notification once.
 *
 * @param <R> the related-record type
 */
public final class DetachBulkAction<R> extends BulkAction<R> {

    /**
     * @param repository the relationship port the detach calls
     * @param parentId the parent record id the selected related records are detached from
     */
    public DetachBulkAction(RelationshipRepository<R> repository, String parentId) {
        super(
                "detach-selected",
                "Detach selected",
                AdminOperation.UPDATE,
                (records, context) -> {
                    Table<R> table = context.resource().table();
                    for (R record : records) {
                        repository.detach(parentId, table.idOf(record));
                    }
                    AdminNotification.success("Detached.").flashOnto(context.effects());
                });
        Objects.requireNonNull(repository, "repository");
        Objects.requireNonNull(parentId, "parentId");
        icon("heroicon-o-x-mark");
    }
}
