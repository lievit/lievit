/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.wire.synth.builtin;

import org.jspecify.annotations.Nullable;

import dev.lievit.wire.WireError;
import dev.lievit.wire.WireException;
import dev.lievit.wire.synth.Dehydrated;
import dev.lievit.wire.synth.Synthesizer;
import dev.lievit.wire.synth.SynthesizerRegistry;

/**
 * Round-trips an {@code enum} as its {@code name()} (the Livewire {@code EnumSynth} analogue,
 * ADR-0020). The tuple carries the concrete enum type so hydrate calls {@code Enum.valueOf}; the
 * typed-update path is the canonical example: a {@code <select>} posting the enum's {@code name()}
 * string rehydrates straight to the enum constant, not a {@code String}.
 */
public final class EnumSynthesizer implements Synthesizer<Object> {

    @Override
    public String key() {
        return "enum";
    }

    @Override
    public boolean matches(Object value) {
        return value instanceof Enum<?>;
    }

    @Override
    public boolean matchesType(Class<?> type) {
        return type.isEnum();
    }

    @Override
    public Dehydrated dehydrate(Object value, SynthesizerRegistry registry) {
        Enum<?> e = (Enum<?>) value;
        // The declaring class is the enum type even for a constant with a class body.
        return Dehydrated.of(e.name(), key(), e.getDeclaringClass().getName());
    }

    @Override
    @SuppressWarnings({"unchecked", "rawtypes"})
    public Object hydrate(
            @Nullable Object data, @Nullable String concreteType, SynthesizerRegistry registry) {
        if (data == null || concreteType == null) {
            throw new WireException(
                    WireError.FORBIDDEN_DESERIALIZATION, "enum tuple missing data or type");
        }
        Class<?> type = registry.resolveGuarded(concreteType);
        if (!type.isEnum()) {
            throw new WireException(
                    WireError.FORBIDDEN_DESERIALIZATION, concreteType + " is not an enum");
        }
        return Enum.valueOf((Class<? extends Enum>) type, data.toString());
    }

    @Override
    @SuppressWarnings({"unchecked", "rawtypes"})
    public Object hydrateFromType(
            Class<?> declaredType, @Nullable Object raw, SynthesizerRegistry registry) {
        if (raw == null) {
            throw new WireException(
                    WireError.FORBIDDEN_DESERIALIZATION, "null update for an enum field");
        }
        registry.guard().check(declaredType);
        return Enum.valueOf((Class<? extends Enum>) declaredType, raw.toString());
    }
}
