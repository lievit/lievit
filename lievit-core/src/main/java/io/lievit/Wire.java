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
 * Binds a component field bidirectionally between the Java class and the template.
 *
 * <p>A {@code @Wire} field is the only mutable state that travels on the wire: its value is
 * serialized into the snapshot's {@code wire} payload on render, and rehydrated onto a fresh
 * instance on the next wire call (ADR-0001, wire-protocol.md). The binding is compile-time
 * type-checked.
 *
 * <p>A state annotation of the lievit public API (see the package taxonomy; ADR-0002).
 */
@Documented
@Target(ElementType.FIELD)
@Retention(RetentionPolicy.RUNTIME)
public @interface Wire {
}
