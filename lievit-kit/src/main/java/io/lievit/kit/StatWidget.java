/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit;

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
 * <p>Example:
 * <pre>
 *   StatWidget.create("Active listings", "142")
 *             .description("+12 this week")
 * </pre>
 */
public final class StatWidget implements Widget {

    private final String heading;
    private final Supplier<String> valueSupplier;
    private @Nullable String description;

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
}
