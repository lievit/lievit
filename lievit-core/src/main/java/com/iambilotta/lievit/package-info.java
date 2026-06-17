/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * The lievit public API: exactly seven annotations (ADR-0002).
 *
 * <p>{@link com.iambilotta.lievit.EnableLievit}, {@link com.iambilotta.lievit.LievitComponent},
 * {@link com.iambilotta.lievit.Wire}, {@link com.iambilotta.lievit.LievitAction},
 * {@link com.iambilotta.lievit.LievitMount}, {@link com.iambilotta.lievit.LievitRender},
 * {@link com.iambilotta.lievit.LievitProperty}. They map onto the five user-facing concepts:
 * Component, Wire, Action, Mount, Render.
 */
@NullMarked
package com.iambilotta.lievit;

import org.jspecify.annotations.NullMarked;
