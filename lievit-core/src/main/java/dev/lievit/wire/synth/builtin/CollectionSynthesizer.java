/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.wire.synth.builtin;

import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

import org.jspecify.annotations.Nullable;

import dev.lievit.wire.WireError;
import dev.lievit.wire.WireException;
import dev.lievit.wire.synth.Dehydrated;
import dev.lievit.wire.synth.Synthesizer;
import dev.lievit.wire.synth.SynthesizerRegistry;

/**
 * Round-trips a {@code Set} (the Livewire {@code CollectionSynth} analogue for the no-JSON-native
 * collection, ADR-0020), recursing through the registry so a {@code Set<EnumX>} reconstructs every
 * element by its own tuple. A plain {@code List} passes through the registry as a JSON array (kept
 * byte-identical, recursing element-wise); only a {@code Set} needs a tuple so it rehydrates as a
 * {@code Set} (dedup preserved), not a {@code List}.
 */
public final class CollectionSynthesizer implements Synthesizer<Set<?>> {

    @Override
    public String key() {
        return "set";
    }

    @Override
    public boolean matches(Object value) {
        return value instanceof Set<?>;
    }

    @Override
    public boolean matchesType(Class<?> type) {
        // The typed-update path does not synthesize a whole set from a raw scalar; an inbound
        // collection arrives as JSON and is handled element-wise on dehydrate of the next snapshot.
        return false;
    }

    @Override
    public Dehydrated dehydrate(Set<?> value, SynthesizerRegistry registry) {
        List<@Nullable Object> out = new ArrayList<>(value.size());
        for (Object element : value) {
            out.add(registry.dehydrate(element));
        }
        return Dehydrated.of(out, key());
    }

    @Override
    public Set<?> hydrate(
            @Nullable Object data, @Nullable String concreteType, SynthesizerRegistry registry) {
        if (!(data instanceof Collection<?> raw)) {
            throw new WireException(
                    WireError.FORBIDDEN_DESERIALIZATION, "set tuple data is not a list");
        }
        Set<@Nullable Object> out = new LinkedHashSet<>();
        for (Object element : raw) {
            out.add(registry.hydrate(element));
        }
        return out;
    }
}
