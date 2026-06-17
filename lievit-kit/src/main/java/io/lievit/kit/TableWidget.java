/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit;

import java.util.List;
import java.util.Objects;
import java.util.Optional;

import org.jspecify.annotations.Nullable;

/**
 * Embeds a {@link Table} as a dashboard widget (the Filament {@code TableWidget}): a "Latest 5
 * orders" / "Pending approvals" card backed by the kit's own table + repository. It reads a single
 * lightweight {@link RecordRepository.Query page} (simple pagination by default, default size
 * {@link #DEFAULT_PAGE_SIZE}) and exposes the configured table so the shell renders the columns.
 *
 * <p>An adopter subclasses this and overrides {@link #table()} and {@link #repository()}; the
 * heading defaults to a label derived from the concrete class name (Filament's derived heading),
 * overridable via {@link #heading(String)}. It participates in the dashboard grid via
 * {@link DashboardWidget} and defaults to a full-width span (a table needs room).
 *
 * @param <T> the row type
 */
public abstract class TableWidget<T> implements DashboardWidget {

    /** The default number of rows a table widget shows. */
    public static final int DEFAULT_PAGE_SIZE = 5;

    private @Nullable String heading;
    private int pageSize = DEFAULT_PAGE_SIZE;
    private int sort = Integer.MAX_VALUE;

    /**
     * @return the configured table (columns + id function)
     */
    public abstract Table<T> table();

    /**
     * @return the data port the widget reads its rows from
     */
    public abstract RecordRepository<T> repository();

    /**
     * Overrides the heading (defaults to a label derived from the class name).
     *
     * @param heading the heading
     * @return this widget
     */
    public TableWidget<T> heading(String heading) {
        this.heading = Objects.requireNonNull(heading, "heading");
        return this;
    }

    /**
     * @param pageSize how many rows to show (the simple-pagination window)
     * @return this widget
     */
    public TableWidget<T> pageSize(int pageSize) {
        if (pageSize < 1) {
            throw new IllegalArgumentException("pageSize must be >= 1, got: " + pageSize);
        }
        this.pageSize = pageSize;
        return this;
    }

    /**
     * Sets the dashboard-grid sort key.
     *
     * @param sort the sort key
     * @return this widget
     */
    public TableWidget<T> sort(int sort) {
        this.sort = sort;
        return this;
    }

    /**
     * @return the heading: the explicit one if set, otherwise derived from the concrete class name
     *     ({@code RecentOrdersTableWidget} -&gt; {@code "Recent Orders"})
     */
    public String resolvedHeading() {
        if (heading != null) {
            return heading;
        }
        return deriveHeading(getClass().getSimpleName());
    }

    /** @return the explicit heading, if one was set */
    public Optional<String> heading() {
        return Optional.ofNullable(heading);
    }

    /**
     * Reads the widget's rows: a single lightweight page of {@link #pageSize} rows.
     *
     * @return the rows to render
     */
    public List<T> rows() {
        return repository().page(RecordRepository.Query.of(0, pageSize)).rows();
    }

    /** @return the simple-pagination window size */
    public int pageSize() {
        return pageSize;
    }

    @Override
    public int sort() {
        return sort;
    }

    @Override
    public ColumnSpan columnSpan() {
        return ColumnSpan.full();
    }

    /**
     * Derives a human heading from a class simple-name: drops a trailing {@code TableWidget} /
     * {@code Widget} suffix and splits camelCase into words.
     *
     * @param simpleName the class simple name
     * @return the derived heading
     */
    static String deriveHeading(String simpleName) {
        String base = simpleName;
        if (base.endsWith("TableWidget")) {
            base = base.substring(0, base.length() - "TableWidget".length());
        } else if (base.endsWith("Widget")) {
            base = base.substring(0, base.length() - "Widget".length());
        }
        if (base.isEmpty()) {
            return simpleName;
        }
        StringBuilder out = new StringBuilder();
        for (int i = 0; i < base.length(); i++) {
            char c = base.charAt(i);
            if (i > 0 && Character.isUpperCase(c)) {
                out.append(' ');
            }
            out.append(c);
        }
        return out.toString();
    }
}
