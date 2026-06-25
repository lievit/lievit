/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit;

import java.util.List;
import java.util.Objects;

import dev.lievit.component.LievitEffects;

/**
 * Everything a {@link BulkAction} needs to run one invocation over a selection: the resource and its
 * routes, the authorizer (per-record gate), the effects sink, and the selected record ids. The kit
 * resolves the records lazily through the repository so a bulk action operates over a live record
 * set, not stale snapshots.
 *
 * @param resource the resource the action targets
 * @param routes the resource's CRUD routes (redirect targets)
 * @param authorizer the authorization seam (checked per record)
 * @param effects the per-call effects sink (flash + redirect ride this)
 * @param selectedIds the ids of the selected rows
 * @param <T> the resource row type
 */
public record BulkActionContext<T>(
        Resource<T> resource,
        AdminRoutes routes,
        AdminAuthorizer authorizer,
        LievitEffects effects,
        List<String> selectedIds) {

    /** Compact constructor: defends the collaborators and copies the id list. */
    public BulkActionContext {
        Objects.requireNonNull(resource, "resource");
        Objects.requireNonNull(routes, "routes");
        Objects.requireNonNull(authorizer, "authorizer");
        Objects.requireNonNull(effects, "effects");
        selectedIds = List.copyOf(selectedIds);
    }

    /**
     * @return the resource's data port
     */
    public RecordRepository<T> repository() {
        return resource.repository();
    }
}
