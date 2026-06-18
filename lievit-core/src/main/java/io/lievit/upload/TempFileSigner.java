/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.upload;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

/**
 * Signs and verifies the <strong>relative</strong> temp paths a file upload produces (issue #159,
 * the server hook). A signed path is the only thing the wire ever carries for an uploaded file: the
 * bytes live on a temp disk, the {@code @Wire} property holds {@link SignedTempPath#token()} (a
 * relative path + expiry + HMAC), never the content (state-never-code, wire-protocol.md §2).
 *
 * <p>The signature is the defense against two attacks the Livewire research surfaced:
 *
 * <ul>
 *   <li><strong>Path traversal</strong>: {@link #verify(String)} rejects any token whose relative
 *       path contains {@code ..}, a leading {@code /}, a backslash, or a NUL, so a forged token can
 *       never escape the temp root. The HMAC then proves the path was issued by this server.
 *   <li><strong>Preview-route abuse</strong>: a preview link is the same signed token with a short
 *       TTL (default 30 min); past expiry {@link #verify(String)} fails, so a leaked preview URL
 *       stops working.
 * </ul>
 *
 * <p>This class is pure (no Spring, no filesystem): it signs and verifies tokens. The storage and
 * the HTTP routes are the starter's concern. HMAC-SHA-256, constant-time compare.
 */
public final class TempFileSigner {

    private static final String HMAC = "HmacSHA256";
    private static final Base64.Encoder ENCODER = Base64.getUrlEncoder().withoutPadding();
    private static final Base64.Decoder DECODER = Base64.getUrlDecoder();

    private final byte[] key;
    private final Duration ttl;

    /**
     * @param key the HMAC key bytes (reuse the lievit signing key; {@code >= 32} bytes recommended)
     * @param ttl how long a signed path stays valid (the preview window; default 30 min)
     */
    public TempFileSigner(byte[] key, Duration ttl) {
        if (key.length == 0) {
            throw new IllegalArgumentException("upload signing key must be non-empty");
        }
        this.key = key.clone();
        this.ttl = ttl;
    }

    /**
     * Signs a relative temp path, returning the opaque token the client carries as the field value.
     *
     * @param relativePath the path under the temp root (e.g. {@code "2026/06/abc123.png"})
     * @param now the issue instant (its {@code +ttl} is the expiry)
     * @return the signed token {@code <pathB64>.<expEpoch>.<sigB64>}
     * @throws IllegalArgumentException if the path is not a safe relative path
     */
    public SignedTempPath sign(String relativePath, Instant now) {
        requireSafeRelative(relativePath);
        long exp = now.plus(ttl).getEpochSecond();
        String payload = ENCODER.encodeToString(relativePath.getBytes(StandardCharsets.UTF_8)) + "." + exp;
        String signature = ENCODER.encodeToString(hmac(payload));
        return new SignedTempPath(relativePath, exp, payload + "." + signature);
    }

    /**
     * Verifies a token and returns the relative path it names, or throws if the token is forged,
     * malformed, expired, or names an unsafe path.
     *
     * @param token the signed token (as produced by {@link #sign})
     * @return the verified relative path (safe to resolve under the temp root)
     * @throws InvalidTempPathException if the token does not verify
     */
    public String verify(String token) {
        return verify(token, Instant.now());
    }

    /**
     * Verifies a token against an explicit clock (for tests).
     *
     * @param token the signed token
     * @param now the instant to check expiry against
     * @return the verified relative path
     * @throws InvalidTempPathException if the token does not verify
     */
    public String verify(String token, Instant now) {
        String[] parts = token.split("\\.");
        if (parts.length != 3) {
            throw new InvalidTempPathException("malformed upload token");
        }
        String payload = parts[0] + "." + parts[1];
        byte[] expected = hmac(payload);
        byte[] actual;
        try {
            actual = DECODER.decode(parts[2]);
        } catch (IllegalArgumentException e) {
            throw new InvalidTempPathException("malformed upload token signature");
        }
        if (!MessageDigest.isEqual(expected, actual)) {
            throw new InvalidTempPathException("upload token signature mismatch (forged or tampered)");
        }
        long exp;
        try {
            exp = Long.parseLong(parts[1]);
        } catch (NumberFormatException e) {
            throw new InvalidTempPathException("malformed upload token expiry");
        }
        if (now.getEpochSecond() > exp) {
            throw new InvalidTempPathException("upload token expired");
        }
        String relativePath;
        try {
            relativePath = new String(DECODER.decode(parts[0]), StandardCharsets.UTF_8);
        } catch (IllegalArgumentException e) {
            throw new InvalidTempPathException("malformed upload token path");
        }
        requireSafeRelative(relativePath);
        return relativePath;
    }

    /** Rejects any path that could escape the temp root (traversal / absolute / NUL). */
    static void requireSafeRelative(String path) {
        if (path.isBlank()
                || path.startsWith("/")
                || path.startsWith("\\")
                || path.contains("..")
                || path.contains("\\")
                || path.indexOf('\0') >= 0) {
            throw new InvalidTempPathException("unsafe upload path: " + path);
        }
    }

    private byte[] hmac(String payload) {
        try {
            Mac mac = Mac.getInstance(HMAC);
            mac.init(new SecretKeySpec(key, HMAC));
            return mac.doFinal(payload.getBytes(StandardCharsets.UTF_8));
        } catch (java.security.GeneralSecurityException e) {
            throw new IllegalStateException("HMAC unavailable", e);
        }
    }
}
