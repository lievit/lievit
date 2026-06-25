/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit;

/**
 * A {@link ChartWidget} fixed to the chart.js {@code BUBBLE} type. A thin type-setter: the adopter
 * subclasses this and overrides only {@link #data()} (and optionally the presentation slots).
 */
public abstract class BubbleChartWidget extends ChartWidget {

    @Override
    public final ChartType type() {
        return ChartType.BUBBLE;
    }
}
