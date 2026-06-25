/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit.page;

import dev.lievit.kit.ListRequest;
import dev.lievit.kit.SavedView;
import dev.lievit.kit.SavedViewCounter;
import dev.lievit.kit.SavedViewStore;
import dev.lievit.kit.SavedViews;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.OptionalLong;
import org.jspecify.annotations.Nullable;

/**
 * The reusable logic of the saved-views switcher, factored out of a wire component the same way
 * {@link ListPageDriver} is: it merges a table's code-owned presets with a user's stored views, picks
 * the active one, computes the per-view counts (when a {@link SavedViewCounter} is wired), and
 * assembles the {@link SavedViewsView} the {@code kit/table.jte} switcher renders.
 *
 * <p>Active-view resolution order (Salesforce): an explicit {@code ?view=<id>} selection, else the
 * user's stored default, else the first preset, else none (an ad-hoc table with no active view). A
 * host calls {@link #resolveActive} to find the {@link SavedView} to apply (turn into a
 * {@link ListRequest} with {@link SavedViews#apply}), then {@link #view} to build the switcher
 * view-model for the request it ended up rendering.
 *
 * <p>The counter is optional: with none wired, the tabs carry no count badges (the cheap default).
 */
public final class SavedViewsDriver {

    private final String resourceKey;
    private final List<SavedView> presets;
    private final SavedViewStore store;
    private final @Nullable SavedViewCounter counter;

    /**
     * @param resourceKey the resource/table key (scopes the store + the counter)
     * @param presets     the table's code-owned preset views (rendered first, never editable)
     * @param store       the per-user saved-view store
     * @param counter     the per-view row counter, or {@code null} to render no count badges
     */
    public SavedViewsDriver(
            String resourceKey,
            List<SavedView> presets,
            SavedViewStore store,
            @Nullable SavedViewCounter counter) {
        this.resourceKey = Objects.requireNonNull(resourceKey, "resourceKey");
        this.presets = List.copyOf(presets);
        this.store = Objects.requireNonNull(store, "store");
        this.counter = counter;
    }

    /** @return the switchable views: presets first, then the owner's user views (store order). */
    public List<SavedView> all(String owner) {
        List<SavedView> all = new ArrayList<>(presets);
        all.addAll(store.listFor(owner, resourceKey));
        return List.copyOf(all);
    }

    /**
     * Resolves the active view for an owner given an optional explicit selection: the explicitly
     * selected view if present, else the owner's stored default, else the first preset, else none.
     *
     * @param owner             the current username
     * @param selectedId        the explicitly requested view id ({@code null}/blank = none requested)
     * @return the view to apply, or empty when no view is active (an ad-hoc table)
     */
    public Optional<SavedView> resolveActive(String owner, @Nullable String selectedId) {
        if (selectedId != null && !selectedId.isBlank()) {
            Optional<SavedView> explicit = byId(owner, selectedId);
            if (explicit.isPresent()) {
                return explicit;
            }
        }
        Optional<SavedView> userDefault = store.defaultFor(owner, resourceKey);
        if (userDefault.isPresent()) {
            return userDefault;
        }
        return presets.isEmpty() ? Optional.empty() : Optional.of(presets.get(0));
    }

    /** Finds a view (preset or user) by id for an owner. */
    public Optional<SavedView> byId(String owner, String id) {
        for (SavedView preset : presets) {
            if (preset.id().equals(id)) {
                return Optional.of(preset);
            }
        }
        return store.find(owner, resourceKey, id);
    }

    /**
     * Builds the switcher view-model for the state the host is rendering.
     *
     * @param owner    the current username (scopes editability + the user views)
     * @param active   the active view (from {@link #resolveActive}), or {@code null} for none
     * @param request  the list state actually being rendered (to compute {@code dirty})
     * @param defaultSize the table's default page size (to resolve a view's 0 page size)
     * @return the switcher view-model
     */
    public SavedViewsView view(
            String owner,
            @Nullable SavedView active,
            ListRequest request,
            int defaultSize) {
        List<SavedViewsView.Tab> tabs = new ArrayList<>();
        for (SavedView view : all(owner)) {
            boolean editable = view.isUser() && view.owner().equals(owner);
            tabs.add(new SavedViewsView.Tab(
                    view.id(), view.name(), view.isDefault(), editable, countOf(view)));
        }
        String activeId = active == null ? "" : active.id();
        boolean dirty = SavedViews.isDirty(active, request, defaultSize);
        return new SavedViewsView(tabs, activeId, dirty);
    }

    private OptionalLong countOf(SavedView view) {
        return counter == null
                ? OptionalLong.empty()
                : OptionalLong.of(counter.count(resourceKey, view.filters()));
    }
}
