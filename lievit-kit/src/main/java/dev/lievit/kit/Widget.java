/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit;

import java.util.Optional;

/**
 * A self-contained UI unit rendered on a {@link WidgetPage} dashboard.
 *
 * <p>v0.1 exposes the minimum surface shared by all concrete widgets: a heading, a primary value,
 * and an optional description. A concrete implementation ({@link StatWidget}) provides the only
 * type in this slice; additional widget shapes (chart, table excerpt, alert) are deferred.
 *
 * <p>Implementors must not rely on runtime reflection so that the compiled types can pass through
 * a GraalVM native-image build without AOT hints (ADR-0006).
 */
public interface Widget {

    /**
     * @return the widget's heading (title) text
     */
    String heading();

    /**
     * @return the widget's primary displayed value (the large number, status text, etc.)
     */
    String value();

    /**
     * @return an optional description shown below the primary value, for example a trend label
     */
    Optional<String> description();
}
