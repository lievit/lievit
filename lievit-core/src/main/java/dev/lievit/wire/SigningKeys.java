/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.wire;

import java.util.Arrays;

import org.jspecify.annotations.Nullable;

/**
 * The signing material: the current key plus an optional previous key for the rotation grace
 * window (ADR-0001, wire-protocol.md section 3).
 *
 * <p>Each key has a {@code kid} that rides in the JWT header so the verifier knows which key to
 * check against. New snapshots are always signed with the current key; a snapshot bearing the
 * previous {@code kid} verifies against the previous key while it is present (the 24 h grace),
 * and is rejected once the previous key is removed.
 *
 * <p>The key bytes are required to be at least 32 bytes (the HS256 floor); a shorter key is a
 * construction failure, not a runtime surprise.
 */
public final class SigningKeys {

    private static final int MIN_KEY_BYTES = 32;

    private final String currentKid;
    private final byte[] currentKey;
    private final @Nullable String previousKid;
    private final byte @Nullable [] previousKey;

    private SigningKeys(
            String currentKid,
            byte[] currentKey,
            @Nullable String previousKid,
            byte @Nullable [] previousKey) {
        requireStrongKey(currentKey);
        if (previousKey != null) {
            requireStrongKey(previousKey);
        }
        this.currentKid = currentKid;
        this.currentKey = currentKey.clone();
        this.previousKid = previousKid;
        this.previousKey = previousKey == null ? null : previousKey.clone();
    }

    /**
     * A single active key (no rotation in progress).
     *
     * @param kid the current key id
     * @param key the current key bytes ({@code >= 32} bytes)
     * @return the signing material
     */
    public static SigningKeys of(String kid, byte[] key) {
        return new SigningKeys(kid, key, null, null);
    }

    /**
     * Current key plus previous key, for the rotation grace window.
     *
     * @param currentKid the new (current) key id
     * @param currentKey the new key bytes ({@code >= 32} bytes)
     * @param previousKid the retiring key id
     * @param previousKey the retiring key bytes ({@code >= 32} bytes)
     * @return the signing material
     */
    public static SigningKeys rotated(
            String currentKid, byte[] currentKey, String previousKid, byte[] previousKey) {
        return new SigningKeys(currentKid, currentKey, previousKid, previousKey);
    }

    /**
     * @return the key id new snapshots are signed with
     */
    public String currentKid() {
        return currentKid;
    }

    /**
     * @return a copy of the current signing key bytes
     */
    public byte[] currentKey() {
        return currentKey.clone();
    }

    /**
     * Resolves the verification key for a snapshot's {@code kid}.
     *
     * @param kid the key id taken from the snapshot's JWT header
     * @return the key bytes to verify against, or {@code null} if the kid is unknown (retired or
     *     never valid): an unknown kid cannot be honored and the snapshot is treated as forged
     */
    public byte @Nullable [] verificationKey(String kid) {
        if (kid.equals(currentKid)) {
            return currentKey.clone();
        }
        if (previousKey != null && kid.equals(previousKid)) {
            return previousKey.clone();
        }
        return null;
    }

    private static void requireStrongKey(byte[] key) {
        if (key.length < MIN_KEY_BYTES) {
            // Message carries the floor, never the key bytes.
            throw new IllegalArgumentException(
                    "lievit signing key must be at least "
                            + MIN_KEY_BYTES
                            + " bytes (got "
                            + key.length
                            + ")");
        }
    }

    @Override
    public boolean equals(@Nullable Object o) {
        if (this == o) {
            return true;
        }
        if (!(o instanceof SigningKeys other)) {
            return false;
        }
        return currentKid.equals(other.currentKid)
                && Arrays.equals(currentKey, other.currentKey)
                && java.util.Objects.equals(previousKid, other.previousKid)
                && Arrays.equals(previousKey, other.previousKey);
    }

    @Override
    public int hashCode() {
        return currentKid.hashCode();
    }
}
