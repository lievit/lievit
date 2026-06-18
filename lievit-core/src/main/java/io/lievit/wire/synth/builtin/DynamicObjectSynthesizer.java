/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.wire.synth.builtin;

import java.util.LinkedHashMap;
import java.util.Map;

import org.jspecify.annotations.Nullable;

import io.lievit.wire.WireError;
import io.lievit.wire.WireException;
import io.lievit.wire.synth.Dehydrated;
import io.lievit.wire.synth.DynamicObject;
import io.lievit.wire.synth.Synthesizer;
import io.lievit.wire.synth.SynthesizerRegistry;

/**
 * Round-trips a {@link DynamicObject} (the schemaless {@code stdClass} analogue, ADR-0020 §3 /
 * issue #137): dehydrates it to its plain String-keyed JSON map (recursing through the registry so a
 * typed leaf value still becomes a tuple in place), and hydrates a tuple back to a fresh
 * {@code DynamicObject} over the rebuilt map.
 *
 * <p>The dehydrated data is plain JSON (the {@code DynamicObject} backing is always allowlisted
 * shape), so it carries no concrete type ({@code t} is omitted): the synth key alone reconstructs
 * it, and no reflective instantiation happens, so the {@link io.lievit.wire.synth.ClassInstantiationGuard}
 * has nothing to gate on this path (ADR-0021). The deserialization allowlist (ADR-0013) still runs on
 * the data as for any other wire value.
 */
public final class DynamicObjectSynthesizer implements Synthesizer<DynamicObject> {

    @Override
    public String key() {
        return "dyn";
    }

    @Override
    public boolean matches(Object value) {
        return value instanceof DynamicObject;
    }

    @Override
    public boolean matchesType(Class<?> type) {
        return DynamicObject.class.isAssignableFrom(type);
    }

    @Override
    public Dehydrated dehydrate(DynamicObject value, SynthesizerRegistry registry) {
        // toMap() already flattens nested dynamic objects to plain maps; recurse so any typed leaf
        // (a date, a record) dehydrates to its own tuple in place. No concrete type tag is needed.
        return Dehydrated.of(registry.dehydrate(value.toMap()), key());
    }

    @Override
    public DynamicObject hydrate(
            @Nullable Object data, @Nullable String concreteType, SynthesizerRegistry registry) {
        if (data == null) {
            return new DynamicObject();
        }
        Object rehydrated = registry.hydrate(data);
        if (!(rehydrated instanceof Map<?, ?> map)) {
            throw new WireException(
                    WireError.FORBIDDEN_DESERIALIZATION,
                    "dynamic-object tuple data is not a map");
        }
        Map<String, Object> stringKeyed = new LinkedHashMap<>();
        for (Map.Entry<?, ?> e : map.entrySet()) {
            if (!(e.getKey() instanceof String key)) {
                throw new WireException(
                        WireError.FORBIDDEN_DESERIALIZATION,
                        "dynamic-object tuple has a non-String key");
            }
            stringKeyed.put(key, e.getValue());
        }
        return new DynamicObject(stringKeyed);
    }

    @Override
    public DynamicObject hydrateFromType(
            Class<?> declaredType, @Nullable Object raw, SynthesizerRegistry registry) {
        // The typed-update path is not how a dynamic object is written: a l:model="obj.field" update
        // arrives as a dotted-path key the dispatcher applies via DynamicObject.set, not as a whole
        // raw value coerced into the field. A bare raw value (or null) yields a fresh / wrapped object.
        if (raw instanceof DynamicObject existing) {
            return existing;
        }
        if (raw instanceof Map<?, ?>) {
            return hydrate(raw, null, registry);
        }
        return new DynamicObject();
    }
}
