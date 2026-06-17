/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package com.iambilotta.lievit.wire;

import java.security.SecureRandom;

/**
 * Generates component instance ids: 128 bits of {@link SecureRandom}, encoded as a 26-character
 * Crockford base32 string (alphabet without {@code I}, {@code L}, {@code O}, {@code U}) (ADR-0001,
 * wire-protocol.md section 2). This is the {@code cid} on the wire and the {@code {componentId}} in
 * the endpoint path. UUID v7 (time-ordered) is roadmap; v0.1 is a random UUID v4 equivalent.
 *
 * <p>Pure Java: the id is not a secret (the snapshot signature is the security boundary), only an
 * unguessable, URL-safe handle.
 */
public final class ComponentId {

    /** Crockford base32 alphabet: digits + letters minus I, L, O, U. */
    private static final char[] CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ".toCharArray();

    private static final int BITS = 128;
    private static final int ID_CHARS = 26; // ceil(128 / 5)

    private final SecureRandom random;

    /** Uses a fresh {@link SecureRandom}. */
    public ComponentId() {
        this(new SecureRandom());
    }

    /**
     * @param random the randomness source (injectable for deterministic tests)
     */
    public ComponentId(SecureRandom random) {
        this.random = random;
    }

    /**
     * Produces a new 26-character Crockford base32 id over 128 random bits.
     *
     * @return the freshly generated component id
     */
    public String next() {
        byte[] bytes = new byte[BITS / 8];
        random.nextBytes(bytes);
        return encode(bytes);
    }

    /**
     * Encodes 16 bytes (128 bits) as 26 Crockford base32 chars.
     *
     * @param bytes exactly 16 bytes
     * @return the 26-character id
     */
    static String encode(byte[] bytes) {
        if (bytes.length != BITS / 8) {
            throw new IllegalArgumentException("component id requires 16 bytes");
        }
        // Read the 128 bits as a big integer, peel off 5 bits at a time, MSB first.
        long hi = 0;
        long lo = 0;
        for (int i = 0; i < 8; i++) {
            hi = (hi << 8) | (bytes[i] & 0xFFL);
        }
        for (int i = 8; i < 16; i++) {
            lo = (lo << 8) | (bytes[i] & 0xFFL);
        }
        char[] out = new char[ID_CHARS];
        // 128 bits -> 26 groups of 5 = 130 bits; the top group uses the high 3 bits, zero-padded.
        java.math.BigInteger value =
                java.math.BigInteger.valueOf(hi)
                        .shiftLeft(64)
                        .or(java.math.BigInteger.valueOf(lo).and(LOW_64));
        java.math.BigInteger mask = java.math.BigInteger.valueOf(0x1F);
        for (int i = ID_CHARS - 1; i >= 0; i--) {
            int idx = value.and(mask).intValueExact();
            out[i] = CROCKFORD[idx];
            value = value.shiftRight(5);
        }
        return new String(out);
    }

    private static final java.math.BigInteger LOW_64 =
            java.math.BigInteger.ONE.shiftLeft(64).subtract(java.math.BigInteger.ONE);
}
