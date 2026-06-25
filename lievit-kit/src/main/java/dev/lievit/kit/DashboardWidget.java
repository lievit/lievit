/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit;

/**
 * A widget that can be placed in the dashboard grid (the Filament {@code Widget} base: {@code sort},
 * {@code columnSpan}, {@code canView}). It is separate from the stat-shaped {@link Widget} so that
 * non-stat widgets ({@link ChartWidget}, {@link TableWidget}) participate in the grid without being
 * forced to expose a single {@code value()}.
 *
 * <p>The grid reads {@link #sort()} to order widgets, {@link #columnSpan()} to size them
 * responsively, and {@link #canView()} to filter hidden ones. Implementors must not rely on runtime
 * reflection (ADR-0006).
 */
public interface DashboardWidget {

    /**
     * @return the sort key (ascending) deciding this widget's position in the grid; default last
     */
    default int sort() {
        return Integer.MAX_VALUE;
    }

    /**
     * @return how many grid columns this widget spans (default a single column)
     */
    default ColumnSpan columnSpan() {
        return ColumnSpan.of(1);
    }

    /**
     * Whether this widget is visible to the current user. Override to hide a widget behind an
     * authorization or feature check; a hidden widget is filtered out of the grid.
     *
     * @return {@code true} to show the widget (default)
     */
    default boolean canView() {
        return true;
    }
}
