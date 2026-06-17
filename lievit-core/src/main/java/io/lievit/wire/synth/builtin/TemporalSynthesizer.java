/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.wire.synth.builtin;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

import org.jspecify.annotations.Nullable;

import io.lievit.wire.WireError;
import io.lievit.wire.WireException;
import io.lievit.wire.synth.Dehydrated;
import io.lievit.wire.synth.Synthesizer;
import io.lievit.wire.synth.SynthesizerRegistry;

/**
 * Round-trips the JVM date / time types ({@code LocalDate}, {@code LocalDateTime}, {@code LocalTime},
 * {@code Instant}) as their ISO-8601 string (the Livewire {@code CarbonSynth} analogue, ADR-0020).
 * The tuple carries the concrete type so hydrate parses with the right type's {@code parse}; the
 * typed-update path lets an {@code <input type=date>} string rehydrate straight to {@code LocalDate}.
 */
public final class TemporalSynthesizer implements Synthesizer<Object> {

    @Override
    public String key() {
        return "tmp";
    }

    @Override
    public boolean matches(Object value) {
        return value instanceof LocalDate
                || value instanceof LocalDateTime
                || value instanceof LocalTime
                || value instanceof Instant;
    }

    @Override
    public boolean matchesType(Class<?> type) {
        return type == LocalDate.class
                || type == LocalDateTime.class
                || type == LocalTime.class
                || type == Instant.class;
    }

    @Override
    public Dehydrated dehydrate(Object value, SynthesizerRegistry registry) {
        return Dehydrated.of(value.toString(), key(), value.getClass().getName());
    }

    @Override
    public Object hydrate(
            @Nullable Object data, @Nullable String concreteType, SynthesizerRegistry registry) {
        String iso = data == null ? null : data.toString();
        if (iso == null || concreteType == null) {
            throw new WireException(
                    WireError.FORBIDDEN_DESERIALIZATION, "temporal tuple missing data or type");
        }
        return parse(concreteType, iso);
    }

    @Override
    public Object hydrateFromType(
            Class<?> declaredType, @Nullable Object raw, SynthesizerRegistry registry) {
        if (raw == null) {
            throw new WireException(
                    WireError.FORBIDDEN_DESERIALIZATION, "null update for a temporal field");
        }
        return parse(declaredType.getName(), raw.toString());
    }

    private static Object parse(String type, String iso) {
        return switch (type) {
            case "java.time.LocalDate" -> LocalDate.parse(iso);
            case "java.time.LocalDateTime" -> LocalDateTime.parse(iso);
            case "java.time.LocalTime" -> LocalTime.parse(iso);
            case "java.time.Instant" -> Instant.parse(iso);
            default -> throw new WireException(
                    WireError.FORBIDDEN_DESERIALIZATION, "unsupported temporal type " + type);
        };
    }
}
