/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * The lievit public API: the seven core annotations (ADR-0002).
 *
 * <p>{@link com.iambilotta.lievit.EnableLievit}, {@link com.iambilotta.lievit.LievitComponent},
 * {@link com.iambilotta.lievit.Wire}, {@link com.iambilotta.lievit.LievitAction},
 * {@link com.iambilotta.lievit.LievitMount}, {@link com.iambilotta.lievit.LievitRender},
 * {@link com.iambilotta.lievit.LievitProperty}. They map onto the five user-facing concepts:
 * Component, Wire, Action, Mount, Render.
 *
 * <p>{@link com.iambilotta.lievit.LievitUrl} is field-level metadata that tunes how an existing
 * {@code @Wire} field crosses the wire (it reflects the field into the URL query string); it is
 * applied alongside {@code @Wire}, in the same family as {@code @LievitProperty}. Whether it counts
 * against the seven-annotation cap of ADR-0002 is a deliberate decision recorded with the feature.
 */
@NullMarked
package com.iambilotta.lievit;

import org.jspecify.annotations.NullMarked;
