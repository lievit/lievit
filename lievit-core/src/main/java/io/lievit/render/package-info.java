/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * The template-adapter SPI (ADR-0004): one engine-agnostic abstraction the wire runtime renders
 * through. The five engine implementations (JTE primary, Thymeleaf, Mustache, FreeMarker, raw) live
 * in their own modules; the core declares only the contract, keeping the codec and lifecycle free
 * of template-engine knowledge (ADR-0007).
 */
@NullMarked
package io.lievit.render;

import org.jspecify.annotations.NullMarked;
