/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.wire.synth.builtin;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.jspecify.annotations.Nullable;

import dev.lievit.wire.WireError;
import dev.lievit.wire.WireException;
import dev.lievit.wire.synth.Dehydrated;
import dev.lievit.wire.synth.Synthesizer;
import dev.lievit.wire.synth.SynthesizerRegistry;

/**
 * Round-trips a {@code Map} whose keys are not all Strings (a {@code Map<Integer, X>}, a
 * {@code Map<EnumX, Y>}), which a plain JSON object cannot represent: the registry passes a
 * String-keyed map through as a JSON object, and this synth owns the rest (ADR-0020). The tuple
 * carries a list of {@code [dehydratedKey, dehydratedValue]} pairs, recursing both, so the key and
 * value types reconstruct.
 */
public final class MapSynthesizer implements Synthesizer<Map<?, ?>> {

    @Override
    public String key() {
        return "map";
    }

    @Override
    public boolean matches(Object value) {
        // Only a non-String-keyed map: a String-keyed map is handled by the registry as plain JSON.
        if (!(value instanceof Map<?, ?> map)) {
            return false;
        }
        for (Object k : map.keySet()) {
            if (!(k instanceof String)) {
                return true;
            }
        }
        return false;
    }

    @Override
    public boolean matchesType(Class<?> type) {
        return false;
    }

    @Override
    public Dehydrated dehydrate(Map<?, ?> value, SynthesizerRegistry registry) {
        List<@Nullable Object> pairs = new ArrayList<>(value.size());
        for (Map.Entry<?, ?> e : value.entrySet()) {
            List<@Nullable Object> pair = new ArrayList<>(2);
            pair.add(registry.dehydrate(e.getKey()));
            pair.add(registry.dehydrate(e.getValue()));
            pairs.add(pair);
        }
        return Dehydrated.of(pairs, key());
    }

    @Override
    public Map<?, ?> hydrate(
            @Nullable Object data, @Nullable String concreteType, SynthesizerRegistry registry) {
        if (!(data instanceof List<?> pairs)) {
            throw new WireException(
                    WireError.FORBIDDEN_DESERIALIZATION, "map tuple data is not a list of pairs");
        }
        Map<@Nullable Object, @Nullable Object> out = new LinkedHashMap<>();
        for (Object element : pairs) {
            if (!(element instanceof List<?> pair) || pair.size() != 2) {
                throw new WireException(
                        WireError.FORBIDDEN_DESERIALIZATION, "map tuple entry is not a 2-element pair");
            }
            out.put(registry.hydrate(pair.get(0)), registry.hydrate(pair.get(1)));
        }
        return out;
    }
}
