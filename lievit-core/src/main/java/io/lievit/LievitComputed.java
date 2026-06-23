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
 * Marks a no-arg method as a computed property: a value derived from {@link Wire}-bound state
 * that is memoized for the duration of one wire call and recomputed on the next (ADR-0015).
 *
 * <p>A {@code @LievitComputed} method is called at most once per wire request. Its return value
 * is cached in a per-call {@link io.lievit.component.ComputedCache} and reused for
 * any subsequent access in the same call (template render, action logic). The cache is cleared
 * between wire calls so a state change on the next request triggers a fresh computation.
 *
 * <p>The computed value is exposed to the template by the method's name (without the {@code ()}),
 * alongside the {@code @Wire} fields. It is <em>not</em> serialized into the snapshot: the
 * snapshot carries only {@code @Wire} state; the computed value is rederived on each render.
 * A client cannot tamper with a computed value because no snapshot entry exists to tamper.
 *
 * <p>The method must be no-arg; its return type must be non-void. Side effects inside a computed
 * method are a programming error (the method may be called zero or one time per request, in no
 * guaranteed order relative to actions; relying on a side effect is therefore fragile).
 *
 * <p>A state annotation of the lievit public API (see the package taxonomy; ADR-0015).
 */
@Documented
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface LievitComputed {
}
