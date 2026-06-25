/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.spring.counter;

import dev.lievit.LievitComponent;
import dev.lievit.LievitLazy;
import dev.lievit.Wire;

/**
 * Exercises lazy loading end-to-end (issue #147, ADR-0036): a {@code @LievitLazy} component whose
 * first mount renders a placeholder + the load trigger instead of the heavy chart body; the follow-up
 * {@code $refresh} call renders the full body from the carried snapshot. The {@code points} field is
 * the mount state that must survive the load.
 */
@LievitComponent(template = "lazy-chart")
@LievitLazy(placeholder = "loading")
public class LazyChartComponent {

    @Wire int points = 1000;

    String loading() {
        return "<p class=\"chart-skeleton\">preparing chart…</p>";
    }
}
