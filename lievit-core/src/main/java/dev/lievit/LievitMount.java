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
 * Lifecycle hook that runs once, after construction and before the first render.
 *
 * <p>Mount seeds {@link Wire}-bound fields with their initial state on the first page load. It does
 * NOT run on subsequent wire calls: those rehydrate state from the snapshot instead of mounting
 * fresh (ADR-0001, wire-protocol.md, phase 1).
 *
 * <p>A lifecycle annotation of the lievit public API (see the package taxonomy; ADR-0002).
 */
@Documented
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface LievitMount {
}
