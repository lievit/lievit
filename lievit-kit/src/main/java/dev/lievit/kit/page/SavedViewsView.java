/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit.page;

import java.util.List;
import java.util.OptionalLong;

/**
 * The render view-model of the saved-views switcher (the Salesforce list-view tab strip / Filament
 * advanced-table "tabs"): the ordered {@link Tab tabs} (presets first, then the user's views), which
 * one is {@link #activeId() active}, and whether the current list state has drifted from it
 * ({@link #dirty()}, the "this view has unsaved changes" affordance). Pure data: the
 * {@code kit/table.jte} switcher iterates it, the host's wire component owns the save/delete actions.
 *
 * <p>The switcher renders only when {@link #hasTabs()}: a table with no presets and no saved views
 * shows nothing (zero overhead, like the rest of the table chrome).
 *
 * @param tabs     the switchable views as tabs, presets first then user views; empty hides the switcher
 * @param activeId the id of the currently-applied view ({@code ""} = ad-hoc, no view active)
 * @param dirty    whether the current list state differs from the active view (drives Save/Update)
 */
public record SavedViewsView(List<Tab> tabs, String activeId, boolean dirty) {

    /** The empty switcher: no views, nothing rendered. */
    public static final SavedViewsView NONE = new SavedViewsView(List.of(), "", false);

    /** Compact constructor: defends the list and never-nulls the active id. */
    public SavedViewsView {
        tabs = List.copyOf(tabs);
        activeId = activeId == null ? "" : activeId;
    }

    /** @return whether the switcher renders at all (at least one view exists) */
    public boolean hasTabs() {
        return !tabs.isEmpty();
    }

    /**
     * @param id a view id
     * @return whether that tab is the active one
     */
    public boolean isActive(String id) {
        return !activeId.isEmpty() && activeId.equals(id);
    }

    /**
     * One switcher tab: a view's id + display name, whether it is the owner's default (the pinned
     * star), whether the current user may edit/delete it (a preset is not editable), and the optional
     * per-view record count (the badge; absent when no {@link dev.lievit.kit.SavedViewCounter} is wired).
     *
     * @param id       the view id (the {@code ?view=<id>} switch target)
     * @param name     the display label (a user-supplied name; the template auto-escapes it)
     * @param isDefault whether this is the owner's default/pinned view
     * @param editable whether this view can be edited/deleted (a user view owned by the current user)
     * @param count    the matching-row count, or empty when no counter is wired
     */
    public record Tab(String id, String name, boolean isDefault, boolean editable, OptionalLong count) {

        /** Compact constructor: never-nulls the optional count. */
        public Tab {
            count = count == null ? OptionalLong.empty() : count;
        }

        /** @return whether this tab shows a count badge */
        public boolean hasCount() {
            return count.isPresent();
        }
    }
}
