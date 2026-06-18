/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

import io.lievit.kit.RecordRepository.Page;
import io.lievit.kit.RecordRepository.Query;

/**
 * The selection state of a table's bulk-action checkboxes (the Filament select-rows +
 * "select all matching" state). Two shapes:
 *
 * <ul>
 *   <li><strong>explicit</strong>: the ids the user ticked on the current page; the selection is
 *       exactly that set.
 *   <li><strong>all-matching</strong>: "select all records matching the current filters", which
 *       SURVIVES pagination. The kit resolves the matching ids from the resource against the live
 *       {@link Query} (so the selection is the full filtered result set, not just the visible page),
 *       minus any individually deselected exceptions.
 * </ul>
 *
 * <p>Resolving an all-matching selection reads the resource page-by-page rather than the whole table
 * at once, honouring the repository's {@link RecordRepository#page(Query) page-only} contract (the
 * unbounded-{@code findAll} foot-gun the data port deliberately avoids). The resolved ids are what a
 * {@link BulkAction#runBulk} then authorizes and processes.
 */
public final class BulkSelection {

    private static final int RESOLVE_PAGE_SIZE = 500;

    private final boolean allMatching;
    private final List<String> explicitIds;
    private final Set<String> deselectedIds;

    private BulkSelection(boolean allMatching, List<String> explicitIds, Set<String> deselectedIds) {
        this.allMatching = allMatching;
        this.explicitIds = List.copyOf(explicitIds);
        this.deselectedIds = Set.copyOf(deselectedIds);
    }

    /**
     * @param ids the explicitly ticked row ids
     * @return an explicit selection of those ids
     */
    public static BulkSelection of(List<String> ids) {
        return new BulkSelection(false, ids, Set.of());
    }

    /**
     * @return an all-matching selection (select all records matching the current filters)
     */
    public static BulkSelection allMatching() {
        return new BulkSelection(true, List.of(), Set.of());
    }

    /**
     * Marks ids as deselected exceptions within an all-matching selection (the user un-ticked a few
     * rows after "select all"). No effect on an explicit selection.
     *
     * @param ids the ids to exclude
     * @return a new selection with the exceptions applied
     */
    public BulkSelection deselect(List<String> ids) {
        Set<String> merged = new LinkedHashSet<>(deselectedIds);
        merged.addAll(ids);
        return new BulkSelection(allMatching, explicitIds, merged);
    }

    /** @return whether this is the all-matching (survives-pagination) mode */
    public boolean isAllMatching() {
        return allMatching;
    }

    /** @return whether the selection covers no rows (so the bulk bar stays hidden) */
    public boolean isEmpty() {
        return !allMatching && explicitIds.isEmpty();
    }

    /**
     * Resolves the selection to the concrete row ids a bulk action will operate on. An explicit
     * selection yields its ticked ids; an all-matching selection walks the resource page-by-page
     * under the live query and yields every matching id minus the deselected exceptions.
     *
     * @param resource the resource whose repository and table map records to ids
     * @param query the live query (filters / search / sort) the all-matching mode matches against;
     *     its page window is ignored, the kit re-pages internally to walk the whole result set
     * @param <T> the resource row type
     * @return the resolved row ids, in result order
     */
    public <T> List<String> resolve(Resource<T> resource, Query query) {
        Objects.requireNonNull(resource, "resource");
        Objects.requireNonNull(query, "query");
        if (!allMatching) {
            return new ArrayList<>(explicitIds);
        }
        Table<T> table = resource.table();
        RecordRepository<T> repository = resource.repository();
        List<String> ids = new ArrayList<>();
        int offset = 0;
        while (true) {
            Query window =
                    new Query(offset, RESOLVE_PAGE_SIZE, query.sort(), query.search(), query.filters());
            Page<T> page = repository.page(window);
            for (T row : page.rows()) {
                String id = table.idOf(row);
                if (!deselectedIds.contains(id)) {
                    ids.add(id);
                }
            }
            offset += RESOLVE_PAGE_SIZE;
            if (offset >= page.total() || page.rows().isEmpty()) {
                break;
            }
        }
        return ids;
    }
}
