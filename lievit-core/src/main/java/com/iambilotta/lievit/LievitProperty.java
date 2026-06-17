/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package com.iambilotta.lievit;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Optional extended metadata on a {@link Wire}-bound field.
 *
 * <p>Carries validation, transform, and serialize hints that do not belong on {@link Wire} itself
 * (ADR-0002). Absent, a {@code @Wire} field serializes with the default codec behavior. Reserved
 * surface in v0.1: the attributes are introduced as the validation / transform / serialize hooks
 * land, without adding an eighth annotation.
 *
 * <p>One of the seven public annotations (ADR-0002).
 */
@Documented
@Target(ElementType.FIELD)
@Retention(RetentionPolicy.RUNTIME)
public @interface LievitProperty {

    /**
     * Whether the field participates in wire serialization. Defaults to {@code true}; set to
     * {@code false} to keep a {@link Wire} field out of the snapshot payload (server-derived only).
     *
     * @return whether the field is serialized into the snapshot
     */
    boolean serialize() default true;

    /**
     * Whether the field is locked against client-supplied updates.
     *
     * <p>The snapshot signature only proves the snapshot was not altered <em>between</em> requests;
     * it does NOT stop the <em>first</em> POST from setting any {@link Wire} field to any value
     * (Livewire research, ADR-0001 amendment of 2026-06-17). A {@code locked} field is seeded
     * server-side (mount / action), serialized into the snapshot for rendering, but any inbound
     * {@code _updates} entry targeting it is rejected: the value the server set is authoritative.
     *
     * <p>Use it for ids, prices, role flags, and anything a malicious client must not be able to
     * change. This is the lievit equivalent of Livewire's {@code #[Locked]}, expressed here without
     * an eighth annotation (ADR-0002's seven-annotation cap).
     *
     * @return whether client updates to this field are rejected
     */
    boolean locked() default false;
}
