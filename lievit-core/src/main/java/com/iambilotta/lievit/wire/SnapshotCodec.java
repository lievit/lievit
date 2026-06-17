/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package com.iambilotta.lievit.wire;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;

import javax.crypto.SecretKey;

import org.jspecify.annotations.Nullable;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jws;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.LocatorAdapter;
import io.jsonwebtoken.ProtectedHeader;
import io.jsonwebtoken.security.Keys;

/**
 * Signs and verifies wire snapshots as HS256 JWTs (ADR-0001, wire-protocol.md section 3).
 *
 * <p>This class is pure Java: it knows JJWT and the snapshot schema, nothing about Spring or HTTP
 * (ADR-0007, the wire codec is Spring-free). Signing always uses the current key; verification
 * resolves the key by the {@code kid} header so a snapshot from the previous key still verifies
 * during the rotation grace window.
 *
 * <p>Expiry is checked here against an explicit {@code now}, after the signature has verified, so
 * the codec can tell a forged token ({@link WireError#SNAPSHOT_FORGED}) from a merely stale one
 * ({@link WireError#SNAPSHOT_EXPIRED}). The two are different client recoveries (section 4).
 */
public final class SnapshotCodec {

    private static final String CLAIM_CID = "cid";
    private static final String CLAIM_CLS = "cls";
    private static final String CLAIM_WIRE = "wire";

    private final SigningKeys keys;
    private final Duration ttl;

    /**
     * @param keys the current (and optional previous) signing material
     * @param ttl the idle time-to-live applied to a freshly signed snapshot's {@code exp}
     */
    public SnapshotCodec(SigningKeys keys, Duration ttl) {
        this.keys = keys;
        this.ttl = ttl;
    }

    /**
     * @return the idle time-to-live this codec stamps onto fresh snapshots
     */
    public Duration ttl() {
        return ttl;
    }

    /**
     * Signs a snapshot with the current key, stamping its {@code kid} into the JWT header.
     *
     * @param snapshot the snapshot to sign
     * @return the compact signed JWT string
     */
    public String sign(Snapshot snapshot) {
        SecretKey key = Keys.hmacShaKeyFor(keys.currentKey());
        return Jwts.builder()
                .header()
                .keyId(keys.currentKid())
                .and()
                .claim(CLAIM_CID, snapshot.cid())
                .claim(CLAIM_CLS, snapshot.cls())
                .claim(CLAIM_WIRE, snapshot.wire())
                .issuedAt(java.util.Date.from(snapshot.iat()))
                .expiration(java.util.Date.from(snapshot.exp()))
                .signWith(key, Jwts.SIG.HS256)
                .compact();
    }

    /**
     * Verifies a signed snapshot and decodes it.
     *
     * @param signed the compact signed JWT string
     * @param now the instant to evaluate expiry against
     * @return the decoded snapshot
     * @throws WireException {@link WireError#SNAPSHOT_FORGED} if the signature fails or the kid is
     *     unknown; {@link WireError#SNAPSHOT_EXPIRED} if {@code now} is past {@code exp}
     */
    public Snapshot verify(String signed, Instant now) {
        Jws<Claims> jws;
        try {
            jws =
                    Jwts.parser()
                            .keyLocator(new KidKeyLocator(keys))
                            // We evaluate expiry ourselves below, against the supplied `now`,
                            // so JJWT's own clock must not pre-empt the FORGED/EXPIRED split.
                            .clockSkewSeconds(Long.MAX_VALUE / 1000)
                            .build()
                            .parseSignedClaims(signed);
        } catch (JwtException | IllegalArgumentException e) {
            // Bad signature, unknown kid (locator returned null), or malformed token: all forged.
            throw new WireException(WireError.SNAPSHOT_FORGED, "snapshot signature did not verify");
        }

        Claims claims = jws.getPayload();
        Instant exp = claims.getExpiration().toInstant();
        if (now.isAfter(exp)) {
            throw new WireException(WireError.SNAPSHOT_EXPIRED, "snapshot expired");
        }

        @SuppressWarnings("unchecked")
        Map<String, Object> wire = claims.get(CLAIM_WIRE, Map.class);
        return new Snapshot(
                claims.get(CLAIM_CID, String.class),
                claims.get(CLAIM_CLS, String.class),
                wire,
                claims.getIssuedAt().toInstant(),
                exp);
    }

    /** Resolves the verification key by the {@code kid} header; an unknown kid yields null. */
    private static final class KidKeyLocator extends LocatorAdapter<java.security.Key> {
        private final SigningKeys keys;

        private KidKeyLocator(SigningKeys keys) {
            this.keys = keys;
        }

        @Override
        protected java.security.@Nullable Key locate(ProtectedHeader header) {
            String kid = header.getKeyId();
            if (kid == null) {
                return null;
            }
            byte[] key = keys.verificationKey(kid);
            return key == null ? null : Keys.hmacShaKeyFor(key);
        }
    }
}
