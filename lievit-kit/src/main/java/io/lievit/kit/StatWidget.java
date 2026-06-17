/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit;

import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.function.Supplier;

import org.jspecify.annotations.Nullable;

/**
 * A stat (key-metric) widget: displays a heading, a primary numeric or text value, and an
 * optional description line (for example a trend or comparison label).
 *
 * <p>The primary value is held as a {@link Supplier} so it can be evaluated lazily at render time
 * — useful when the value is computed from a live query rather than a constant. The eager
 * factory {@link #create(String, String)} wraps a constant string in a trivial supplier.
 *
 * <p>Beyond the base heading/value/description, a stat carries the presentation slots a real KPI
 * card needs (issue #309): a leading {@link Icon}, a {@link Color} (which also drives the sparkline
 * tint), a description icon with a {@link IconPosition position} (the trend arrow), an inline chart
 * sparkline ({@code chart(values)}), and a {@code url} that turns the whole card into a link. It
 * also participates in the dashboard grid via {@link DashboardWidget}.
 *
 * <p>Example:
 * <pre>
 *   StatWidget.create("Active listings", "142")
 *             .description("+12 this week")
 *             .descriptionIcon(Icon.of("trend.up"), IconPosition.BEFORE)
 *             .color(Color.SUCCESS)
 *             .chart(List.of(3, 5, 4, 7, 9))
 *             .url("/admin/listings")
 * </pre>
 */
public final class StatWidget implements Widget, DashboardWidget {

    private final String heading;
    private final Supplier<String> valueSupplier;
    private @Nullable String description;
    private @Nullable Icon icon;
    private @Nullable Color color;
    private @Nullable Icon descriptionIcon;
    private IconPosition descriptionIconPosition = IconPosition.BEFORE;
    private @Nullable List<Number> chart;
    private @Nullable String url;
    private boolean opensInNewTab;
    private int sort = Integer.MAX_VALUE;

    /**
     * Creates a stat widget with a constant (eager) primary value.
     *
     * @param heading the widget heading
     * @param value   the primary displayed value
     * @return a new stat widget
     */
    public static StatWidget create(String heading, String value) {
        Objects.requireNonNull(value, "value");
        return new StatWidget(heading, () -> value);
    }

    /**
     * Creates a stat widget with a lazily-evaluated primary value.
     *
     * <p>The supplier is called each time {@link #value()} is invoked (i.e., once per render).
     * Use this overload when the metric is computed from a live data source.
     *
     * @param heading       the widget heading
     * @param valueSupplier supplies the primary displayed value at render time
     * @return a new stat widget
     */
    public static StatWidget create(String heading, Supplier<String> valueSupplier) {
        return new StatWidget(heading, valueSupplier);
    }

    private StatWidget(String heading, Supplier<String> valueSupplier) {
        this.heading = Objects.requireNonNull(heading, "heading");
        this.valueSupplier = Objects.requireNonNull(valueSupplier, "valueSupplier");
    }

    /**
     * Sets the optional description shown below the primary value.
     *
     * @param description a non-null description string
     * @return this widget
     */
    public StatWidget description(String description) {
        this.description = Objects.requireNonNull(description, "description");
        return this;
    }

    /**
     * @param icon the leading icon shown in the card
     * @return this widget
     */
    public StatWidget icon(Icon icon) {
        this.icon = Objects.requireNonNull(icon, "icon");
        return this;
    }

    /**
     * Sets the card's color, which also tints the sparkline.
     *
     * @param color the semantic color
     * @return this widget
     */
    public StatWidget color(Color color) {
        this.color = Objects.requireNonNull(color, "color");
        return this;
    }

    /**
     * Sets the description icon (the trend arrow beside the description) at the default
     * {@link IconPosition#BEFORE} position.
     *
     * @param descriptionIcon the icon
     * @return this widget
     */
    public StatWidget descriptionIcon(Icon descriptionIcon) {
        return descriptionIcon(descriptionIcon, IconPosition.BEFORE);
    }

    /**
     * Sets the description icon and its position relative to the description text.
     *
     * @param descriptionIcon the icon
     * @param position where the icon sits relative to the description
     * @return this widget
     */
    public StatWidget descriptionIcon(Icon descriptionIcon, IconPosition position) {
        this.descriptionIcon = Objects.requireNonNull(descriptionIcon, "descriptionIcon");
        this.descriptionIconPosition = Objects.requireNonNull(position, "position");
        return this;
    }

    /**
     * Sets the inline sparkline values (a small line chart drawn behind the value).
     *
     * @param chart the chart values, in order
     * @return this widget
     */
    public StatWidget chart(List<Number> chart) {
        this.chart = List.copyOf(Objects.requireNonNull(chart, "chart"));
        return this;
    }

    /**
     * Turns the whole card into a link to a url (same tab).
     *
     * @param url the link target
     * @return this widget
     */
    public StatWidget url(String url) {
        return url(url, false);
    }

    /**
     * Turns the whole card into a link to a url.
     *
     * @param url the link target
     * @param newTab whether the link opens in a new tab
     * @return this widget
     */
    public StatWidget url(String url, boolean newTab) {
        this.url = Objects.requireNonNull(url, "url");
        this.opensInNewTab = newTab;
        return this;
    }

    /**
     * Sets the dashboard-grid sort key.
     *
     * @param sort the sort key (ascending)
     * @return this widget
     */
    public StatWidget sort(int sort) {
        this.sort = sort;
        return this;
    }

    @Override
    public String heading() {
        return heading;
    }

    @Override
    public String value() {
        return valueSupplier.get();
    }

    @Override
    public Optional<String> description() {
        return Optional.ofNullable(description);
    }

    /** @return the leading icon, if set */
    public Optional<Icon> icon() {
        return Optional.ofNullable(icon);
    }

    /** @return the card color, if set */
    public Optional<Color> color() {
        return Optional.ofNullable(color);
    }

    /** @return the description icon, if set */
    public Optional<Icon> descriptionIcon() {
        return Optional.ofNullable(descriptionIcon);
    }

    /** @return the description icon's position relative to the description text */
    public IconPosition descriptionIconPosition() {
        return descriptionIconPosition;
    }

    /** @return the sparkline values, if set */
    public Optional<List<Number>> chart() {
        return Optional.ofNullable(chart);
    }

    /** @return the link target, if this stat is a link */
    public Optional<String> url() {
        return Optional.ofNullable(url);
    }

    /** @return whether the link opens in a new tab */
    public boolean opensInNewTab() {
        return opensInNewTab;
    }

    @Override
    public int sort() {
        return sort;
    }
}
