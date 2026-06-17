/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package com.iambilotta.lievit.component;

import java.lang.reflect.Field;

/**
 * One field of a {@link com.iambilotta.lievit.LievitFormObject}, reflected and made accessible for
 * hydration and dehydration (ADR-0015).
 *
 * <p>All public, non-static, non-transient fields of the form object's class are reflected as
 * {@code FormField}s. The binding is additive over {@link WireField}: a {@link WireField} whose
 * type is a {@link com.iambilotta.lievit.LievitFormObject} carries the form object's value in
 * the snapshot as a nested {@link java.util.Map}, and the individual fields of the form object are
 * reached via dotted paths in {@code _updates} (e.g., {@code "form.email"}).
 *
 * @param name  the field name, as it appears in dotted paths and in the nested snapshot map
 * @param field the reflected {@link Field} (already {@code setAccessible(true)})
 */
public record FormField(String name, Field field) {

    /**
     * Reads the current value off a form object instance.
     *
     * @param formInstance the form object instance
     * @return the field's current value (may be {@code null})
     */
    public Object read(Object formInstance) {
        try {
            return field.get(formInstance);
        } catch (IllegalAccessException e) {
            throw new IllegalStateException("cannot read form field " + name, e);
        }
    }

    /**
     * Writes a value onto a form object instance, coercing common JSON numeric widenings (the same
     * coercion {@link WireField} applies for top-level fields).
     *
     * @param formInstance the form object instance
     * @param value        the value to set
     */
    public void write(Object formInstance, Object value) {
        try {
            field.set(formInstance, coerce(value));
        } catch (IllegalAccessException e) {
            throw new IllegalStateException("cannot write form field " + name, e);
        }
    }

    private Object coerce(Object value) {
        Class<?> target = field.getType();
        if (value instanceof Number n) {
            if (target == int.class || target == Integer.class) return n.intValue();
            if (target == long.class || target == Long.class) return n.longValue();
            if (target == double.class || target == Double.class) return n.doubleValue();
            if (target == float.class || target == Float.class) return n.floatValue();
            if (target == short.class || target == Short.class) return n.shortValue();
            if (target == byte.class || target == Byte.class) return n.byteValue();
        }
        return value;
    }
}
