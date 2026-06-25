/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

/**
 * The render view-model for a relation-manager page: the related records of a PARENT record, shown
 * as a table, with the linking action(s) in the header and an unlink action per row (the Filament
 * {@code RelationManager} UI surface). The data port ({@link RelationshipRepository}) and the
 * {@link RelationshipAction}s landed already; this is the page that uses them, the twin of
 * {@link AdminListView} but scoped to a parent through the relationship port instead of the resource
 * repository.
 *
 * <p>The read is bounded to one parent's related records ({@link RelationshipRepository#related});
 * the columns come from a {@link Table} over the related-record type {@code R} (so the relation
 * manager reuses the same column DSL as a list page). Pure data, no engine knowledge: the JTE
 * template iterates it and stamps the header/row actions.
 *
 * @param heading the relation-manager heading
 * @param parentId the parent record id whose relations are shown
 * @param headers the related-record column labels, in order
 * @param rows one row per related record, with its id and ordered cells
 * @param headerActions the linking actions shown in the header (attach / associate)
 * @param rowActionLabel the per-row unlink action label (detach / dissociate), or {@code null} if
 *     no unlink action is configured
 */
public record RelationManagerView(
        String heading,
        String parentId,
        List<String> headers,
        List<Row> rows,
        List<String> headerActions,
        @org.jspecify.annotations.Nullable String rowActionLabel) {

    /** Compact constructor: defends the lists. */
    public RelationManagerView {
        headers = List.copyOf(headers);
        rows = List.copyOf(rows);
        headerActions = List.copyOf(headerActions);
    }

    /**
     * One related-record row: its id (the value an unlink action targets) and the ordered cell
     * strings aligned with {@link #headers()}.
     *
     * @param id the related-record id
     * @param cells the cell values, aligned with the columns
     */
    public record Row(String id, List<String> cells) {
        /** Compact constructor: defends the cell list. */
        public Row {
            cells = List.copyOf(cells);
        }
    }

    /**
     * Builds the relation-manager view-model for a parent: reads the parent's related records
     * through the relationship port, renders them with the supplied table's columns, and surfaces
     * the relationship actions (linking ones in the header, the first unlinking one per row).
     *
     * @param heading the page heading
     * @param parentId the parent record id
     * @param repository the relationship port
     * @param table the column DSL over the related-record type
     * @param actions the relationship actions configured for this relation
     * @param <R> the related-record type
     * @return the view-model
     */
    public static <R> RelationManagerView of(
            String heading,
            String parentId,
            RelationshipRepository<R> repository,
            Table<R> table,
            List<RelationshipAction<R>> actions) {
        Objects.requireNonNull(heading, "heading");
        Objects.requireNonNull(parentId, "parentId");
        Objects.requireNonNull(repository, "repository");
        Objects.requireNonNull(table, "table");
        Objects.requireNonNull(actions, "actions");

        List<Column<R>> columns = table.columns();
        List<String> headers = new ArrayList<>();
        for (Column<R> column : columns) {
            headers.add(column.label());
        }

        List<Row> rows = new ArrayList<>();
        for (R record : repository.related(parentId)) {
            List<String> cells = new ArrayList<>();
            for (Column<R> column : columns) {
                cells.add(column.cell(record));
            }
            rows.add(new Row(table.idOf(record), cells));
        }

        List<String> headerActions = new ArrayList<>();
        String rowActionLabel = null;
        for (RelationshipAction<R> action : actions) {
            if (action.isLinking()) {
                headerActions.add(action.label());
            } else if (rowActionLabel == null) {
                rowActionLabel = action.label();
            }
        }

        return new RelationManagerView(heading, parentId, headers, rows, headerActions, rowActionLabel);
    }
}
