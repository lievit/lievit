/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * lievit-kit: the admin layer ("Filament for Spring") built on the lievit wire runtime.
 *
 * <p>An in-monorepo module (ADR-0008, amended 2026-06-17), it depends on the core SPI and on the
 * Spring Boot starter, never on a persistence engine. The architecture is the distilled lesson of
 * {@code docs/research/filament-internals.md}:
 *
 * <ul>
 *   <li>{@link com.iambilotta.lievit.kit.Resource} is the unit of work, one per domain entity,
 *       <em>instance-based</em> (a Spring bean, not a static configuration namespace) so it composes
 *       with dependency injection and stays unit-testable.
 *   <li>{@link com.iambilotta.lievit.kit.Form} and {@link com.iambilotta.lievit.kit.Table}
 *       share the common parent {@link com.iambilotta.lievit.kit.Schema} from v0.1, so the
 *       builders never need a later breaking unification (the Filament v3-&gt;v4 Schema lesson).
 *   <li>{@link com.iambilotta.lievit.kit.Page} (the annotation) makes a standalone page a
 *       first-class peer of {@code Resource}, not a second-class escape hatch.
 *   <li>{@link com.iambilotta.lievit.kit.RenderHook} are named injection points: adopters
 *       extend the layout there instead of forking published views.
 *   <li>{@link com.iambilotta.lievit.kit.RecordRepository} is a persistence-agnostic port: the
 *       adopter wires the data, the kit never hard-codes JdbcClient or JPA.
 *   <li>{@link com.iambilotta.lievit.kit.Plugin} is the third-party extension point, the
 *       same {@code getId / register / boot} shape Filament uses.
 * </ul>
 */
@NullMarked
package com.iambilotta.lievit.kit;

import org.jspecify.annotations.NullMarked;
