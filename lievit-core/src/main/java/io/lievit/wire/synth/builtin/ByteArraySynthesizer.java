/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.wire.synth.builtin;

import java.util.Base64;
import java.util.Map;

import org.jspecify.annotations.Nullable;

import io.lievit.wire.WireError;
import io.lievit.wire.WireException;
import io.lievit.wire.synth.Dehydrated;
import io.lievit.wire.synth.Synthesizer;
import io.lievit.wire.synth.SynthesizerRegistry;

/**
 * Round-trips a {@code byte[]} as a base64 string (ADR-0034, the server half of large-payload
 * encoding, issue #135). A {@code @Wire byte[]} dehydrates to its base64 in the snapshot and hydrates
 * back, so a binary field survives the stateless round trip instead of failing as a non-scalar value.
 *
 * <p>The typed-update path accepts two inbound shapes from the client:
 *
 * <ul>
 *   <li>a plain base64 string (the snapshot reseed form);
 *   <li>the large-payload envelope {@code {__lievit_b64: "<base64>"}} the client emits for a binary
 *       update (chunk-encoded client-side so a 300KB+ array never overflows the call stack, issue
 *       #135) so the action receives the full argument intact.
 * </ul>
 *
 * Pure Java, zero Spring (ADR-0007).
 */
public final class ByteArraySynthesizer implements Synthesizer<byte[]> {

    /** The envelope key the client tags a chunk-encoded base64 byte array with (issue #135). */
    public static final String BASE64_TAG = "__lievit_b64";

    @Override
    public String key() {
        return "bytes";
    }

    @Override
    public boolean matches(Object value) {
        return value instanceof byte[];
    }

    @Override
    public boolean matchesType(Class<?> type) {
        return type == byte[].class;
    }

    @Override
    public Dehydrated dehydrate(byte[] value, SynthesizerRegistry registry) {
        return Dehydrated.of(Base64.getEncoder().encodeToString(value), key());
    }

    @Override
    public byte[] hydrate(
            @Nullable Object data, @Nullable String concreteType, SynthesizerRegistry registry) {
        if (data == null) {
            throw new WireException(WireError.FORBIDDEN_DESERIALIZATION, "byte[] tuple missing data");
        }
        return decode(data.toString());
    }

    @Override
    public byte[] hydrateFromType(
            Class<?> declaredType, @Nullable Object raw, SynthesizerRegistry registry) {
        if (raw == null) {
            throw new WireException(
                    WireError.FORBIDDEN_DESERIALIZATION, "null update for a byte[] field");
        }
        // The large-payload envelope {__lievit_b64: "<base64>"} (issue #135).
        if (raw instanceof Map<?, ?> map && map.get(BASE64_TAG) instanceof String tagged) {
            return decode(tagged);
        }
        // A plain base64 string (the snapshot reseed form).
        return decode(raw.toString());
    }

    private static byte[] decode(String base64) {
        return base64.isEmpty() ? new byte[0] : Base64.getDecoder().decode(base64);
    }
}
