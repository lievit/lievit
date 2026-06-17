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

    /**
     * Whether this {@link Wire} field two-way-binds to a property on the <em>parent</em> component
     * when this component is mounted as a child (ADR-0016, nested components; Livewire {@code
     * #[Modelable]} parity).
     *
     * <p>A modelable child field is the receiving end of a parent's two-way bind: the parent passes
     * its value down as a prop (so the child renders it), and when the child mutates the field the
     * change is dispatched back up so the parent's bound property updates. It is the lievit
     * equivalent of Livewire's {@code wire:model} on a child plus {@code #[Modelable]}, expressed
     * here without an eighth annotation (ADR-0002's seven-annotation cap).
     *
     * <p>At most one {@code modelable} field per component is meaningful (the single bound value, as
     * with {@code wire:model} on a custom input); declaring more than one is a configuration error
     * the metadata surfaces. A field cannot be both {@code modelable} and {@code locked}: a
     * server-owned field is not a two-way bind.
     *
     * @return whether this field is the child's modelable (parent-bound) value
     */
    boolean modelable() default false;
}
