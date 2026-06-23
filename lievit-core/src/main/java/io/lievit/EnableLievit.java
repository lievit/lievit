/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Turns on the lievit starter autoconfiguration.
 *
 * <p>Place on a {@code @Configuration} class (typically the {@code @SpringBootApplication}). The
 * bootstrap annotation of the lievit public API (see the package taxonomy; ADR-0002).
 */
@Documented
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
public @interface EnableLievit {
}
