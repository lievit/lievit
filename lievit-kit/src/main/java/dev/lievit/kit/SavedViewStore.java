/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit;

import java.util.List;
import java.util.Optional;

/**
 * The persistence-agnostic store behind a table's user {@link SavedView saved views} (the per-user
 * "list view book", abstracted). Mirrors {@link dev.lievit.kit.settings.SettingsStore}: the kit ships
 * the contract + {@link InMemorySavedViewStore} and an adopter wires a durable (JDBC) one.
 *
 * <p>Every method is <strong>owner-scoped</strong>: a store never reads, writes, or deletes another
 * user's view (the per-user invariant carried over from the legacy saved-search book). A code-owned
 * {@link SavedView.Origin#PRESET preset} is never persisted here, so {@link #delete} refuses one and
 * {@link #listFor} returns only user views (the host prepends the table's presets when assembling the
 * switcher). At most one of an owner's views for a resource is the {@link SavedView#isDefault()
 * default}; {@link #setDefault} enforces that exclusivity atomically.
 */
public interface SavedViewStore {

    /**
     * The owner's user views for a resource, ordered by name (the host prepends the table's presets).
     *
     * @param owner       the owning username
     * @param resourceKey the resource/table key
     * @return the owner's user views, name-ordered (empty when none were saved)
     */
    List<SavedView> listFor(String owner, String resourceKey);

    /**
     * Finds one of the owner's views by id.
     *
     * @param owner       the owning username
     * @param resourceKey the resource/table key
     * @param id          the view id
     * @return the view, or empty when the owner has no such view for this resource
     */
    Optional<SavedView> find(String owner, String resourceKey, String id);

    /**
     * Creates or overwrites a user view (matched by its {@link SavedView#id() id}), keyed by its own
     * {@link SavedView#owner()}/{@link SavedView#resourceKey()}. A {@link SavedView.Origin#PRESET} is
     * rejected (presets are code-owned, never persisted).
     *
     * @param view the user view to persist
     * @return the persisted view
     * @throws IllegalArgumentException if {@code view} is a preset
     */
    SavedView save(SavedView view);

    /**
     * Deletes one of the owner's user views. Idempotent (deleting a missing id is a no-op) and
     * owner-scoped (another owner's view is never touched). A preset cannot be deleted.
     *
     * @param owner       the owning username
     * @param resourceKey the resource/table key
     * @param id          the view id
     * @return whether a view was actually removed
     */
    boolean delete(String owner, String resourceKey, String id);

    /**
     * Makes one of the owner's views the default for a resource, clearing the previous default
     * atomically so exactly one of the owner's views for this resource is the default.
     *
     * @param owner       the owning username
     * @param resourceKey the resource/table key
     * @param id          the view id to make default
     */
    void setDefault(String owner, String resourceKey, String id);

    /**
     * The owner's default view for a resource, if one is pinned.
     *
     * @param owner       the owning username
     * @param resourceKey the resource/table key
     * @return the default view, or empty when the owner pinned none
     */
    Optional<SavedView> defaultFor(String owner, String resourceKey);
}
