/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit;

/**
 * The soft-delete extension of {@link RecordRepository} (the Filament {@code SoftDeletes} support):
 * a repository that opts into soft deletes implements this so the kit's
 * {@link RestoreAction}/{@link ForceDeleteAction} and the trashed-state visibility rules have a port
 * to call. {@link RecordRepository#delete} is the soft delete (sets the trashed marker);
 * {@link #restore} clears it and {@link #forceDelete} removes the row permanently.
 *
 * <p>Opt-in by design: a resource without soft deletes implements only {@link RecordRepository}, so
 * the soft-delete actions cannot be wired against it (they take a {@code SoftDeleteRepository}). The
 * kit never guesses whether a row is trashed; the adopter supplies that predicate to the actions.
 *
 * @param <T> the row type
 */
public interface SoftDeleteRepository<T> extends RecordRepository<T> {

    /**
     * Restores a soft-deleted row (clears its trashed marker). A no-op if the row is not trashed.
     *
     * @param id the row id
     */
    void restore(String id);

    /**
     * Permanently removes a row, bypassing the soft-delete marker (the row cannot be restored
     * afterwards). A no-op if no such row exists (idempotent).
     *
     * @param id the row id
     */
    void forceDelete(String id);

    /**
     * @param record the row
     * @return whether the row is currently soft-deleted (trashed)
     */
    boolean isTrashed(T record);
}
