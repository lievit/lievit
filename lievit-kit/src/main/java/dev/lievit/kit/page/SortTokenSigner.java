/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit.page;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Base64;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

/**
 * Signs and verifies the sort-column tokens that ride in sortable-column links (issue #491,
 * ADR sw-architecture-008 backflow). A signed token is {@code <sortKey>.<sigB64>}: the server
 * produces it at render time and the server verifies it on the next GET, so a tampered
 * {@code ?sort=} value is rejected before it reaches the repository.
 *
 * <p>Reuses the same HMAC-SHA256 primitive as {@link dev.lievit.upload.TempFileSigner}: constant-time
 * compare, URL-safe base64, no expiry (sort tokens are stateless and short-lived by design — they
 * ride on navigational GET links and are regenerated on every render).
 *
 * <p>The signing is opt-in: hosts that supply no key continue to receive the plain sort key via
 * {@link KitTableView#sortHref(String)}; hosts that call
 * {@link KitTableView#withSignedSort(SortTokenSigner)} get HMAC-protected sort links. Existing
 * adopters are unaffected (additive, backward-compatible). ADR sw-architecture-008 (override-triage
 * backflow).
 *
 * <p>This class is pure (no Spring, no wire): it signs and verifies tokens. The key wiring is the
 * host's responsibility (e.g. a Spring {@code @Bean} reading {@code lievit.kit.sort-token.secret}).
 */
public final class SortTokenSigner {

    private static final String HMAC = "HmacSHA256";
    private static final Base64.Encoder ENCODER = Base64.getUrlEncoder().withoutPadding();
    private static final Base64.Decoder DECODER = Base64.getUrlDecoder();

    /**
     * The minimum accepted key length. Matches the floor used by
     * {@link dev.lievit.wire.SigningKeys} and {@link dev.lievit.upload.TempFileSigner}.
     */
    public static final int MIN_KEY_BYTES = 16;

    private final byte[] key;

    /**
     * @param key the HMAC-SHA256 key bytes ({@link #MIN_KEY_BYTES} or more recommended; reuse the
     *     lievit signing key or supply a dedicated secret via {@code lievit.kit.sort-token.secret})
     * @throws IllegalArgumentException if the key is empty
     */
    public SortTokenSigner(byte[] key) {
        if (key.length < MIN_KEY_BYTES) {
            throw new IllegalArgumentException(
                    "sort-token signing key must be at least "
                            + MIN_KEY_BYTES
                            + " bytes (got "
                            + key.length
                            + ")");
        }
        this.key = key.clone();
    }

    /**
     * Signs a sort key, producing the opaque token the sort link carries.
     *
     * <p>The sort key may be prefixed with {@code "-"} to indicate descending order (e.g.
     * {@code "-name"}); the prefix survives the round-trip intact so the same token encodes both
     * the column and the intended direction.
     *
     * @param sortKey the sort key to sign (e.g. {@code "name"} or {@code "-name"})
     * @return the signed token {@code <sortKeyB64>.<sigB64>} (URL-safe, no padding)
     */
    public String sign(String sortKey) {
        String keyB64 = ENCODER.encodeToString(sortKey.getBytes(StandardCharsets.UTF_8));
        String sig = ENCODER.encodeToString(hmac(keyB64));
        return keyB64 + "." + sig;
    }

    /**
     * Verifies a signed token and returns the original sort key, or throws if the token is forged
     * or malformed.
     *
     * @param token the signed token (as produced by {@link #sign(String)})
     * @return the verified sort key (e.g. {@code "name"} or {@code "-name"})
     * @throws SortTokenException if the token does not verify (forged, malformed, or tampered)
     */
    public String verify(String token) {
        if (token == null || token.isBlank()) {
            throw new SortTokenException("sort token is missing");
        }
        int dot = token.lastIndexOf('.');
        if (dot < 0) {
            throw new SortTokenException("malformed sort token (no separator)");
        }
        String keyB64 = token.substring(0, dot);
        String sigB64 = token.substring(dot + 1);

        byte[] expected = hmac(keyB64);
        byte[] actual;
        try {
            actual = DECODER.decode(sigB64);
        } catch (IllegalArgumentException e) {
            throw new SortTokenException("malformed sort token signature");
        }
        if (!MessageDigest.isEqual(expected, actual)) {
            throw new SortTokenException("sort token signature mismatch (tampered or forged)");
        }
        try {
            return new String(DECODER.decode(keyB64), StandardCharsets.UTF_8);
        } catch (IllegalArgumentException e) {
            throw new SortTokenException("malformed sort token key encoding");
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
