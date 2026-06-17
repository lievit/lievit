/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.wire.synth.builtin;

import java.util.UUID;

import org.jspecify.annotations.Nullable;

import io.lievit.wire.WireError;
import io.lievit.wire.WireException;
import io.lievit.wire.synth.Dehydrated;
import io.lievit.wire.synth.Synthesizer;
import io.lievit.wire.synth.SynthesizerRegistry;

/** Round-trips a {@code UUID} as its canonical string (ADR-0020). */
public final class UuidSynthesizer implements Synthesizer<UUID> {

    @Override
    public String key() {
        return "uuid";
    }

    @Override
    public boolean matches(Object value) {
        return value instanceof UUID;
    }

    @Override
    public boolean matchesType(Class<?> type) {
        return type == UUID.class;
    }

    @Override
    public Dehydrated dehydrate(UUID value, SynthesizerRegistry registry) {
        return Dehydrated.of(value.toString(), key());
    }

    @Override
    public UUID hydrate(
            @Nullable Object data, @Nullable String concreteType, SynthesizerRegistry registry) {
        if (data == null) {
            throw new WireException(WireError.FORBIDDEN_DESERIALIZATION, "UUID tuple missing data");
        }
        return UUID.fromString(data.toString());
    }

    @Override
    public UUID hydrateFromType(
            Class<?> declaredType, @Nullable Object raw, SynthesizerRegistry registry) {
        if (raw == null) {
            throw new WireException(
                    WireError.FORBIDDEN_DESERIALIZATION, "null update for a UUID field");
        }
        return UUID.fromString(raw.toString());
    }
}
