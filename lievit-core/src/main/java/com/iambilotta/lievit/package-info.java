/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * The lievit public API: nine annotations (ADR-0002's seven-annotation cap superseded by ADR-0015
 * for {@code @LievitComputed} and by ADR-0012 / the URL-binding feature for {@code @LievitUrl}).
 *
 * <p>{@link com.iambilotta.lievit.EnableLievit}, {@link com.iambilotta.lievit.LievitComponent},
 * {@link com.iambilotta.lievit.Wire}, {@link com.iambilotta.lievit.LievitAction},
 * {@link com.iambilotta.lievit.LievitMount}, {@link com.iambilotta.lievit.LievitRender},
 * {@link com.iambilotta.lievit.LievitProperty},
 * {@link com.iambilotta.lievit.LievitComputed}. They map onto six user-facing concepts:
 * Component, Wire, Action, Mount, Render, Computed.
 *
 * <p>{@link com.iambilotta.lievit.LievitUrl} is field-level metadata that tunes how an existing
 * {@code @Wire} field crosses the wire (it reflects the field into the URL query string); it is
 * applied alongside {@code @Wire}, in the same family as {@code @LievitProperty}. {@code @LievitProperty}
 * also carries the {@code modelable} attribute (ADR-0016, nested-component two-way bind), which adds
 * no new annotation.
 */
@NullMarked
package com.iambilotta.lievit;

import org.jspecify.annotations.NullMarked;
