/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.component;

import java.lang.reflect.Field;

import org.jspecify.annotations.Nullable;

/**
 * One {@code @Wire}-bound field of a component, with the {@code @LievitProperty} flags that govern
 * how it crosses the wire and the optional {@code @LievitUrl} binding that reflects it into the URL
 * query string (ADR-0001, ADR-0002, ADR-0012).
 *
 * <p>{@code serialize} controls whether the field's value rides in the snapshot {@code wire} map;
 * {@code locked} controls whether an inbound client {@code _updates} entry may set it. A locked
 * field is server-authoritative: it is serialized for rendering but never accepts a client write
 * (the ADR-0001 amendment, Livewire {@code #[Locked]} parity). {@code url} is non-null only when the
 * field is annotated {@code @LievitUrl}: it carries the query-parameter key, the keep-empty flag,
 * and the history mode used to mount-from-query and to emit the {@code url} effect.
 *
 * <p>{@code modelable} marks the field as the child's two-way bind to a parent property (ADR-0016):
 * the parent seeds it as a prop and a child mutation is dispatched back up. A {@code modelable}
 * field is never {@code locked} (a server-owned field is not a two-way bind), enforced where the
 * metadata is reflected.
 *
 * @param name the field name as it appears in the snapshot {@code wire} map and in {@code _updates}
 * @param field the reflected {@link Field} (already {@code setAccessible(true)})
 * @param serialize whether the value is written into the snapshot payload
 * @param locked whether client updates to the field are rejected
 * @param modelable whether the field two-way-binds to a parent property when mounted as a child
 * @param url the resolved {@code @LievitUrl} binding, or {@code null} if the field is not URL-bound
 */
public record WireField(
        String name,
        Field field,
        boolean serialize,
        boolean locked,
        boolean modelable,
        @Nullable UrlBinding url) {

    /**
     * Convenience constructor for a plain field (no {@code modelable} two-way bind, no
     * {@code @LievitUrl} binding): keeps four-argument call sites and tests intact.
     *
     * @param name the field name
     * @param field the reflected field
     * @param serialize whether the value is serialized into the snapshot
     * @param locked whether client updates are rejected
     */
    public WireField(String name, Field field, boolean serialize, boolean locked) {
        this(name, field, serialize, locked, false, null);
    }

    /**
     * @return true if this field reflects into the URL query string ({@code @LievitUrl} present)
     */
    public boolean isUrlBound() {
        return url != null;
    }

    /**
     * Reads the current value off a component instance.
     *
     * @param instance the component instance
     * @return the field's current value (may be {@code null})
     */
    public Object read(Object instance) {
        try {
            return field.get(instance);
        } catch (IllegalAccessException e) {
            throw new IllegalStateException("cannot read @Wire field " + name, e);
        }
    }

    /**
     * Writes a value onto a component instance, coercing common JSON numeric widenings so a
     * round-tripped {@code int} field does not reject a {@code Long}/{@code Integer} mismatch.
     *
     * @param instance the component instance
     * @param value the value to set
     */
    public void write(Object instance, Object value) {
        try {
            field.set(instance, coerce(value));
        } catch (IllegalAccessException e) {
            throw new IllegalStateException("cannot write @Wire field " + name, e);
        }
    }

    private Object coerce(Object value) {
        Class<?> target = field.getType();
        if (value instanceof Number n) {
            if (target == int.class || target == Integer.class) {
                return n.intValue();
            }
            if (target == long.class || target == Long.class) {
                return n.longValue();
            }
            if (target == double.class || target == Double.class) {
                return n.doubleValue();
            }
            if (target == float.class || target == Float.class) {
                return n.floatValue();
            }
            if (target == short.class || target == Short.class) {
                return n.shortValue();
            }
            if (target == byte.class || target == Byte.class) {
                return n.byteValue();
            }
        }
        return value;
    }
}
