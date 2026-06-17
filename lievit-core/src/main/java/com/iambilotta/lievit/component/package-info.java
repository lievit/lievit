/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * The component model and the stateless lifecycle engine: reflect a {@code @LievitComponent} into
 * its {@code @Wire} fields and {@code @LievitAction} / {@code @LievitMount} / {@code @LievitRender}
 * hooks, then drive mount / rehydrate / apply-updates / invoke-actions / read-back (ADR-0001,
 * ADR-0002).
 *
 * <p>Pure Java reflection, zero Spring (ADR-0007). The starter supplies the component instances
 * (Spring beans) and the HTTP edge; this package owns the protocol mechanics, including the
 * client-update locking rule (the ADR-0001 amendment, Livewire {@code #[Locked]} parity).
 */
@NullMarked
package com.iambilotta.lievit.component;

import org.jspecify.annotations.NullMarked;
