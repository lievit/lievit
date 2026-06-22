/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit.page;

import static org.assertj.core.api.Assertions.assertThat;

import io.lievit.kit.FilterState;
import io.lievit.kit.InMemorySavedViewStore;
import io.lievit.kit.ListRequest;
import io.lievit.kit.SavedView;
import io.lievit.kit.SavedViewCounter;
import io.lievit.kit.SavedViewStore;
import io.lievit.kit.SavedViews;
import io.lievit.kit.Sort;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;

/**
 * Specifies the {@link SavedViewsDriver}: it merges a table's presets with a user's stored views,
 * resolves the active view (explicit -> user default -> first preset -> none), computes per-view
 * counts through a {@link SavedViewCounter} stub, and assembles the {@link SavedViewsView} with the
 * dirty flag.
 */
class SavedViewsDriverTest {

    private static final String RES = "activities";

    private static final SavedView OVERDUE =
            SavedView.preset("overdue", RES, "Overdue",
                    FilterState.EMPTY.with("state", "overdue"), List.of(), Sort.NONE, 0);

    private static final SavedView SOON =
            SavedView.preset("soon", RES, "Due soon",
                    FilterState.EMPTY.with("state", "soon"), List.of(), Sort.NONE, 0);

    /** A counter that returns the filter-value length, so each view gets a distinct, checkable count. */
    private static final SavedViewCounter COUNTER =
            (resourceKey, filters) -> filters.value("state").map(s -> (long) s.length()).orElse(0L);

    private SavedViewsDriver driver(SavedViewStore store, SavedViewCounter counter) {
        return new SavedViewsDriver(RES, List.of(OVERDUE, SOON), store, counter);
    }

    /**
     * @spec.given presets + a stored user view, no explicit selection and no user default
     * @spec.when  the active view is resolved
     * @spec.then  it falls back to the first preset
     */
    @Test
    void resolves_to_the_first_preset_when_nothing_else_applies() {
        SavedViewStore store = new InMemorySavedViewStore();
        store.save(SavedView.user("u1", RES, "ada", "Mine", FilterState.EMPTY, List.of(),
                Sort.NONE, 0, false));

        Optional<SavedView> active = driver(store, null).resolveActive("ada", null);

        assertThat(active).map(SavedView::id).contains("overdue");
    }

    /**
     * @spec.given a user with a stored default view, no explicit selection
     * @spec.when  the active view is resolved
     * @spec.then  the stored default wins over the first preset
     */
    @Test
    void resolves_to_the_user_default_over_a_preset() {
        SavedViewStore store = new InMemorySavedViewStore();
        store.save(SavedView.user("u1", RES, "ada", "Mine", FilterState.EMPTY, List.of(),
                Sort.NONE, 0, false));
        store.setDefault("ada", RES, "u1");

        Optional<SavedView> active = driver(store, null).resolveActive("ada", null);

        assertThat(active).map(SavedView::id).contains("u1");
    }

    /**
     * @spec.given an explicit ?view selection naming a preset
     * @spec.when  the active view is resolved
     * @spec.then  the explicit selection wins over the user default
     */
    @Test
    void an_explicit_selection_wins() {
        SavedViewStore store = new InMemorySavedViewStore();
        store.save(SavedView.user("u1", RES, "ada", "Mine", FilterState.EMPTY, List.of(),
                Sort.NONE, 0, false));
        store.setDefault("ada", RES, "u1");

        Optional<SavedView> active = driver(store, null).resolveActive("ada", "soon");

        assertThat(active).map(SavedView::id).contains("soon");
    }

    /**
     * @spec.given a driver with a wired counter and a user-owned view
     * @spec.when  the switcher view-model is built for the active preset applied verbatim
     * @spec.then  presets come first then user views, each tab carries its count, presets are not
     *             editable but the user's own view is, and the active tab is marked clean
     */
    @Test
    void builds_tabs_with_counts_editability_and_a_clean_active() {
        SavedViewStore store = new InMemorySavedViewStore();
        store.save(SavedView.user("u1", RES, "ada", "Mine", FilterState.EMPTY, List.of(),
                Sort.NONE, 0, false));
        SavedViewsDriver driver = driver(store, COUNTER);

        ListRequest applied = SavedViews.apply(OVERDUE, 10);
        SavedViewsView model = driver.view("ada", OVERDUE, applied, 10);

        assertThat(model.tabs()).extracting(SavedViewsView.Tab::id)
                .containsExactly("overdue", "soon", "u1");
        assertThat(model.tabs()).filteredOn(SavedViewsView.Tab::editable)
                .extracting(SavedViewsView.Tab::id).containsExactly("u1");
        // "overdue" filter value length = 7, so the count badge reads 7.
        assertThat(model.tabs().get(0).count()).hasValue(7L);
        assertThat(model.activeId()).isEqualTo("overdue");
        assertThat(model.dirty()).isFalse();
    }

    /**
     * @spec.given no wired counter
     * @spec.when  the switcher view-model is built
     * @spec.then  no tab carries a count (the cheap default), and the switcher still renders
     */
    @Test
    void without_a_counter_no_tab_carries_a_count() {
        SavedViewsView model =
                driver(new InMemorySavedViewStore(), null)
                        .view("ada", OVERDUE, SavedViews.apply(OVERDUE, 10), 10);

        assertThat(model.hasTabs()).isTrue();
        assertThat(model.tabs()).allSatisfy(t -> assertThat(t.hasCount()).isFalse());
    }

    /**
     * @spec.given the active view but a request whose filters drifted from it
     * @spec.when  the switcher view-model is built
     * @spec.then  the dirty flag is raised (unsaved changes on the view)
     */
    @Test
    void a_drifted_request_marks_the_switcher_dirty() {
        ListRequest drifted =
                SavedViews.apply(OVERDUE, 10).withFilters(FilterState.EMPTY.with("state", "done"));

        SavedViewsView model =
                driver(new InMemorySavedViewStore(), null).view("ada", OVERDUE, drifted, 10);

        assertThat(model.dirty()).isTrue();
    }
}
