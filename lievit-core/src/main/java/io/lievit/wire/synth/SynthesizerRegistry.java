/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.wire.synth;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.jspecify.annotations.Nullable;

import io.lievit.wire.WireError;
import io.lievit.wire.WireException;
import io.lievit.wire.synth.builtin.BigDecimalSynthesizer;
import io.lievit.wire.synth.builtin.BigIntegerSynthesizer;
import io.lievit.wire.synth.builtin.ByteArraySynthesizer;
import io.lievit.wire.synth.builtin.CollectionSynthesizer;
import io.lievit.wire.synth.builtin.EnumSynthesizer;
import io.lievit.wire.synth.builtin.MapSynthesizer;
import io.lievit.wire.synth.builtin.RecordSynthesizer;
import io.lievit.wire.synth.builtin.TemporalSynthesizer;
import io.lievit.wire.synth.builtin.UuidSynthesizer;
import io.lievit.wire.synth.builtin.WireableSynthesizer;

/**
 * Resolves a {@link Synthesizer} by synth-key (hydrate), by instance (dehydrate), and by declared
 * type (typed update), and drives the recursive dehydrate / hydrate of a {@code @Wire} value
 * (ADR-0020). A non-primitive value dehydrates to a {@code @w}-tagged {@link Dehydrated} tuple; a
 * primitive / scalar / plain JSON map or list passes through unchanged, so the protocol stays
 * backward compatible (the Counter snapshot is byte-for-byte identical).
 *
 * <p>The default registry ships the JVM analogues of Livewire's synth set, most-specific-first:
 * {@link WireableSynthesizer} (a user opt-in type wins over reflection), {@link TemporalSynthesizer}
 * (date / time), {@link EnumSynthesizer} (incl. update-from-string), {@link BigDecimalSynthesizer},
 * {@link BigIntegerSynthesizer}, {@link UuidSynthesizer}, {@link CollectionSynthesizer}
 * (List / Set), {@link MapSynthesizer} (non-String-keyed maps), and {@link RecordSynthesizer} (the
 * reflective record / POJO catch-all). Reflective instantiation on the hydrate path is gated by a
 * {@link ClassInstantiationGuard} (ADR-0021).
 *
 * <p>Pure Java, zero Spring (ADR-0007). Immutable after construction.
 */
public final class SynthesizerRegistry {

    private final List<Synthesizer<?>> synthesizers;
    private final Map<String, Synthesizer<?>> byKey;
    private final ClassInstantiationGuard guard;

    /** Builds the default registry with the built-in synth set and the protocol-default guard. */
    public SynthesizerRegistry() {
        this(defaultSynthesizers(), new ClassInstantiationGuard());
    }

    /**
     * Builds a registry over an explicit synth list (most-specific-first) and an instantiation
     * guard. The list order is the dehydrate / typed-update match order.
     *
     * @param synthesizers the synthesizers, most-specific first
     * @param guard the class-instantiation guard for the hydrate path (ADR-0021)
     */
    public SynthesizerRegistry(List<Synthesizer<?>> synthesizers, ClassInstantiationGuard guard) {
        this.synthesizers = List.copyOf(synthesizers);
        this.guard = guard;
        Map<String, Synthesizer<?>> keys = new LinkedHashMap<>();
        for (Synthesizer<?> s : this.synthesizers) {
            keys.put(s.key(), s);
        }
        this.byKey = Map.copyOf(keys);
    }

    private static List<Synthesizer<?>> defaultSynthesizers() {
        List<Synthesizer<?>> list = new ArrayList<>();
        list.add(new WireableSynthesizer());
        list.add(new TemporalSynthesizer());
        list.add(new EnumSynthesizer());
        list.add(new BigDecimalSynthesizer());
        list.add(new BigIntegerSynthesizer());
        list.add(new UuidSynthesizer());
        list.add(new ByteArraySynthesizer());
        list.add(new CollectionSynthesizer());
        list.add(new MapSynthesizer());
        list.add(new RecordSynthesizer());
        return list;
    }

    /**
     * @return the class-instantiation guard this registry consults before reflective hydration
     */
    public ClassInstantiationGuard guard() {
        return guard;
    }

    /**
     * Dehydrates a value for the snapshot {@code wire}: a primitive / scalar / plain JSON map or
     * list passes through unchanged; any matched synth target is emitted as a {@code @w}-tagged
     * tuple (recursively, for nested typed values).
     *
     * @param value the live {@code @Wire} value (may be null)
     * @return the value as written into the snapshot (a scalar, a passthrough collection / map, or
     *     a tuple envelope)
     */
    @SuppressWarnings("unchecked")
    public @Nullable Object dehydrate(@Nullable Object value) {
        if (value == null || isScalar(value)) {
            return value;
        }
        // A String-keyed map passes through as a plain JSON object, recursing into its values, so a
        // component holding a plain Map (or a parent's nested prop map, ADR-0016) keeps its byte
        // shape; a typed value nested inside becomes a tuple in place. A non-String-keyed map is
        // not valid JSON and is owned by the MapSynthesizer instead.
        if (value instanceof Map<?, ?> map && allStringKeys(map)) {
            Map<String, Object> out = new LinkedHashMap<>();
            for (Map.Entry<?, ?> e : map.entrySet()) {
                out.put((String) e.getKey(), dehydrate(e.getValue()));
            }
            return out;
        }
        // A List passes through as a plain JSON array, recursing into elements, so a plain
        // List<scalar> keeps its byte shape while a List<typed> wraps each element in place. A Set
        // (no JSON native form) is owned by the CollectionSynthesizer below so it round-trips as a
        // Set, not a List.
        if (value instanceof List<?> list && !(value instanceof Set<?>)) {
            List<@Nullable Object> out = new ArrayList<>(list.size());
            for (Object element : list) {
                out.add(dehydrate(element));
            }
            return out;
        }
        for (Synthesizer<?> synth : synthesizers) {
            if (synth.matches(value)) {
                return ((Synthesizer<Object>) synth).dehydrate(value, this).toEnvelope();
            }
        }
        // No synth matched a non-scalar value: refuse it rather than letting an opaque object ride
        // the wire (defense in depth with the PayloadGuard allowlist, ADR-0013).
        throw new WireException(
                WireError.FORBIDDEN_DESERIALIZATION,
                "no synthesizer matched a non-scalar @Wire value of type "
                        + value.getClass().getName());
    }

    /**
     * Hydrates a value read from the snapshot {@code wire}: a tuple envelope is reconstructed to its
     * exact type via its {@code s} synth-key; anything else passes through unchanged (a scalar, or a
     * plain JSON map / list that was never a typed value).
     *
     * @param value the value decoded from the snapshot
     * @return the reconstructed value (the exact Java type for a tuple, the value itself otherwise)
     */
    public @Nullable Object hydrate(@Nullable Object value) {
        if (Dehydrated.isEnvelope(value)) {
            Dehydrated tuple = Dehydrated.fromEnvelope(value);
            Synthesizer<?> synth = byKey.get(tuple.synthKey());
            if (synth == null) {
                throw new WireException(
                        WireError.FORBIDDEN_DESERIALIZATION,
                        "no synthesizer registered for the tuple key " + tuple.synthKey());
            }
            return synth.hydrate(tuple.data(), tuple.type(), this);
        }
        // A plain JSON object / array that passed through dehydrate may carry tuples nested in its
        // values: recurse so those reconstruct, while a pure-scalar container is returned as-is.
        if (value instanceof Map<?, ?> map && allStringKeys(map)) {
            Map<String, Object> out = new LinkedHashMap<>();
            for (Map.Entry<?, ?> e : map.entrySet()) {
                out.put((String) e.getKey(), hydrate(e.getValue()));
            }
            return out;
        }
        if (value instanceof List<?> list) {
            List<@Nullable Object> out = new ArrayList<>(list.size());
            for (Object element : list) {
                out.add(hydrate(element));
            }
            return out;
        }
        return value;
    }

    /**
     * Coerces a raw inbound update value into a {@code @Wire} field's declared type: a tuple is
     * hydrated as usual; a raw scalar (a {@code wire:model} string, e.g. a date input or a select
     * enum name) is matched to a synth by the declared type and coerced. A value that already fits
     * the declared type (or has no matching synth) passes through for the field's own coercion.
     *
     * @param declaredType the declared type of the target {@code @Wire} field
     * @param raw the inbound value from the client {@code _updates}
     * @return the value coerced to the declared type, or the raw value when no synth applies
     */
    @SuppressWarnings("unchecked")
    public @Nullable Object hydrateForUpdate(Class<?> declaredType, @Nullable Object raw) {
        if (Dehydrated.isEnvelope(raw)) {
            return hydrate(raw);
        }
        if (raw == null) {
            return null;
        }
        // The raw value already is an instance of the declared type (e.g. a String into a String
        // field, an int into an int): no synth coercion needed.
        if (declaredType.isInstance(raw)) {
            return raw;
        }
        for (Synthesizer<?> synth : synthesizers) {
            if (synth.matchesType(declaredType)) {
                return ((Synthesizer<Object>) synth).hydrateFromType(declaredType, raw, this);
            }
        }
        // No synth coerces this declared type: leave the raw value for WireField.write's own
        // numeric coercion / fail-closed handling.
        return raw;
    }

    /**
     * Loads + guards a class named in a tuple's {@code t} before a synth instantiates it (ADR-0021).
     *
     * @param className the concrete-type FQN from the tuple
     * @return the resolved, guard-approved class
     * @throws WireException {@link WireError#FORBIDDEN_DESERIALIZATION} if denied or not loadable
     */
    public Class<?> resolveGuarded(String className) {
        guard.check(className);
        Class<?> type;
        try {
            type = Class.forName(className, false, Thread.currentThread().getContextClassLoader());
        } catch (ClassNotFoundException | LinkageError e) {
            throw new WireException(
                    WireError.FORBIDDEN_DESERIALIZATION,
                    "tuple names a class that cannot be loaded: " + className);
        }
        guard.check(type);
        return type;
    }

    /**
     * A JSON-native scalar that round-trips through Jackson byte-identical: a String, a boolean, a
     * char, or a fixed-width number. {@code BigDecimal} / {@code BigInteger} are deliberately
     * <em>excluded</em> (they are {@code Number}s but Jackson decodes a JSON number to {@code Double}
     * / {@code Integer}, losing scale / range), so they take their own synth and dehydrate to a
     * string tuple that survives the codec exactly (ADR-0020).
     */
    private static boolean isScalar(Object value) {
        return value instanceof String
                || value instanceof Boolean
                || value instanceof Character
                || value instanceof Integer
                || value instanceof Long
                || value instanceof Short
                || value instanceof Byte
                || value instanceof Double
                || value instanceof Float;
    }

    private static boolean allStringKeys(Map<?, ?> map) {
        for (Object k : map.keySet()) {
            if (!(k instanceof String)) {
                return false;
            }
        }
        return true;
    }
}
