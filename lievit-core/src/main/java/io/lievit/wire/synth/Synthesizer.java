/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.wire.synth;

import org.jspecify.annotations.Nullable;

/**
 * Reconstructs the exact Java type of a non-primitive {@code @Wire} value across the stateless wire
 * (ADR-0020, the Livewire {@code Synth} analogue). A synthesizer dehydrates a typed value to a
 * JSON-shaped {@link Dehydrated} tuple and hydrates it back, so a record / enum / date / value
 * object survives a round trip instead of decoding to a bare {@code Map} (the confirmed kit-CRUD
 * bug, issue #163).
 *
 * <p>Three dispatch paths the {@link SynthesizerRegistry} uses:
 *
 * <ul>
 *   <li><b>dehydrate</b> — {@link #matches(Object)} selects the synth by the live instance, then
 *       {@link #dehydrate(Object, SynthesizerRegistry)} emits the tuple.
 *   <li><b>hydrate</b> — the tuple's {@code s} key selects the synth, then
 *       {@link #hydrate(Object, String, SynthesizerRegistry)} rebuilds the exact type from the
 *       verified data + concrete-type tag.
 *   <li><b>typed update</b> — when an inbound {@code _updates} value has no tuple (a raw scalar from
 *       a {@code wire:model}, e.g. an {@code <input type=date>} string or a {@code <select>} enum
 *       name), {@link #matchesType(Class)} selects the synth by the field's declared type and
 *       {@link #hydrateFromType(Class, Object, SynthesizerRegistry)} coerces the raw value to it.
 * </ul>
 *
 * <p>Pure Java, zero Spring (ADR-0007). Reflective hydration is gated by the
 * {@link ClassInstantiationGuard} the registry owns (ADR-0021).
 *
 * @param <T> the Java type this synthesizer round-trips
 */
public interface Synthesizer<T> {

    /**
     * @return the stable key written into the tuple's {@code s} field; must be unique in a registry
     */
    String key();

    /**
     * @param value a live {@code @Wire} value (never null; the dispatcher dehydrates null as null)
     * @return true if this synth dehydrates the value (the dehydrate dispatch)
     */
    boolean matches(Object value);

    /**
     * @param type the declared type of a {@code @Wire} field receiving a raw update
     * @return true if this synth coerces a raw value into that type (the typed-update dispatch)
     */
    boolean matchesType(Class<?> type);

    /**
     * Dehydrates a live value to a JSON-shaped tuple, recursing through {@code registry} for any
     * nested typed values.
     *
     * @param value the live value ({@link #matches(Object)} returned true for it)
     * @param registry the registry, for recursive dehydration of nested typed values
     * @return the dehydrated tuple
     */
    Dehydrated dehydrate(T value, SynthesizerRegistry registry);

    /**
     * Hydrates a value from a verified tuple, recursing through {@code registry} for nested values.
     *
     * @param data the tuple's {@code d} payload (plain JSON data, already allowlisted by the guard)
     * @param concreteType the tuple's {@code t} concrete-type FQN, or {@code null} if not carried
     * @param registry the registry, for recursive hydration of nested typed values
     * @return the reconstructed value of the exact type
     */
    T hydrate(@Nullable Object data, @Nullable String concreteType, SynthesizerRegistry registry);

    /**
     * Coerces a raw update value (a scalar written from a {@code wire:model}) into the field's
     * declared type. The default reuses {@link #hydrate} with the declared type as the concrete
     * type; a synth whose update shape differs from its dehydrate shape (the enum-from-string path)
     * overrides this.
     *
     * @param declaredType the {@code @Wire} field's declared type
     * @param raw the raw inbound value (a string, number, or boolean from the client)
     * @param registry the registry, for recursion
     * @return the coerced value of the declared type
     */
    default T hydrateFromType(Class<?> declaredType, @Nullable Object raw, SynthesizerRegistry registry) {
        return hydrate(raw, declaredType.getName(), registry);
    }
}
