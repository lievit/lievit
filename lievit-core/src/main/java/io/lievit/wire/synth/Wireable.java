/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.wire.synth;

/**
 * Opt-in round-trip for a user value object across the stateless wire (ADR-0020, the Livewire
 * {@code Wireable} analogue). A type that implements {@code Wireable} controls its own JSON-shaped
 * representation: {@link #toWire()} produces the data written into the snapshot, and a
 * <strong>static</strong> {@code fromWire(Object)} factory (discovered reflectively) rebuilds the
 * instance from it. The {@link SynthesizerRegistry} prefers a {@code Wireable} type over the
 * reflective record / POJO synth.
 *
 * <p>{@code toWire()} must return plain JSON data (a scalar, a {@code List}, or a {@code Map} with
 * String keys, recursively) — the same allowlist every wire value obeys (ADR-0013). The static
 * factory must have the signature {@code static T fromWire(Object data)} where {@code data} is what
 * {@code toWire()} returned. This is the GraalVM-native-safe escape hatch: a {@code Wireable} type
 * round-trips without the reflective field-by-field POJO synth.
 *
 * <p>Example:
 *
 * <pre>{@code
 * public record Money(long cents, String currency) implements Wireable {
 *     public Object toWire() { return Map.of("cents", cents, "currency", currency); }
 *     @SuppressWarnings("unchecked")
 *     public static Money fromWire(Object data) {
 *         Map<String, Object> m = (Map<String, Object>) data;
 *         return new Money(((Number) m.get("cents")).longValue(), (String) m.get("currency"));
 *     }
 * }
 * }</pre>
 */
public interface Wireable {

    /**
     * @return this value as plain JSON data (scalar / list / map with String keys, recursively),
     *     the payload written into the snapshot tuple
     */
    Object toWire();
}
