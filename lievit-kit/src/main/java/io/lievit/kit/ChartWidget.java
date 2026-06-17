/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit;

import java.time.Duration;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;

import org.jspecify.annotations.Nullable;

/**
 * A chart.js bridge widget (the Filament {@code ChartWidget}): renders a chart from a
 * {@link ChartType type}, a {@link ChartData data set} (labels + datasets), and an options map. It
 * carries the presentation slots a dashboard chart needs (heading, description, maxHeight, color,
 * collapsible), an optional value-to-label {@link #filters() filter} dropdown that re-queries the
 * data, a polling interval, and a data checksum so the client can patch the chart in place when the
 * recomputed data differs rather than re-rendering it.
 *
 * <p>An adopter subclasses this and overrides {@link #type()} and {@link #data()} (the four common
 * types ship as thin subclasses: {@link BarChartWidget}, {@link LineChartWidget},
 * {@link PieChartWidget}, {@link DoughnutChartWidget}). It participates in the dashboard grid via
 * {@link DashboardWidget}.
 */
public abstract class ChartWidget implements DashboardWidget {

    /** The chart.js chart types this bridge supports out of the box. */
    public enum ChartType {
        /** A bar chart. */
        BAR("bar"),
        /** A line chart. */
        LINE("line"),
        /** A pie chart. */
        PIE("pie"),
        /** A doughnut chart. */
        DOUGHNUT("doughnut"),
        /** A polar-area chart. */
        POLAR_AREA("polarArea"),
        /** A radar chart. */
        RADAR("radar"),
        /** A scatter chart. */
        SCATTER("scatter"),
        /** A bubble chart. */
        BUBBLE("bubble");

        private final String jsName;

        ChartType(String jsName) {
            this.jsName = jsName;
        }

        /** @return the chart.js type string (for example {@code "bar"}) */
        public String jsName() {
            return jsName;
        }
    }

    /**
     * A chart dataset: a label and its numeric values, aligned to the chart's labels.
     *
     * @param label the dataset label (shown in the legend)
     * @param values the dataset values
     */
    public record Dataset(String label, List<Number> values) {
        /** Compact constructor: both required; the values list is defended. */
        public Dataset {
            Objects.requireNonNull(label, "label");
            values = List.copyOf(Objects.requireNonNull(values, "values"));
        }
    }

    /**
     * The data a chart renders: the x-axis labels and one or more datasets.
     *
     * @param labels the axis labels
     * @param datasets the datasets
     */
    public record ChartData(List<String> labels, List<Dataset> datasets) {
        /** Compact constructor: both required; lists defended. */
        public ChartData {
            labels = List.copyOf(Objects.requireNonNull(labels, "labels"));
            datasets = List.copyOf(Objects.requireNonNull(datasets, "datasets"));
        }
    }

    private @Nullable String heading;
    private @Nullable String description;
    private @Nullable Integer maxHeight;
    private @Nullable Color color;
    private boolean collapsible;
    private final Map<String, String> filters = new LinkedHashMap<>();
    private @Nullable String activeFilter;
    private @Nullable Duration pollingInterval;
    private int sort = Integer.MAX_VALUE;

    /**
     * @return the chart.js chart type
     */
    public abstract ChartType type();

    /**
     * Builds the chart's data, honouring the active {@link #activeFilter() filter} if one is set.
     *
     * @return the chart data
     */
    public abstract ChartData data();

    /**
     * The chart.js options map (raw JS escape hatches are the adopter's responsibility). Defaults
     * to an empty map.
     *
     * @return the options
     */
    public Map<String, Object> options() {
        return Map.of();
    }

    /**
     * @param heading the chart heading
     * @return this widget
     */
    public ChartWidget heading(String heading) {
        this.heading = Objects.requireNonNull(heading, "heading");
        return this;
    }

    /**
     * @param description the chart description
     * @return this widget
     */
    public ChartWidget description(String description) {
        this.description = Objects.requireNonNull(description, "description");
        return this;
    }

    /**
     * @param maxHeight the chart max height in pixels
     * @return this widget
     */
    public ChartWidget maxHeight(int maxHeight) {
        if (maxHeight < 1) {
            throw new IllegalArgumentException("maxHeight must be >= 1, got: " + maxHeight);
        }
        this.maxHeight = maxHeight;
        return this;
    }

    /**
     * @param color the chart color
     * @return this widget
     */
    public ChartWidget color(Color color) {
        this.color = Objects.requireNonNull(color, "color");
        return this;
    }

    /**
     * @param collapsible whether the chart card can be collapsed
     * @return this widget
     */
    public ChartWidget collapsible(boolean collapsible) {
        this.collapsible = collapsible;
        return this;
    }

    /**
     * Adds a filter option (value to display label) to the chart's filter dropdown.
     *
     * @param value the filter value (passed to {@link #data()} via {@link #applyFilter(String)})
     * @param label the human label shown in the dropdown
     * @return this widget
     */
    public ChartWidget filter(String value, String label) {
        filters.put(Objects.requireNonNull(value, "value"), Objects.requireNonNull(label, "label"));
        return this;
    }

    /**
     * Selects the active filter value (re-queries the data on the next {@link #data()} call).
     *
     * @param value the filter value to activate (must be a registered filter)
     * @return this widget
     */
    public ChartWidget applyFilter(@Nullable String value) {
        if (value != null && !filters.containsKey(value)) {
            throw new IllegalArgumentException("unknown chart filter value: " + value);
        }
        this.activeFilter = value;
        return this;
    }

    /**
     * @param pollingInterval how often the client re-fetches the data (a reactive update)
     * @return this widget
     */
    public ChartWidget pollingInterval(Duration pollingInterval) {
        this.pollingInterval = Objects.requireNonNull(pollingInterval, "pollingInterval");
        return this;
    }

    /**
     * Sets the dashboard-grid sort key.
     *
     * @param sort the sort key
     * @return this widget
     */
    public ChartWidget sort(int sort) {
        this.sort = sort;
        return this;
    }

    /** @return the heading, if set */
    public Optional<String> heading() {
        return Optional.ofNullable(heading);
    }

    /** @return the description, if set */
    public Optional<String> description() {
        return Optional.ofNullable(description);
    }

    /** @return the max height in pixels, if set */
    public Optional<Integer> maxHeight() {
        return Optional.ofNullable(maxHeight);
    }

    /** @return the chart color, if set */
    public Optional<Color> color() {
        return Optional.ofNullable(color);
    }

    /** @return whether the chart card is collapsible */
    public boolean isCollapsible() {
        return collapsible;
    }

    /** @return the filter options (value to label), as an unmodifiable snapshot */
    public Map<String, String> filters() {
        return Collections.unmodifiableMap(filters);
    }

    /** @return the active filter value, if any */
    public Optional<String> activeFilter() {
        return Optional.ofNullable(activeFilter);
    }

    /** @return the polling interval, if set */
    public Optional<Duration> pollingInterval() {
        return Optional.ofNullable(pollingInterval);
    }

    @Override
    public int sort() {
        return sort;
    }

    /**
     * A stable checksum of the current {@link #data()}, used by the client to decide whether to
     * patch the chart in place (the Filament {@code dataChecksum} reactive-update trick): identical
     * data yields the same checksum, so an unchanged poll does not redraw.
     *
     * @return the data checksum
     */
    public String dataChecksum() {
        ChartData data = data();
        StringBuilder sb = new StringBuilder();
        sb.append(type().jsName()).append('|').append(data.labels());
        for (Dataset dataset : data.datasets()) {
            sb.append('|').append(dataset.label()).append('=').append(dataset.values());
        }
        return Integer.toHexString(sb.toString().hashCode());
    }
}
