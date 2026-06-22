/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit.page;

import io.lievit.kit.AdminListView;
import io.lievit.kit.ColumnSummary;
import java.util.List;
import java.util.Set;
import org.jspecify.annotations.Nullable;
import io.lievit.kit.SavedView;

/**
 * The render-time bundle the kit table template ({@code kit/table.jte}) reads: the bounded
 * {@link AdminListView} (the pure projection of heading / headers / rows / pagination / controls the
 * builders produce) PLUS the render-only facts that depend on the host's URL shape and the current
 * request, which the pure view-model deliberately does not know:
 *
 * <ul>
 *   <li>the {@code printf} URL patterns the server-first controls stamp ({@link #pageHrefPattern()}
 *       for a numbered page link, {@link #sortHrefPattern()} for a sortable header link,
 *       {@link #sizeHrefPattern()} for the per-page selector), so every control is a real {@code <a
 *       href>} / {@code <select>} that works JS-off;
 *   <li>the active-filter {@link FilterChip indicator chips} (Filament's removable filter badges)
 *       and the {@link #resetFiltersHref() reset-all} href, derived by the host from its filter
 *       state (the per-chip remove-href is a host URL concern, not a builder one);
 *   <li>the {@link Selection bulk-selection state} (which row ids are selected this page, the
 *       select-all / indeterminate header state, the running count) the bulk bar reads;
 *   <li>the optional {@link ColumnSummary summary} cells the footer row renders.
 * </ul>
 *
 * <p>This split keeps {@link AdminListView} a pure, URL-agnostic projection (testable from the
 * builders alone) while giving the template ONE typed object that carries everything the canonical
 * Filament chrome needs. A host (a {@code @LievitComponent}, or {@link KitTableComponent}) builds it
 * with {@link #of(AdminListView)} and layers on the host-specific facts through the withers.
 *
 * @param view the bounded list projection (heading, headers, rows, pagination, controls)
 * @param pageHrefPattern a {@code printf} pattern with one {@code %d} = target page, for a numbered
 *     page link (e.g. {@code "/admin/cities?page=%d"}); empty drives the wire-only pager instead
 * @param sortHrefPattern a {@code printf} pattern with one {@code %s} = column sort key, for a
 *     sortable header link (e.g. {@code "/admin/cities?sort=%s"}); empty drives the wire-only sort
 * @param sizeHrefPattern a {@code printf} pattern with one {@code %d} = chosen page size, for the
 *     per-page selector option targets (e.g. {@code "/admin/cities?size=%d"}); empty hides the selector
 * @param resetFiltersHref the GET href that clears every active filter (Filament's "reset filters");
 *     empty hides the reset-all control
 * @param filterChips the active-filter indicator chips, one removable badge per active filter value;
 *     empty when no filter is active
 * @param selection the bulk-selection state (selected ids + counts), {@link Selection#NONE} when the
 *     table has no bulk actions
 * @param summaries the footer summary cells, one per summarized column; empty when none
 * @param labels the chrome's UI strings (the i18n seam); {@link KitTableLabels#DEFAULT} = English
 * @param columnToggleHrefPattern a {@code printf} pattern with one {@code %s} = column key, for a
 *     "Columns" checkbox item's GET toggle href (e.g. {@code "/admin/cities?toggle=%s"}); empty drives
 *     the wire-only toggle ({@link #ACTION_TOGGLE_COLUMN})
 */
public record KitTableView(
        AdminListView view,
        String pageHrefPattern,
        String sortHrefPattern,
        String sizeHrefPattern,
        String resetFiltersHref,
        List<FilterChip> filterChips,
        Selection selection,
        List<ColumnSummary> summaries,
        SavedViewsView savedViews,
        String viewHrefPattern,
        KitTableLabels labels,
        String columnToggleHrefPattern) {

    /** The wire action name the switcher's "save current as a new view" item dispatches. */
    public static final String ACTION_SAVE_VIEW = "saveView";

    /** The wire action name the switcher's "update this view" item dispatches. */
    public static final String ACTION_UPDATE_VIEW = "updateView";

    /** The wire action name the switcher's "set as default" item dispatches. */
    public static final String ACTION_SET_DEFAULT_VIEW = "setDefaultView";

    /** The wire action name the switcher's "delete view" item dispatches. */
    public static final String ACTION_DELETE_VIEW = "deleteView";

    /**
     * The wire action name the "Columns" dropdown's checkbox items dispatch when no
     * {@link #columnToggleHrefPattern() column-toggle href} is configured: a single
     * {@code l:click="toggleColumn"} carrying the toggled column key as the {@code col} argument.
     */
    public static final String ACTION_TOGGLE_COLUMN = "toggleColumn";

    /** Compact constructor: defends the lists and never-null the strings / saved-views. */
    public KitTableView {
        pageHrefPattern = pageHrefPattern == null ? "" : pageHrefPattern;
        sortHrefPattern = sortHrefPattern == null ? "" : sortHrefPattern;
        sizeHrefPattern = sizeHrefPattern == null ? "" : sizeHrefPattern;
        resetFiltersHref = resetFiltersHref == null ? "" : resetFiltersHref;
        filterChips = List.copyOf(filterChips);
        selection = selection == null ? Selection.NONE : selection;
        summaries = List.copyOf(summaries);
        savedViews = savedViews == null ? SavedViewsView.NONE : savedViews;
        viewHrefPattern = viewHrefPattern == null ? "" : viewHrefPattern;
        labels = labels == null ? KitTableLabels.DEFAULT : labels;
        columnToggleHrefPattern = columnToggleHrefPattern == null ? "" : columnToggleHrefPattern;
    }

    /**
     * The minimal bundle: just the projection, with wire-only controls (no URL patterns), no chips,
     * no bulk selection, no summaries, no saved-views switcher. The host layers the rest on with the
     * withers.
     *
     * @param view the bounded list projection
     * @return the bundle
     */
    public static KitTableView of(AdminListView view) {
        return new KitTableView(
                view, "", "", "", "", List.of(), Selection.NONE, List.of(), SavedViewsView.NONE, "",
                KitTableLabels.DEFAULT, "");
    }

    /**
     * @param pattern the {@code %d} page-link pattern
     * @return a copy carrying the numbered-page href pattern
     */
    public KitTableView withPageHref(String pattern) {
        return new KitTableView(
                view, pattern, sortHrefPattern, sizeHrefPattern, resetFiltersHref, filterChips,
                selection, summaries, savedViews, viewHrefPattern, labels, columnToggleHrefPattern);
    }

    /**
     * @param pattern the {@code %s} sort-link pattern
     * @return a copy carrying the sortable-header href pattern
     */
    public KitTableView withSortHref(String pattern) {
        return new KitTableView(
                view, pageHrefPattern, pattern, sizeHrefPattern, resetFiltersHref, filterChips,
                selection, summaries, savedViews, viewHrefPattern, labels, columnToggleHrefPattern);
    }

    /**
     * @param pattern the {@code %d} page-size pattern
     * @return a copy carrying the per-page selector href pattern
     */
    public KitTableView withSizeHref(String pattern) {
        return new KitTableView(
                view, pageHrefPattern, sortHrefPattern, pattern, resetFiltersHref, filterChips,
                selection, summaries, savedViews, viewHrefPattern, labels, columnToggleHrefPattern);
    }

    /**
     * @param resetHref the reset-all-filters href
     * @param chips the active-filter indicator chips
     * @return a copy carrying the filter indicators
     */
    public KitTableView withFilterIndicators(String resetHref, List<FilterChip> chips) {
        return new KitTableView(
                view, pageHrefPattern, sortHrefPattern, sizeHrefPattern, resetHref, chips,
                selection, summaries, savedViews, viewHrefPattern, labels, columnToggleHrefPattern);
    }

    /**
     * @param selection the bulk-selection state
     * @return a copy carrying the bulk-selection state
     */
    public KitTableView withSelection(Selection selection) {
        return new KitTableView(
                view, pageHrefPattern, sortHrefPattern, sizeHrefPattern, resetFiltersHref,
                filterChips, selection, summaries, savedViews, viewHrefPattern, labels, columnToggleHrefPattern);
    }

    /**
     * @param summaries the footer summary cells
     * @return a copy carrying the summary row
     */
    public KitTableView withSummaries(List<ColumnSummary> summaries) {
        return new KitTableView(
                view, pageHrefPattern, sortHrefPattern, sizeHrefPattern, resetFiltersHref,
                filterChips, selection, summaries, savedViews, viewHrefPattern, labels, columnToggleHrefPattern);
    }

    /**
     * @param savedViews the saved-views switcher view-model
     * @param pattern    the {@code %s} view-switch href pattern (e.g. {@code "/admin/cities?view=%s"});
     *     empty drives the wire-only switch
     * @return a copy carrying the saved-views switcher + its switch href
     */
    public KitTableView withSavedViews(SavedViewsView savedViews, String pattern) {
        return new KitTableView(
                view, pageHrefPattern, sortHrefPattern, sizeHrefPattern, resetFiltersHref,
                filterChips, selection, summaries, savedViews, pattern, labels, columnToggleHrefPattern);
    }

    /**
     * @param labels the chrome's UI strings (the i18n seam); a Spring host maps these from its own
     *     {@code MessageSource} once per render
     * @return a copy carrying the supplied labels
     */
    public KitTableView withLabels(KitTableLabels labels) {
        return new KitTableView(
                view, pageHrefPattern, sortHrefPattern, sizeHrefPattern, resetFiltersHref,
                filterChips, selection, summaries, savedViews, viewHrefPattern, labels, columnToggleHrefPattern);
    }

    /** @return whether any column-toggle entry renders (the "Columns" dropdown), per the view-model */
    public boolean hasColumnToggles() {
        return view.hasColumnToggles();
    }

    /**
     * @param pattern the {@code %s} column-toggle href pattern (e.g. {@code "/admin/cities?toggle=%s"})
     * @return a copy carrying the "Columns" checkbox-item toggle href pattern
     */
    public KitTableView withColumnToggleHref(String pattern) {
        return new KitTableView(
                view, pageHrefPattern, sortHrefPattern, sizeHrefPattern, resetFiltersHref,
                filterChips, selection, summaries, savedViews, viewHrefPattern, labels, pattern);
    }

    /** @return whether a real column-toggle href pattern is set (else the toggle dispatches by wire) */
    public boolean hasColumnToggleHref() {
        return !columnToggleHrefPattern.isBlank();
    }

    /**
     * @param key a toggleable column key
     * @return the GET toggle href for that column ({@link #columnToggleHrefPattern()} with the key
     *     substituted), or empty when no pattern is set (then the toggle dispatches by wire instead)
     */
    public String columnToggleHref(String key) {
        return hasColumnToggleHref() ? columnToggleHrefPattern.formatted(key) : "";
    }

    /** @return whether a real numbered-page href pattern is set (else the pager is wire-driven) */
    public boolean hasPageHref() {
        return !pageHrefPattern.isBlank();
    }

    /** @return whether a real sortable-header href pattern is set (else sort is wire-driven) */
    public boolean hasSortHref() {
        return !sortHrefPattern.isBlank();
    }

    /** @return whether the per-page selector renders (a size-href pattern is set) */
    public boolean hasSizeHref() {
        return !sizeHrefPattern.isBlank();
    }

    /** @return whether any active-filter indicator chip renders */
    public boolean hasFilterChips() {
        return !filterChips.isEmpty();
    }

    /** @return whether a reset-all-filters control renders */
    public boolean hasResetFiltersHref() {
        return !resetFiltersHref.isBlank();
    }

    /** @return whether a footer summary row renders */
    public boolean hasSummaries() {
        return !summaries.isEmpty();
    }

    /**
     * @param key a column sort key
     * @return the sort link for that column, the {@link #sortHrefPattern()} with the key substituted
     *     (empty when no sort href is configured). The host owns the toggled direction inside the
     *     pattern's query string if it wants asc/desc cycling.
     */
    public String sortHref(String key) {
        return hasSortHref() ? sortHrefPattern.formatted(key) : "";
    }

    /** @return whether a real saved-view switch href pattern is set (else the switch is wire-driven) */
    public boolean hasViewHref() {
        return !viewHrefPattern.isBlank();
    }

    /**
     * @param id a view id
     * @return the switch link for that view (the {@link #viewHrefPattern()} with the id substituted),
     *     or empty when no view href is configured (then the switch dispatches by wire instead)
     */
    public String viewHref(String id) {
        return hasViewHref() ? viewHrefPattern.formatted(id) : "";
    }

    /** @return whether the saved-views switcher renders (at least one preset or user view exists) */
    public boolean hasSavedViews() {
        return savedViews.hasTabs();
    }

    /**
     * One Filament active-filter indicator: a human label (e.g. {@code "Status: Active"}) and the GET
     * href that removes just that one filter value (the rest of the active filters preserved). A real
     * {@code <a href>}, so a chip drops a filter JS-off with no wire round-trip.
     *
     * @param label the human chip label
     * @param removeHref the GET href that removes this one filter value
     */
    public record FilterChip(String label, String removeHref) {}

    /**
     * The bulk-selection state the rendered table reads: which row ids on THIS page are selected, the
     * derived select-all / indeterminate header state, and the running selected/total counts the
     * "N of M selected" bar shows. {@link #NONE} is the no-bulk-actions default (nothing selectable),
     * which renders no checkbox column and no bulk bar.
     *
     * @param enabled whether the table offers bulk selection at all (a bulk action is registered)
     * @param selectedIds the row ids selected on the current page
     * @param pageRowCount the number of rows on the current page (for the select-all / indeterminate
     *     derivation)
     * @param total the number of rows the "N of M selected" bar counts against (the filtered set)
     */
    public record Selection(
            boolean enabled, Set<String> selectedIds, int pageRowCount, long total) {

        /** The no-selection default: the table renders no checkbox column and no bulk bar. */
        public static final Selection NONE = new Selection(false, Set.of(), 0, 0);

        /** Compact constructor: defends the id set. */
        public Selection {
            selectedIds = Set.copyOf(selectedIds);
        }

        /**
         * @param ids the selected row ids on this page
         * @param pageRowCount the number of rows on this page
         * @param total the filtered-set total
         * @return an enabled selection state
         */
        public static Selection of(Set<String> ids, int pageRowCount, long total) {
            return new Selection(true, ids, pageRowCount, total);
        }

        /**
         * @param id a row id
         * @return whether that row is selected (drives the per-row checkbox + the row's selected tint)
         */
        public boolean isSelected(@Nullable String id) {
            return id != null && selectedIds.contains(id);
        }

        /** @return the number of selected rows on this page (the "N of M selected" count) */
        public int selectedCount() {
            return selectedIds.size();
        }

        /** @return whether every row on the current page is selected (the header box is checked) */
        public boolean allSelected() {
            return pageRowCount > 0 && selectedIds.size() >= pageRowCount;
        }

        /**
         * @return whether some but not all page rows are selected (the header box is indeterminate /
         *     "mixed")
         */
        public boolean someSelected() {
            return !selectedIds.isEmpty() && !allSelected();
        }

        /** @return whether the bulk bar shows (selection is enabled and at least one row is selected) */
        public boolean hasSelection() {
            return enabled && !selectedIds.isEmpty();
        }
    }
}
