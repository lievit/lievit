/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * The JTE template adapter, lievit's canonical primary engine (ADR-0004).
 *
 * <p>{@link io.lievit.jte.JteTemplateAdapter} wraps {@link gg.jte.TemplateEngine} and
 * implements the core {@code TemplateAdapter} SPI. It depends on the core and on JTE, on no other
 * adapter and not on Spring (ArchUnit-enforced).
 */
@NullMarked
package io.lievit.jte;

import org.jspecify.annotations.NullMarked;
