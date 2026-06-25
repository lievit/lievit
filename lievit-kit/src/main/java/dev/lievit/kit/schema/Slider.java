/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit.schema;

/**
 * A numeric range slider (the filament-forms {@code Slider} carried over): binds a {@link Long}
 * through the number {@link StateCast}, constrained to a {@code [min, max]} range with a {@code step}.
 * The range bounds also add {@code min}/{@code max} validation rules so a tampered wire value is
 * rejected server-side, not only clamped client-side.
 */
public final class Slider extends SchemaField<Long, Slider> {

    private long min = 0;
    private long max = 100;
    private long step = 1;

    private Slider(String name) {
        super(name);
        cast(StateCasts.number());
        // Closures read the live bounds, so range() takes effect without leaving stale rules behind
        // (the RuleSet is append-only by design).
        rule(
                (value, ctx) -> {
                    if (value == null || String.valueOf(value).isBlank()) {
                        return null;
                    }
                    long v = Long.parseLong(String.valueOf(value).trim());
                    return v < min ? "Must be at least " + min + "." : null;
                });
        rule(
                (value, ctx) -> {
                    if (value == null || String.valueOf(value).isBlank()) {
                        return null;
                    }
                    long v = Long.parseLong(String.valueOf(value).trim());
                    return v > max ? "Must be at most " + max + "." : null;
                });
    }

    /**
     * @param name the field name and state path
     * @return a new slider over {@code [0, 100]} step 1
     */
    public static Slider make(String name) {
        return new Slider(name);
    }

    /**
     * Sets the inclusive range. The bounds drive both the control and the server-side validation
     * (the constructor's default {@code [0,100]} rules read these fields at validation time).
     *
     * @param min the inclusive minimum
     * @param max the inclusive maximum (must be greater than {@code min})
     * @return this field
     */
    public Slider range(long min, long max) {
        if (max <= min) {
            throw new IllegalArgumentException("max must be greater than min");
        }
        this.min = min;
        this.max = max;
        return this;
    }

    /**
     * Sets the step granularity.
     *
     * @param step the step (at least 1)
     * @return this field
     */
    public Slider step(long step) {
        if (step < 1) {
            throw new IllegalArgumentException("step must be at least 1");
        }
        this.step = step;
        return this;
    }

    /**
     * @return the inclusive minimum (default 0)
     */
    public long min() {
        return min;
    }

    /**
     * @return the inclusive maximum (default 100)
     */
    public long max() {
        return max;
    }

    /**
     * @return the step (default 1)
     */
    public long step() {
        return step;
    }
}
