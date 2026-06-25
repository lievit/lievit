/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit.schema;

import java.time.LocalTime;
import java.util.Objects;

import org.jspecify.annotations.Nullable;

/**
 * A time-of-day picker (the filament-forms {@code TimePicker} carried over): binds a
 * {@link LocalTime} through the ISO time {@link StateCast}, with optional min/max bounds and a
 * minute step. The date counterpart is {@link DateTimePicker}.
 */
public final class TimePicker extends SchemaField<LocalTime, TimePicker> {

    private @Nullable LocalTime minTime;
    private @Nullable LocalTime maxTime;
    private @Nullable Integer step;
    private boolean seconds = true;

    private TimePicker(String name) {
        super(name);
        cast(StateCasts.time());
    }

    /**
     * @param name the field name and state path
     * @return a new time picker
     */
    public static TimePicker make(String name) {
        return new TimePicker(name);
    }

    /**
     * Sets the earliest selectable time.
     *
     * @param minTime the minimum
     * @return this field
     */
    public TimePicker minTime(LocalTime minTime) {
        this.minTime = Objects.requireNonNull(minTime, "minTime");
        return this;
    }

    /**
     * @return the minimum time, or {@code null}
     */
    public @Nullable LocalTime minTime() {
        return minTime;
    }

    /**
     * Sets the latest selectable time.
     *
     * @param maxTime the maximum
     * @return this field
     */
    public TimePicker maxTime(LocalTime maxTime) {
        this.maxTime = Objects.requireNonNull(maxTime, "maxTime");
        return this;
    }

    /**
     * @return the maximum time, or {@code null}
     */
    public @Nullable LocalTime maxTime() {
        return maxTime;
    }

    /**
     * Sets the minute step granularity.
     *
     * @param minutes the step in minutes (at least 1)
     * @return this field
     */
    public TimePicker step(int minutes) {
        if (minutes < 1) {
            throw new IllegalArgumentException("step must be at least 1 minute");
        }
        this.step = minutes;
        return this;
    }

    /**
     * @return the minute step, or {@code null} for the default granularity
     */
    public @Nullable Integer step() {
        return step;
    }

    /**
     * Hides the seconds component.
     *
     * @return this field
     */
    public TimePicker withoutSeconds() {
        this.seconds = false;
        return this;
    }

    /**
     * @return {@code true} if seconds are shown (default {@code true})
     */
    public boolean hasSeconds() {
        return seconds;
    }
}
