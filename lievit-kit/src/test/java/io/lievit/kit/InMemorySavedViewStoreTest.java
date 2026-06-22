/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;
import org.junit.jupiter.api.Test;

/**
 * Specifies the in-memory {@link SavedViewStore}: owner-scoped reads/writes/deletes, the
 * at-most-one-default invariant, an idempotent delete, a refused preset save, and name ordering
 * (the per-user "list view book").
 */
class InMemorySavedViewStoreTest {

    private final SavedViewStore store = new InMemorySavedViewStore();

    private static SavedView view(String id, String owner, String name) {
        return SavedView.user(id, "activities", owner, name, FilterState.EMPTY, List.of(),
                Sort.NONE, 0, false);
    }

    /**
     * @spec.given views saved by two different owners for the same resource
     * @spec.when  one owner lists their views
     * @spec.then  they see only their own (no cross-user read)
     */
    @Test
    void listing_is_owner_scoped() {
        store.save(view("a1", "ada", "Ada one"));
        store.save(view("b1", "bob", "Bob one"));

        assertThat(store.listFor("ada", "activities")).extracting(SavedView::id).containsExactly("a1");
        assertThat(store.listFor("bob", "activities")).extracting(SavedView::id).containsExactly("b1");
    }

    /**
     * @spec.given two views saved out of name order
     * @spec.when  the owner lists them
     * @spec.then  they come back ordered by name
     */
    @Test
    void listing_is_name_ordered() {
        store.save(view("z", "ada", "Zulu"));
        store.save(view("a", "ada", "Alpha"));

        assertThat(store.listFor("ada", "activities")).extracting(SavedView::name)
                .containsExactly("Alpha", "Zulu");
    }

    /**
     * @spec.given two of an owner's views, one set as default
     * @spec.when  the other is then set as default
     * @spec.then  exactly one view is the default (the first is cleared)
     */
    @Test
    void set_default_is_exclusive() {
        store.save(view("a", "ada", "Alpha"));
        store.save(view("b", "ada", "Bravo"));

        store.setDefault("ada", "activities", "a");
        store.setDefault("ada", "activities", "b");

        assertThat(store.defaultFor("ada", "activities")).map(SavedView::id).contains("b");
        assertThat(store.listFor("ada", "activities")).filteredOn(SavedView::isDefault).hasSize(1);
    }

    /**
     * @spec.given an existing view
     * @spec.when  it is deleted twice
     * @spec.then  the first delete removes it (true), the second is a no-op (false)
     */
    @Test
    void delete_is_idempotent_and_owner_scoped() {
        store.save(view("a", "ada", "Alpha"));

        assertThat(store.delete("ada", "activities", "a")).isTrue();
        assertThat(store.delete("ada", "activities", "a")).isFalse();
        assertThat(store.delete("bob", "activities", "a")).isFalse();
    }

    /**
     * @spec.given a code-owned preset view
     * @spec.when  it is handed to the store to save
     * @spec.then  the store refuses it (presets are never persisted)
     */
    @Test
    void a_preset_cannot_be_persisted() {
        SavedView preset =
                SavedView.preset("overdue", "activities", "Overdue", FilterState.EMPTY, List.of(),
                        Sort.NONE, 0);

        assertThatThrownBy(() -> store.save(preset)).isInstanceOf(IllegalArgumentException.class);
    }

    /**
     * @spec.given a view saved, then re-saved with the same id and a new name
     * @spec.when  the owner looks it up
     * @spec.then  the overwrite wins (save is create-or-overwrite by id)
     */
    @Test
    void save_overwrites_by_id() {
        store.save(view("a", "ada", "Alpha"));
        store.save(view("a", "ada", "Renamed"));

        assertThat(store.find("ada", "activities", "a")).map(SavedView::name).contains("Renamed");
        assertThat(store.listFor("ada", "activities")).hasSize(1);
    }
}
