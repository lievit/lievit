/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit.page;

import java.util.Objects;

/**
 * The label seam of the kit table chrome ({@code kit/table.jte}): the chrome's own UI strings
 * ("Columns", "Search...", "No results", the pagination summary, "Reset all", ...) as a plain value
 * object the host populates, so a non-English host supplies its own copy without forking the
 * template. {@link #DEFAULT} carries the original English text, so a host that does not pass labels
 * sees zero behaviour change.
 *
 * <p>Deliberately NOT a {@code MessageSource}: the kit has no Spring dependency and stays a pure
 * view-model. A Spring host maps its own {@code MessageSource} into this record once per render
 * (e.g. {@code new KitTableLabels(messages.getMessage("table.columns", ...), ...)}) and carries it on
 * the {@link KitTableView}. The {@code resultsCount} string is a {@code printf}-style template with
 * three positional {@code %s} arguments (first row, last row, total) so it survives word-order
 * differences across languages.
 *
 * @param search          the global-search input placeholder ("Search...")
 * @param searchAria      the global-search input accessible label ("Search")
 * @param clear           the clear-search button ("Clear")
 * @param filters         the filters trigger label ("Filters")
 * @param columns         the column-manager dropdown trigger ("Columns")
 * @param resetAll        the reset-all-filters link ("Reset all")
 * @param actions         the trailing per-row actions column header ("Actions")
 * @param edit            the default row edit link ("Edit")
 * @param noResults       the empty results-count line ("No results")
 * @param resultsCount    the populated results-count template, 3 positional {@code %s}
 *     (first, last, total): default {@code "Showing %s to %s of %s results"}
 * @param perPage         the per-page selector label ("Per page")
 * @param previous        the wire-pager previous button ("Previous")
 * @param next            the wire-pager next button ("Next")
 * @param page            the wire-pager position template, 2 positional {@code %s} (page, total
 *     pages): default {@code "Page %s of %s"}
 * @param deleteSelected  the bulk-delete button ("Delete selected")
 * @param newRecord       the create button ("New")
 * @param saveView        the saved-views "save current as new view" item
 * @param updateView      the saved-views "update this view" item
 * @param setDefaultView  the saved-views "set as default" item
 * @param deleteView      the saved-views "delete view" item
 * @param saveViewTrigger the saved-views manage dropdown trigger ("Save view")
 * @param unsavedChanges  the saved-views dirty indicator ("Unsaved changes")
 * @param more            the saved-views overflow dropdown trigger ("More")
 */
public record KitTableLabels(
        String search,
        String searchAria,
        String clear,
        String filters,
        String columns,
        String resetAll,
        String actions,
        String edit,
        String noResults,
        String resultsCount,
        String perPage,
        String previous,
        String next,
        String page,
        String deleteSelected,
        String newRecord,
        String saveView,
        String updateView,
        String setDefaultView,
        String deleteView,
        String saveViewTrigger,
        String unsavedChanges,
        String more) {

    /** The original English copy: a host that supplies no labels renders exactly as before. */
    public static final KitTableLabels DEFAULT =
            new KitTableLabels(
                    "Search...",
                    "Search",
                    "Clear",
                    "Filters",
                    "Columns",
                    "Reset all",
                    "Actions",
                    "Edit",
                    "No results",
                    "Showing %s to %s of %s results",
                    "Per page",
                    "Previous",
                    "Next",
                    "Page %s of %s",
                    "Delete selected",
                    "New",
                    "Save current as new view",
                    "Update this view",
                    "Set as default",
                    "Delete view",
                    "Save view",
                    "Unsaved changes",
                    "More");

    /** Compact constructor: never-nulls every field (a null falls back to the English default). */
    public KitTableLabels {
        search = orDefault(search, "Search...");
        searchAria = orDefault(searchAria, "Search");
        clear = orDefault(clear, "Clear");
        filters = orDefault(filters, "Filters");
        columns = orDefault(columns, "Columns");
        resetAll = orDefault(resetAll, "Reset all");
        actions = orDefault(actions, "Actions");
        edit = orDefault(edit, "Edit");
        noResults = orDefault(noResults, "No results");
        resultsCount = orDefault(resultsCount, "Showing %s to %s of %s results");
        perPage = orDefault(perPage, "Per page");
        previous = orDefault(previous, "Previous");
        next = orDefault(next, "Next");
        page = orDefault(page, "Page %s of %s");
        deleteSelected = orDefault(deleteSelected, "Delete selected");
        newRecord = orDefault(newRecord, "New");
        saveView = orDefault(saveView, "Save current as new view");
        updateView = orDefault(updateView, "Update this view");
        setDefaultView = orDefault(setDefaultView, "Set as default");
        deleteView = orDefault(deleteView, "Delete view");
        saveViewTrigger = orDefault(saveViewTrigger, "Save view");
        unsavedChanges = orDefault(unsavedChanges, "Unsaved changes");
        more = orDefault(more, "More");
    }

    private static String orDefault(String value, String fallback) {
        return value == null ? fallback : value;
    }

    /**
     * Renders the populated results-count line ("Showing X to Y of Z results"), filling the three
     * positional arguments of {@link #resultsCount()}.
     *
     * @param first the one-based index of the first row shown
     * @param last  the one-based index of the last row shown
     * @param total the total matching row count
     * @return the rendered count line
     */
    public String resultsCount(long first, long last, long total) {
        return String.format(resultsCount, first, last, total);
    }

    /**
     * Renders the wire-pager position ("Page X of Y"), filling the two positional arguments of
     * {@link #page()}.
     *
     * @param page  the current one-based page number
     * @param total the total page count
     * @return the rendered position line
     */
    public String page(int page, int total) {
        return String.format(this.page, page, total);
    }

    /**
     * Carries a single override of the column-manager label onto a copy (the most common single
     * override; the full record is built with the canonical constructor for everything else).
     *
     * @param columnsLabel the "Columns" label override
     * @return a copy with the columns label set
     */
    public KitTableLabels withColumns(String columnsLabel) {
        Objects.requireNonNull(columnsLabel, "columnsLabel");
        return new KitTableLabels(
                search, searchAria, clear, filters, columnsLabel, resetAll, actions, edit, noResults,
                resultsCount, perPage, previous, next, page, deleteSelected, newRecord, saveView,
                updateView, setDefaultView, deleteView, saveViewTrigger, unsavedChanges, more);
    }
}
