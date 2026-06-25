/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.wire.synth.builtin;

import java.math.BigDecimal;

import org.jspecify.annotations.Nullable;

import dev.lievit.wire.WireError;
import dev.lievit.wire.WireException;
import dev.lievit.wire.synth.Dehydrated;
import dev.lievit.wire.synth.Synthesizer;
import dev.lievit.wire.synth.SynthesizerRegistry;

/**
 * Round-trips a {@code BigDecimal} as its canonical string (preserving scale, unlike a double), the
 * money-VO analogue (ADR-0020). The typed-update path lets a number-input string rehydrate to
 * {@code BigDecimal} exactly.
 */
public final class BigDecimalSynthesizer implements Synthesizer<BigDecimal> {

    @Override
    public String key() {
        return "bigdec";
    }

    @Override
    public boolean matches(Object value) {
        return value instanceof BigDecimal;
    }

    @Override
    public boolean matchesType(Class<?> type) {
        return type == BigDecimal.class;
    }

    @Override
    public Dehydrated dehydrate(BigDecimal value, SynthesizerRegistry registry) {
        return Dehydrated.of(value.toString(), key());
    }

    @Override
    public BigDecimal hydrate(
            @Nullable Object data, @Nullable String concreteType, SynthesizerRegistry registry) {
        if (data == null) {
            throw new WireException(
                    WireError.FORBIDDEN_DESERIALIZATION, "BigDecimal tuple missing data");
        }
        return new BigDecimal(data.toString());
    }

    @Override
    public BigDecimal hydrateFromType(
            Class<?> declaredType, @Nullable Object raw, SynthesizerRegistry registry) {
        if (raw == null) {
            throw new WireException(
                    WireError.FORBIDDEN_DESERIALIZATION, "null update for a BigDecimal field");
        }
        return new BigDecimal(raw.toString());
    }
}
