/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package com.iambilotta.lievit.kit.hello;

import java.util.ArrayList;
import java.util.List;

import com.iambilotta.lievit.kit.AdminColumn;
import com.iambilotta.lievit.kit.AdminResource;
import com.iambilotta.lievit.kit.AdminTable;

/**
 * The render view-model the kit derives from an {@link AdminResource} for the list page: the table
 * heading, the column headers, and one {@link Row} per record (its id plus the cell strings the
 * columns extract). This is the seam the JTE template iterates; it is pure data, no engine knowledge.
 *
 * <p>In v0.1 this lives in the hello-admin harness to prove the wiring end-to-end; promoting it into
 * {@code src/main} is the next slice once a second resource exercises it (harvest-first).
 *
 * @param heading the table heading
 * @param headers the column labels, in order
 * @param rows one row per record
 */
public record AdminListView(String heading, List<String> headers, List<Row> rows) {

    /**
     * One rendered row: its route id plus the ordered cell strings.
     *
     * @param id the row id (from the table id function)
     * @param cells the cell values, aligned with {@link #headers()}
     */
    public record Row(String id, List<String> cells) {}

    /**
     * Builds the list view-model by reading the resource's rows through its repository port and its
     * columns through its table builder.
     *
     * @param resource the admin resource
     * @param <T> the row type
     * @return the view-model
     */
    public static <T> AdminListView of(AdminResource<T> resource) {
        AdminTable<T> table = resource.table();
        List<AdminColumn<T>> columns = table.columns();

        List<String> headers = new ArrayList<>();
        for (AdminColumn<T> column : columns) {
            headers.add(column.label());
        }

        List<Row> rows = new ArrayList<>();
        for (T record : resource.repository().findAll()) {
            List<String> cells = new ArrayList<>();
            for (AdminColumn<T> column : columns) {
                cells.add(column.cell(record));
            }
            rows.add(new Row(table.idOf(record), cells));
        }

        String heading = table.heading() == null ? resource.label() : table.heading();
        return new AdminListView(heading, headers, rows);
    }
}
