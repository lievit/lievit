/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit.schema;

import java.time.LocalDateTime;
import java.util.Objects;

import org.jspecify.annotations.Nullable;

/**
 * A combined date-and-time picker (the filament-forms {@code DateTimePicker} carried over): binds a
 * {@link LocalDateTime} through the ISO datetime {@link StateCast}, with optional min/max bounds, a
 * minute step, a 24-hour flag, and a native-vs-custom rendering toggle. Use {@link TimePicker} for
 * time only or the spine's {@code Date} for date only.
 */
public final class DateTimePicker extends SchemaField<LocalDateTime, DateTimePicker> {

    private @Nullable LocalDateTime minDate;
    private @Nullable LocalDateTime maxDate;
    private @Nullable Integer step;
    private boolean seconds = true;
    private boolean twentyFourHour = true;
    private boolean nativePicker = true;

    private DateTimePicker(String name) {
        super(name);
        cast(StateCasts.dateTime());
    }

    /**
     * @param name the field name and state path
     * @return a new date-time picker
     */
    public static DateTimePicker make(String name) {
        return new DateTimePicker(name);
    }

    /**
     * Sets the earliest selectable instant.
     *
     * @param minDate the minimum
     * @return this field
     */
    public DateTimePicker minDate(LocalDateTime minDate) {
        this.minDate = Objects.requireNonNull(minDate, "minDate");
        return this;
    }

    /**
     * @return the minimum instant, or {@code null}
     */
    public @Nullable LocalDateTime minDate() {
        return minDate;
    }

    /**
     * Sets the latest selectable instant.
     *
     * @param maxDate the maximum
     * @return this field
     */
    public DateTimePicker maxDate(LocalDateTime maxDate) {
        this.maxDate = Objects.requireNonNull(maxDate, "maxDate");
        return this;
    }

    /**
     * @return the maximum instant, or {@code null}
     */
    public @Nullable LocalDateTime maxDate() {
        return maxDate;
    }

    /**
     * Sets the minute step granularity.
     *
     * @param minutes the step in minutes (at least 1)
     * @return this field
     */
    public DateTimePicker step(int minutes) {
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
    public DateTimePicker withoutSeconds() {
        this.seconds = false;
        return this;
    }

    /**
     * @return {@code true} if seconds are shown (default {@code true})
     */
    public boolean hasSeconds() {
        return seconds;
    }

    /**
     * Renders a 12-hour clock with an AM/PM marker (24-hour is the default).
     *
     * @return this field
     */
    public DateTimePicker twelveHour() {
        this.twentyFourHour = false;
        return this;
    }

    /**
     * @return {@code true} if a 24-hour clock is used (default {@code true})
     */
    public boolean isTwentyFourHour() {
        return twentyFourHour;
    }

    /**
     * Uses the custom (kit-rendered) picker rather than the browser-native control.
     *
     * @return this field
     */
    public DateTimePicker custom() {
        this.nativePicker = false;
        return this;
    }

    /**
     * @return {@code true} if the browser-native control is used (default {@code true})
     */
    public boolean isNative() {
        return nativePicker;
    }
}
