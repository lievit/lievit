/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit.schema;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * A responsive {@code n}-column grid container (the filament-schemas {@code Grid} carried over).
 * Beyond the single {@link #columns(int) columns} count, a grid can declare per-breakpoint column
 * counts ({@code sm}/{@code md}/{@code lg}/{@code xl}) so the layout adapts to viewport width.
 */
public final class Grid extends Layout<Grid> {

    private final Map<String, Integer> breakpointColumns = new LinkedHashMap<>();

    private Grid() {}

    /**
     * @return a new grid defaulting to one column
     */
    public static Grid make() {
        return new Grid();
    }

    /**
     * @param columns the default column count
     * @return a new grid with the given default column count
     */
    public static Grid make(int columns) {
        return new Grid().columns(columns);
    }

    /**
     * Sets the column count at a named breakpoint.
     *
     * @param breakpoint one of {@code sm}/{@code md}/{@code lg}/{@code xl}
     * @param columns the column count at that breakpoint
     * @return this grid
     */
    public Grid columns(String breakpoint, int columns) {
        if (columns < 1) {
            throw new IllegalArgumentException("columns must be at least 1");
        }
        breakpointColumns.put(breakpoint, columns);
        return this;
    }

    /**
     * @return the per-breakpoint column counts (unmodifiable, iteration order = declaration order)
     */
    public Map<String, Integer> breakpointColumns() {
        return Map.copyOf(breakpointColumns);
    }
}
