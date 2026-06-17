/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;

/**
 * How many grid columns a dashboard widget spans (the Filament {@code columnSpan}): a fixed count, a
 * {@code full}-width span, or a per-breakpoint map (for example {@code {default:1, md:2, xl:3}}).
 * The dashboard grid reads this to lay widgets out responsively.
 */
public final class ColumnSpan {

    /** The breakpoint key for the unprefixed (smallest) span. */
    public static final String DEFAULT_BREAKPOINT = "default";

    private final Map<String, Integer> byBreakpoint;
    private final boolean full;

    private ColumnSpan(Map<String, Integer> byBreakpoint, boolean full) {
        this.byBreakpoint = byBreakpoint;
        this.full = full;
    }

    /**
     * @param span a fixed column count at all breakpoints
     * @return the span
     */
    public static ColumnSpan of(int span) {
        if (span < 1) {
            throw new IllegalArgumentException("span must be >= 1, got: " + span);
        }
        Map<String, Integer> map = new LinkedHashMap<>();
        map.put(DEFAULT_BREAKPOINT, span);
        return new ColumnSpan(map, false);
    }

    /**
     * @return a full-width span (spans every grid column)
     */
    public static ColumnSpan full() {
        return new ColumnSpan(Map.of(), true);
    }

    /**
     * @param byBreakpoint a breakpoint-to-span map (for example {@code {"default":1,"md":2}})
     * @return the responsive span
     */
    public static ColumnSpan responsive(Map<String, Integer> byBreakpoint) {
        Objects.requireNonNull(byBreakpoint, "byBreakpoint");
        if (byBreakpoint.isEmpty()) {
            throw new IllegalArgumentException("a responsive span needs at least one breakpoint");
        }
        return new ColumnSpan(new LinkedHashMap<>(byBreakpoint), false);
    }

    /**
     * @return whether this is a full-width span
     */
    public boolean isFull() {
        return full;
    }

    /**
     * Resolves the span at a breakpoint, falling back to the default breakpoint.
     *
     * @param breakpoint the breakpoint key
     * @return the column count at that breakpoint (1 if a full span or nothing matches)
     */
    public int at(String breakpoint) {
        if (full) {
            return 1;
        }
        Integer exact = byBreakpoint.get(breakpoint);
        if (exact != null) {
            return exact;
        }
        return byBreakpoint.getOrDefault(DEFAULT_BREAKPOINT, 1);
    }

    /**
     * @return the breakpoint-to-span map (empty for a full span), as an unmodifiable snapshot
     */
    public Map<String, Integer> byBreakpoint() {
        return Collections.unmodifiableMap(byBreakpoint);
    }
}
