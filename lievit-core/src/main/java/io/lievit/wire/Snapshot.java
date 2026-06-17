/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.wire;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;

/**
 * The wire snapshot: {@code {cid, cls, wire, iat, exp}} (ADR-0001, wire-protocol.md section 2).
 *
 * <p>It carries <strong>state, never code</strong>: {@code cls} is a fully-qualified class name the
 * server resolves to a component at unwrap time, {@code wire} is the bound field state, {@code iat}
 * / {@code exp} bound its lifetime. The snapshot is signed (HS256) before it leaves the server and
 * verified on return; the signature, not the transport, is the security boundary.
 *
 * @param cid the component instance id (Crockford base32, see {@link ComponentId})
 * @param cls the fully-qualified component class name
 * @param wire the serialized {@code @Wire} field state (JSON-shaped, immutable)
 * @param iat issued-at instant (second precision on the wire)
 * @param exp expiry instant ({@code iat} + idle TTL)
 */
public record Snapshot(String cid, String cls, Map<String, Object> wire, Instant iat, Instant exp) {

    /** Defensive copy so the carried state cannot be mutated after signing. */
    public Snapshot {
        wire = Map.copyOf(wire);
    }

    /**
     * Builds a fresh snapshot whose {@code exp} is {@code iat + ttl}, with second precision on the
     * instants (the wire carries Unix epoch seconds).
     *
     * @param cid the component instance id
     * @param cls the fully-qualified component class name
     * @param wire the bound field state
     * @param iat the issued-at instant (truncated to seconds)
     * @param ttl the idle time-to-live
     * @return the snapshot
     */
    public static Snapshot fresh(
            String cid, String cls, Map<String, Object> wire, Instant iat, Duration ttl) {
        Instant issued = Instant.ofEpochSecond(iat.getEpochSecond());
        return new Snapshot(cid, cls, wire, issued, issued.plus(ttl));
    }
}
