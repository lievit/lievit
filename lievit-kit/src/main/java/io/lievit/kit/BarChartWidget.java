/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit;

/**
 * A {@link ChartWidget} fixed to the chart.js {@code BAR} type. A thin type-setter: the adopter
 * subclasses this and overrides only {@link #data()} (and optionally the presentation slots).
 */
public abstract class BarChartWidget extends ChartWidget {

    @Override
    public final ChartType type() {
        return ChartType.BAR;
    }
}
