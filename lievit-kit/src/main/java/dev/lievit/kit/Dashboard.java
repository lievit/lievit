/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit;

import java.util.Comparator;
import java.util.List;

/**
 * The dashboard page: renders a responsive grid of {@link DashboardWidget}s (the Filament
 * {@code Dashboard} page). It is the landing surface of the admin. An adopter subclasses this and
 * overrides {@link #widgets()}; the grid orders them by {@link DashboardWidget#sort()}, filters out
 * those whose {@link DashboardWidget#canView()} is false, and lays them out across
 * {@link #columns()} grid columns honouring each widget's {@link DashboardWidget#columnSpan()}.
 *
 * <p>This is distinct from the stat-only {@link WidgetPage}: a dashboard hosts the full widget
 * family (stats, charts, table widgets) with grid placement, where {@code WidgetPage} hosts only
 * the heading/value/description {@link Widget}s.
 */
public abstract class Dashboard {

    /**
     * The page slug (defaults to {@code "dashboard"} so the panel mounts it at the panel root).
     *
     * @return the slug
     */
    public String slug() {
        return "dashboard";
    }

    /**
     * The navigation label.
     *
     * @return the label
     */
    public String label() {
        return "Dashboard";
    }

    /**
     * The number of columns in the responsive grid at the default breakpoint (Filament's
     * {@code getColumns}). Defaults to two; override for a wider grid.
     *
     * @return the column count (clamped to {@code >= 1})
     */
    public int columns() {
        return 2;
    }

    /**
     * The widgets to place on the dashboard, in declaration order (the grid re-orders by sort).
     *
     * @return the widgets (may be empty, never null)
     */
    public abstract List<DashboardWidget> widgets();

    /**
     * Builds the grid: the visible widgets ({@link DashboardWidget#canView()} true) ordered
     * ascending by {@link DashboardWidget#sort()}. The caller lays each out using its
     * {@link DashboardWidget#columnSpan()} against {@link #columns()}.
     *
     * @return the widgets to render, filtered and sorted
     */
    public List<DashboardWidget> visibleWidgets() {
        return widgets().stream()
                .filter(DashboardWidget::canView)
                .sorted(Comparator.comparingInt(DashboardWidget::sort))
                .toList();
    }

    /**
     * Resolves a widget's effective column span at a breakpoint, clamped to the grid width: a span
     * wider than the grid is capped at the grid column count, and a full-width span fills the grid.
     *
     * @param widget the widget
     * @param breakpoint the breakpoint key (see {@link ColumnSpan})
     * @return the effective column count this widget occupies (1..columns)
     */
    public int effectiveSpan(DashboardWidget widget, String breakpoint) {
        int gridColumns = Math.max(1, columns());
        ColumnSpan span = widget.columnSpan();
        if (span.isFull()) {
            return gridColumns;
        }
        return Math.min(span.at(breakpoint), gridColumns);
    }
}
