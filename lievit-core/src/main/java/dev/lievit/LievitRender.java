/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Custom pre-render hook.
 *
 * <p>Runs before each render, on the first page load and on every re-render after a wire call. In
 * single-file mode a {@code @LievitRender} method that returns markup IS the render; in multi-file
 * mode it is an optional hook to prepare derived state before the template runs (ADR-0001,
 * wire-protocol.md, phase 2 and 4).
 *
 * <p>A lifecycle annotation of the lievit public API (see the package taxonomy; ADR-0002).
 */
@Documented
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface LievitRender {
}
