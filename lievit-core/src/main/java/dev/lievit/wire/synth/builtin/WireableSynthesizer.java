/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.wire.synth.builtin;

import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.lang.reflect.Modifier;

import org.jspecify.annotations.Nullable;

import dev.lievit.wire.WireError;
import dev.lievit.wire.WireException;
import dev.lievit.wire.synth.Dehydrated;
import dev.lievit.wire.synth.Synthesizer;
import dev.lievit.wire.synth.SynthesizerRegistry;
import dev.lievit.wire.synth.Wireable;

/**
 * Round-trips a user type that opts in by implementing {@link Wireable} (the Livewire
 * {@code Wireable} analogue, ADR-0020): {@link Wireable#toWire()} produces the data, a static
 * {@code fromWire(Object)} factory rebuilds the instance. Preferred over the reflective
 * {@link RecordSynthesizer}, and the GraalVM-native-safe escape hatch (no field-by-field
 * reflection). The {@code fromWire} class is gated by the {@link dev.lievit.wire.synth.ClassInstantiationGuard}
 * before it is invoked (ADR-0021).
 */
public final class WireableSynthesizer implements Synthesizer<Wireable> {

    @Override
    public String key() {
        return "wireable";
    }

    @Override
    public boolean matches(Object value) {
        return value instanceof Wireable;
    }

    @Override
    public boolean matchesType(Class<?> type) {
        return Wireable.class.isAssignableFrom(type);
    }

    @Override
    public Dehydrated dehydrate(Wireable value, SynthesizerRegistry registry) {
        // The data is recursively dehydrated so a Wireable holding typed values round-trips too.
        return Dehydrated.of(
                registry.dehydrate(value.toWire()), key(), value.getClass().getName());
    }

    @Override
    public Wireable hydrate(
            @Nullable Object data, @Nullable String concreteType, SynthesizerRegistry registry) {
        if (concreteType == null) {
            throw new WireException(
                    WireError.FORBIDDEN_DESERIALIZATION, "Wireable tuple missing concrete type");
        }
        Class<?> type = registry.resolveGuarded(concreteType);
        if (!Wireable.class.isAssignableFrom(type)) {
            throw new WireException(
                    WireError.FORBIDDEN_DESERIALIZATION, concreteType + " is not Wireable");
        }
        Object rehydratedData = registry.hydrate(data);
        return invokeFromWire(type, rehydratedData);
    }

    private static Wireable invokeFromWire(Class<?> type, @Nullable Object data) {
        Method factory;
        try {
            factory = type.getDeclaredMethod("fromWire", Object.class);
        } catch (NoSuchMethodException e) {
            throw new WireException(
                    WireError.FORBIDDEN_DESERIALIZATION,
                    type.getName() + " is Wireable but has no static fromWire(Object) factory");
        }
        if (!Modifier.isStatic(factory.getModifiers())) {
            throw new WireException(
                    WireError.FORBIDDEN_DESERIALIZATION,
                    type.getName() + ".fromWire must be static");
        }
        factory.setAccessible(true);
        try {
            return (Wireable) factory.invoke(null, data);
        } catch (IllegalAccessException e) {
            throw new IllegalStateException("cannot invoke fromWire on " + type.getName(), e);
        } catch (InvocationTargetException e) {
            Throwable cause = e.getCause();
            throw new WireException(
                    WireError.FORBIDDEN_DESERIALIZATION,
                    "fromWire threw on " + type.getName()
                            + (cause == null ? "" : ": " + cause.getClass().getSimpleName()));
        }
    }
}
