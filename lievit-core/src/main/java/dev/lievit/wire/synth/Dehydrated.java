/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.wire.synth;

import java.util.LinkedHashMap;
import java.util.Map;

import org.jspecify.annotations.Nullable;

/**
 * The result of dehydrating a non-primitive {@code @Wire} value: the JSON-shaped {@code data}, the
 * {@code synthKey} that can reconstruct it, and the optional concrete {@code type} (the FQN a synth
 * needs to rebuild a record / POJO / enum; {@code null} when the key alone suffices, e.g. a
 * temporal). The dispatcher writes this into the snapshot {@code wire} map as the tuple
 * {@code { "@w": { "d": data, "s": synthKey, "t": type } }} (ADR-0020, wire-protocol.md §2).
 *
 * @param data the JSON-shaped payload (scalar, list, or map; itself possibly carrying nested tuples)
 * @param synthKey the {@link Synthesizer#key()} that produced this and can rebuild it
 * @param type the concrete class name to reconstruct, or {@code null} when the key is sufficient
 */
public record Dehydrated(@Nullable Object data, String synthKey, @Nullable String type) {

    /** The reserved envelope key marking a value in the snapshot {@code wire} as a typed tuple. */
    public static final String ENVELOPE = "@w";

    /** The tuple key for the JSON data payload. */
    public static final String DATA = "d";

    /** The tuple key for the synthesizer key. */
    public static final String SYNTH = "s";

    /** The tuple key for the concrete type FQN. */
    public static final String TYPE = "t";

    /**
     * Builds a dehydrated tuple with no concrete type (the synth key alone reconstructs it).
     *
     * @param data the JSON-shaped payload
     * @param synthKey the synthesizer key
     * @return the dehydrated tuple
     */
    public static Dehydrated of(@Nullable Object data, String synthKey) {
        return new Dehydrated(data, synthKey, null);
    }

    /**
     * Builds a dehydrated tuple carrying the concrete type the synth needs to reconstruct.
     *
     * @param data the JSON-shaped payload
     * @param synthKey the synthesizer key
     * @param type the concrete class name
     * @return the dehydrated tuple
     */
    public static Dehydrated of(@Nullable Object data, String synthKey, String type) {
        return new Dehydrated(data, synthKey, type);
    }

    /**
     * Renders this tuple as the {@code @w}-enveloped map written into the snapshot {@code wire}.
     *
     * @return the envelope map {@code { "@w": { "d", "s", "t" } }}
     */
    public Map<String, Object> toEnvelope() {
        Map<String, Object> inner = new LinkedHashMap<>();
        inner.put(DATA, data);
        inner.put(SYNTH, synthKey);
        if (type != null) {
            inner.put(TYPE, type);
        }
        Map<String, Object> outer = new LinkedHashMap<>();
        outer.put(ENVELOPE, inner);
        return outer;
    }

    /**
     * Recognizes a tuple envelope produced by {@link #toEnvelope()} (a one-entry map whose only key
     * is {@code @w} and whose value is a map). A plain JSON map of component state is not a tuple.
     *
     * @param value a value decoded from the snapshot {@code wire}
     * @return true if the value is a typed-tuple envelope
     */
    public static boolean isEnvelope(@Nullable Object value) {
        if (!(value instanceof Map<?, ?> map) || map.size() != 1) {
            return false;
        }
        Object inner = map.get(ENVELOPE);
        return inner instanceof Map<?, ?>;
    }

    /**
     * Reads a tuple back from its {@code @w} envelope.
     *
     * @param envelope a value for which {@link #isEnvelope(Object)} is true
     * @return the decoded tuple
     */
    public static Dehydrated fromEnvelope(Object envelope) {
        Map<?, ?> outer = (Map<?, ?>) envelope;
        Map<?, ?> inner = (Map<?, ?>) outer.get(ENVELOPE);
        Object synth = inner.get(SYNTH);
        Object type = inner.get(TYPE);
        return new Dehydrated(
                inner.get(DATA),
                synth == null ? "" : synth.toString(),
                type == null ? null : type.toString());
    }
}
