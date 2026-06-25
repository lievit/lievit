/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.wire.synth.builtin;

import java.lang.reflect.Constructor;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.RecordComponent;
import java.util.LinkedHashMap;
import java.util.Map;

import org.jspecify.annotations.Nullable;

import dev.lievit.wire.WireError;
import dev.lievit.wire.WireException;
import dev.lievit.wire.synth.Dehydrated;
import dev.lievit.wire.synth.Synthesizer;
import dev.lievit.wire.synth.SynthesizerRegistry;

/**
 * The reflective record / simple-POJO catch-all (the Livewire {@code StdClassSynth} analogue,
 * ADR-0020): dehydrates a {@code record} to a map of its components (recursing each, so a record
 * holding a {@code List<EnumX>} round-trips every level), and hydrates by invoking the canonical
 * constructor with the rebuilt component values. The concrete class named in the tuple is gated by
 * the {@link dev.lievit.wire.synth.ClassInstantiationGuard} before the constructor runs (ADR-0021),
 * so a denied class never reaches reflection. A user type that wants control or native-safety
 * implements {@link dev.lievit.wire.synth.Wireable} instead (preferred by the registry).
 *
 * <p>v0.1 supports {@code record} types (the common value-object shape). A non-record POJO that is
 * not {@code Wireable} is refused with {@code FORBIDDEN_DESERIALIZATION}: opaque mutable POJOs are
 * out of scope until a documented field-injection contract exists.
 */
public final class RecordSynthesizer implements Synthesizer<Object> {

    @Override
    public String key() {
        return "rec";
    }

    @Override
    public boolean matches(Object value) {
        return value.getClass().isRecord();
    }

    @Override
    public boolean matchesType(Class<?> type) {
        // The typed-update path does not build a whole record from a single raw scalar; a record is
        // updated via its dotted form-object path (ADR-0017) or replaced wholesale by an action.
        return false;
    }

    @Override
    public Dehydrated dehydrate(Object value, SynthesizerRegistry registry) {
        Class<?> type = value.getClass();
        Map<String, Object> data = new LinkedHashMap<>();
        for (RecordComponent rc : type.getRecordComponents()) {
            Object component = readComponent(rc, value);
            data.put(rc.getName(), registry.dehydrate(component));
        }
        return Dehydrated.of(data, key(), type.getName());
    }

    @Override
    public Object hydrate(
            @Nullable Object data, @Nullable String concreteType, SynthesizerRegistry registry) {
        if (concreteType == null) {
            throw new WireException(
                    WireError.FORBIDDEN_DESERIALIZATION, "record tuple missing concrete type");
        }
        Class<?> type = registry.resolveGuarded(concreteType);
        if (!type.isRecord()) {
            throw new WireException(
                    WireError.FORBIDDEN_DESERIALIZATION,
                    concreteType + " is not a record (non-record POJOs need Wireable)");
        }
        if (!(data instanceof Map<?, ?> raw)) {
            throw new WireException(
                    WireError.FORBIDDEN_DESERIALIZATION, "record tuple data is not a map");
        }
        RecordComponent[] components = type.getRecordComponents();
        Class<?>[] paramTypes = new Class<?>[components.length];
        Object[] args = new Object[components.length];
        for (int i = 0; i < components.length; i++) {
            RecordComponent rc = components[i];
            paramTypes[i] = rc.getType();
            args[i] = coerce(rc.getType(), registry.hydrate(raw.get(rc.getName())));
        }
        return construct(type, paramTypes, args);
    }

    private static Object readComponent(RecordComponent rc, Object value) {
        try {
            rc.getAccessor().setAccessible(true);
            return rc.getAccessor().invoke(value);
        } catch (IllegalAccessException | InvocationTargetException e) {
            throw new IllegalStateException("cannot read record component " + rc.getName(), e);
        }
    }

    private static Object construct(Class<?> type, Class<?>[] paramTypes, Object[] args) {
        try {
            Constructor<?> canonical = type.getDeclaredConstructor(paramTypes);
            canonical.setAccessible(true);
            return canonical.newInstance(args);
        } catch (NoSuchMethodException e) {
            throw new WireException(
                    WireError.FORBIDDEN_DESERIALIZATION,
                    "no canonical constructor on record " + type.getName());
        } catch (InstantiationException | IllegalAccessException e) {
            throw new IllegalStateException("cannot construct record " + type.getName(), e);
        } catch (InvocationTargetException e) {
            throw new WireException(
                    WireError.FORBIDDEN_DESERIALIZATION,
                    "record constructor threw on " + type.getName());
        }
    }

    /**
     * Narrows a hydrated value to a record component's declared type, applying the same JSON numeric
     * widening {@code WireField} does (a JSON number decodes to {@code Integer}/{@code Long}, the
     * component may be an {@code int}/{@code double}).
     */
    private static @Nullable Object coerce(Class<?> target, @Nullable Object value) {
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
