/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit;

/**
 * The CRUD operations an {@link AdminAuthorizer} gates, one per full-page action (the Filament
 * resource-page operation set / Laravel Policy ability set).
 *
 * <p>The set mirrors Filament's policy abilities so a {@link PolicyAdminAuthorizer} can carry a
 * <em>per-verb</em> map (the {@code viewAny/view/create/update/delete/restore/forceDelete/reorder}
 * policy methods), instead of the coarse view/create/update/delete collapse where {@code restore}
 * folded into {@code update} and {@code forceDelete} into {@code delete}. The single-record
 * <em>view</em> read deliberately reuses {@link #VIEW_LIST} (the documented decision: a record read
 * shares the list read gate, no separate constant), so the read ability is one verb, not two.
 */
public enum AdminOperation {
    /** View the list page (and a single record's detail: the read ability). */
    VIEW_LIST,
    /** Create a new record. */
    CREATE,
    /** Update an existing record. */
    UPDATE,
    /** Soft-delete a record (Filament {@code delete} ability). */
    DELETE,
    /** Restore a soft-deleted record (Filament {@code restore} ability, distinct from update). */
    RESTORE,
    /** Permanently delete a record (Filament {@code forceDelete} ability, distinct from delete). */
    FORCE_DELETE,
    /** Reorder records (Filament {@code reorder} ability, gating drag-to-reorder). */
    REORDER
}
