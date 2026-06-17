/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * The lievit public API: nine annotations (ADR-0002's seven-annotation cap superseded by ADR-0015
 * for {@code @LievitComputed} and by ADR-0012 / the URL-binding feature for {@code @LievitUrl}).
 *
 * <p>{@link io.lievit.EnableLievit}, {@link io.lievit.LievitComponent},
 * {@link io.lievit.Wire}, {@link io.lievit.LievitAction},
 * {@link io.lievit.LievitMount}, {@link io.lievit.LievitRender},
 * {@link io.lievit.LievitProperty},
 * {@link io.lievit.LievitComputed}. They map onto six user-facing concepts:
 * Component, Wire, Action, Mount, Render, Computed.
 *
 * <p>{@link io.lievit.LievitUrl} is field-level metadata that tunes how an existing
 * {@code @Wire} field crosses the wire (it reflects the field into the URL query string); it is
 * applied alongside {@code @Wire}, in the same family as {@code @LievitProperty}. {@code @LievitProperty}
 * also carries the {@code modelable} attribute (ADR-0016, nested-component two-way bind), which adds
 * no new annotation.
 */
@NullMarked
package io.lievit;

import org.jspecify.annotations.NullMarked;
