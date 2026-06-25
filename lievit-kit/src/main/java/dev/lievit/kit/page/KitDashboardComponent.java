/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit.page;

import dev.lievit.kit.DashboardWidget;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;

/**
 * The kit-owned, GENERIC render entry for the canonical dashboard chrome ({@code kit/widget/grid.jte}):
 * the reusable logic a concrete {@code @LievitComponent} (or a plain controller) delegates to in order
 * to render a {@code WidgetPage}'s widgets as the full Filament dashboard grid, instead of
 * hand-assembling the grid. It is the widget twin of {@link KitTableComponent}.
 *
 * <p>It owns the two render-time decisions the pure widget models do not: which widgets to SHOW
 * ({@link DashboardWidget#canView()} filters hidden ones out) and in which ORDER
 * ({@link DashboardWidget#sort()} ascending, the Filament grid order). The {@link #render()} result is
 * the {@link KitDashboardView} the template paints; the host can adjust the column count on it.
 *
 * <p>Why a separate driver and not a component: as with {@link KitTableComponent}, the lievit core
 * binds only the {@code @Wire} fields and {@code @LievitAction} methods declared on the component class
 * ITSELF (not inherited), so the kit cannot ship a base {@code @LievitComponent} a page subclasses.
 * Instead a concrete component delegates the render bundle to this driver.
 */
public final class KitDashboardComponent {

    private final List<DashboardWidget> widgets;
    private int columns = KitDashboardView.DEFAULT_COLUMNS;

    /**
     * @param widgets the dashboard's widgets (a {@code WidgetPage.widgets()} whose elements are
     *     {@link DashboardWidget}s; the kit's concrete widgets all are)
     */
    public KitDashboardComponent(List<DashboardWidget> widgets) {
        this.widgets = List.copyOf(Objects.requireNonNull(widgets, "widgets"));
    }

    /**
     * Sets the grid column count (default {@link KitDashboardView#DEFAULT_COLUMNS}).
     *
     * @param columns the column count
     * @return this component
     */
    public KitDashboardComponent columns(int columns) {
        this.columns = columns;
        return this;
    }

    /**
     * Builds the render bundle: the viewable widgets ({@link DashboardWidget#canView()}) sorted by
     * {@link DashboardWidget#sort()} ascending, at the configured column count.
     *
     * @return the render bundle the {@code kit/widget/grid.jte} template reads
     */
    public KitDashboardView render() {
        List<DashboardWidget> ordered =
                widgets.stream()
                        .filter(DashboardWidget::canView)
                        .sorted(Comparator.comparingInt(DashboardWidget::sort))
                        .toList();
        return new KitDashboardView(ordered, columns);
    }
}
