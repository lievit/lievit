/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Objects;

/**
 * An ordered set of column sorts the table requests of its {@link RecordRepository}: the
 * Filament {@code CanSortRecords} sort state, generalized to multi-column (primary sort first, ties
 * broken by the next, and so on).
 *
 * <p>The kit never executes the sort itself: it carries the requested order on the
 * {@link RecordRepository.Query} so the adopter's repository translates it to SQL {@code ORDER BY}
 * (or an in-memory comparator). Each {@link Order} names the column by its sort key (the column's
 * {@link Column#sortKey()}), not its label, so the SQL column name is stable under a label rename.
 */
public final class Sort {

    /** The empty sort (the repository falls back to its natural order). */
    public static final Sort NONE = new Sort(List.of());

    private final List<Order> orders;

    private Sort(List<Order> orders) {
        this.orders = List.copyOf(orders);
    }

    /**
     * @param column the column sort key
     * @param direction the direction
     * @return a single-column sort
     */
    public static Sort by(String column, SortDirection direction) {
        return new Sort(List.of(new Order(column, direction)));
    }

    /**
     * @param column the column sort key, sorted ascending
     * @return a single-column ascending sort
     */
    public static Sort asc(String column) {
        return by(column, SortDirection.ASC);
    }

    /**
     * @param column the column sort key, sorted descending
     * @return a single-column descending sort
     */
    public static Sort desc(String column) {
        return by(column, SortDirection.DESC);
    }

    /**
     * @param orders the ordered column sorts (primary first)
     * @return a multi-column sort
     */
    public static Sort of(List<Order> orders) {
        return orders.isEmpty() ? NONE : new Sort(orders);
    }

    /**
     * Appends a secondary sort, returning a new sort (immutable). A repeated column is moved to the
     * new position with the new direction rather than duplicated, so toggling a header stays stable.
     *
     * @param column the next column sort key
     * @param direction its direction
     * @return a new sort with the order appended (or moved)
     */
    public Sort then(String column, SortDirection direction) {
        List<Order> next = new ArrayList<>();
        for (Order o : orders) {
            if (!o.column().equals(column)) {
                next.add(o);
            }
        }
        next.add(new Order(column, direction));
        return new Sort(next);
    }

    /**
     * Toggles the sort for a single clicked column: if it is already the (only) sort, flips its
     * direction; otherwise replaces the sort with this column ascending. This is the single-column
     * header-click behaviour; multi-sort uses {@link #then}.
     *
     * @param column the clicked column sort key
     * @return the new sort state
     */
    public Sort toggled(String column) {
        for (Order o : orders) {
            if (o.column().equals(column)) {
                return Sort.by(column, o.direction().toggle());
            }
        }
        return Sort.asc(column);
    }

    /**
     * @param column a column sort key
     * @return the direction this sort applies to that column, or empty if it does not sort it
     */
    public java.util.Optional<SortDirection> directionOf(String column) {
        for (Order o : orders) {
            if (o.column().equals(column)) {
                return java.util.Optional.of(o.direction());
            }
        }
        return java.util.Optional.empty();
    }

    /** @return the orders, primary first, as an unmodifiable snapshot */
    public List<Order> orders() {
        return Collections.unmodifiableList(orders);
    }

    /** @return whether no column is sorted */
    public boolean isEmpty() {
        return orders.isEmpty();
    }

    /**
     * One column's sort: its sort key plus a direction.
     *
     * @param column the column sort key (a stable SQL-column-style name, not the label)
     * @param direction the direction
     */
    public record Order(String column, SortDirection direction) {
        /** Compact constructor: both components are required, the column non-blank. */
        public Order {
            Objects.requireNonNull(column, "column");
            Objects.requireNonNull(direction, "direction");
            if (column.isBlank()) {
                throw new IllegalArgumentException("column must be non-blank");
            }
        }
    }

    @Override
    public boolean equals(Object o) {
        return o instanceof Sort other && orders.equals(other.orders);
    }

    @Override
    public int hashCode() {
        return orders.hashCode();
    }

    @Override
    public String toString() {
        return "Sort" + orders;
    }
}
