/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * GraalVM native-image reachability metadata for lievit (ADR-0006: native day one, zero runtime
 * reflection only if the hints are supplied).
 *
 * <p>Two halves: {@link com.iambilotta.lievit.spring.native_.LievitRuntimeHints} contributes the
 * static, component-independent hints (the wire DTOs that cross Jackson), activated by
 * {@code @ImportRuntimeHints} on the autoconfiguration; {@link
 * com.iambilotta.lievit.spring.native_.LievitComponentsAotProcessor} contributes one reflection
 * hint per {@code @LievitComponent} discovered in the adopter's bean factory at build time,
 * registered in {@code META-INF/spring/aot.factories}.
 */
@org.jspecify.annotations.NullMarked
package com.iambilotta.lievit.spring.native_;
