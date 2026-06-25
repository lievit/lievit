/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * The Spring Boot 4 starter: the single primary dependency (ADR-0008). It is the web layer and the
 * autoconfiguration that wires the codec, the component registry, the dispatcher, the JTE adapter,
 * the checksum-failure limiter, the wire service, and the {@code POST /lievit/{id}/call} endpoint.
 *
 * <p>The web concerns (controller, request binding, error mapping, CSRF) live here and only here;
 * the codec and the lifecycle stay pure Java in the core (ADR-0007).
 */
@NullMarked
package dev.lievit.spring;

import org.jspecify.annotations.NullMarked;
