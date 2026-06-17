/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit;

import java.util.Objects;
import java.util.Optional;

import org.jspecify.annotations.Nullable;

/**
 * Registers a {@link DashboardWidget} on a {@link Dashboard} with grid-placement overrides applied
 * at registration time (the Filament {@code WidgetConfiguration} / {@code Widget::make([...])}): an
 * adopter can pin a widget's column span and sort where it is placed, without subclassing the
 * widget. The configuration's overrides win over the widget's own values.
 */
public final class WidgetConfiguration implements DashboardWidget {

    private final DashboardWidget delegate;
    private @Nullable ColumnSpan columnSpanOverride;
    private @Nullable Integer sortOverride;

    private WidgetConfiguration(DashboardWidget delegate) {
        this.delegate = Objects.requireNonNull(delegate, "delegate");
    }

    /**
     * @param widget the widget to configure
     * @return a configuration wrapping the widget
     */
    public static WidgetConfiguration make(DashboardWidget widget) {
        return new WidgetConfiguration(widget);
    }

    /**
     * Overrides the widget's column span for this placement.
     *
     * @param columnSpan the span
     * @return this configuration
     */
    public WidgetConfiguration columnSpan(ColumnSpan columnSpan) {
        this.columnSpanOverride = Objects.requireNonNull(columnSpan, "columnSpan");
        return this;
    }

    /**
     * Overrides the widget's column span with a fixed count.
     *
     * @param span the column count
     * @return this configuration
     */
    public WidgetConfiguration columnSpan(int span) {
        return columnSpan(ColumnSpan.of(span));
    }

    /**
     * Overrides the widget's sort key for this placement.
     *
     * @param sort the sort key
     * @return this configuration
     */
    public WidgetConfiguration sort(int sort) {
        this.sortOverride = sort;
        return this;
    }

    /** @return the wrapped widget */
    public DashboardWidget widget() {
        return delegate;
    }

    @Override
    public int sort() {
        return Optional.ofNullable(sortOverride).orElseGet(delegate::sort);
    }

    @Override
    public ColumnSpan columnSpan() {
        return columnSpanOverride != null ? columnSpanOverride : delegate.columnSpan();
    }

    @Override
    public boolean canView() {
        return delegate.canView();
    }
}
