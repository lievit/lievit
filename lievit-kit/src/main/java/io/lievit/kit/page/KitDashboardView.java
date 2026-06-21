/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit.page;

import io.lievit.kit.DashboardWidget;
import java.util.List;

/**
 * The render-time bundle the kit widget grid template ({@code kit/widget/grid.jte}) reads: the
 * dashboard's {@link DashboardWidget widgets} already in DISPLAY ORDER (filtered to the viewable ones
 * and sorted by {@link DashboardWidget#sort()}) plus the grid column count. It is the widget twin of
 * {@link KitTableView}: a single typed object carrying everything the canonical Filament dashboard
 * chrome needs, so the template is a pure painter (it renders the list it is given, in order, and
 * does not re-filter or re-sort).
 *
 * <p>A host builds it with {@link #of(List)} (passing the already-ordered widgets) or, more usually,
 * lets {@link KitDashboardComponent} do the filter + sort from a {@code WidgetPage}.
 *
 * @param widgets the dashboard widgets, in display order (viewable + sorted)
 * @param columns the grid column count (the Filament dashboard default is 4)
 */
public record KitDashboardView(List<DashboardWidget> widgets, int columns) {

    /** The Filament dashboard default column count. */
    public static final int DEFAULT_COLUMNS = 4;

    /** Compact constructor: defends the widget list and clamps the column count to at least one. */
    public KitDashboardView {
        widgets = List.copyOf(widgets);
        columns = Math.max(1, columns);
    }

    /**
     * The default bundle: the given widgets in their given order, at the default column count.
     *
     * @param widgets the dashboard widgets, in display order
     * @return the bundle
     */
    public static KitDashboardView of(List<DashboardWidget> widgets) {
        return new KitDashboardView(widgets, DEFAULT_COLUMNS);
    }

    /**
     * @param columns the grid column count
     * @return a copy of this bundle at the given column count
     */
    public KitDashboardView withColumns(int columns) {
        return new KitDashboardView(widgets, columns);
    }

    /** @return whether the dashboard has any widget to render */
    public boolean isEmpty() {
        return widgets.isEmpty();
    }
}
