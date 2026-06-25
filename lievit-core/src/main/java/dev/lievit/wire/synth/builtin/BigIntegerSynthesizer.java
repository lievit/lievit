/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.wire.synth.builtin;

import java.math.BigInteger;

import org.jspecify.annotations.Nullable;

import dev.lievit.wire.WireError;
import dev.lievit.wire.WireException;
import dev.lievit.wire.synth.Dehydrated;
import dev.lievit.wire.synth.Synthesizer;
import dev.lievit.wire.synth.SynthesizerRegistry;

/** Round-trips a {@code BigInteger} as its decimal string (ADR-0020). */
public final class BigIntegerSynthesizer implements Synthesizer<BigInteger> {

    @Override
    public String key() {
        return "bigint";
    }

    @Override
    public boolean matches(Object value) {
        return value instanceof BigInteger;
    }

    @Override
    public boolean matchesType(Class<?> type) {
        return type == BigInteger.class;
    }

    @Override
    public Dehydrated dehydrate(BigInteger value, SynthesizerRegistry registry) {
        return Dehydrated.of(value.toString(), key());
    }

    @Override
    public BigInteger hydrate(
            @Nullable Object data, @Nullable String concreteType, SynthesizerRegistry registry) {
        if (data == null) {
            throw new WireException(
                    WireError.FORBIDDEN_DESERIALIZATION, "BigInteger tuple missing data");
        }
        return new BigInteger(data.toString());
    }

    @Override
    public BigInteger hydrateFromType(
            Class<?> declaredType, @Nullable Object raw, SynthesizerRegistry registry) {
        if (raw == null) {
            throw new WireException(
                    WireError.FORBIDDEN_DESERIALIZATION, "null update for a BigInteger field");
        }
        return new BigInteger(raw.toString());
    }
}
