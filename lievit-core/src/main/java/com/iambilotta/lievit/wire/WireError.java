/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package com.iambilotta.lievit.wire;

/**
 * The terminal error states of a wire call, mapped to their HTTP status codes (ADR-0001,
 * wire-protocol.md section 4). Every failed wire call lands in exactly one of these.
 *
 * <p>This enum is pure protocol vocabulary: it carries the status code and the {@code Lievit-Reason}
 * header value, but knows nothing about Spring or HTTP machinery. The web layer (in the starter)
 * translates these into responses.
 */
public enum WireError {

    /**
     * The snapshot HMAC did not verify (tampered, or signed with a key the server no longer
     * honors). Treated as forgery; the call never reaches the component. No normal HTTP code: the
     * web layer rejects it (the protocol does not hand the client a retry path for a forged token).
     */
    SNAPSHOT_FORGED(403, "snapshot-forged"),

    /** The snapshot is past its {@code exp}. Maps to {@code 409}; the client re-mounts. */
    SNAPSHOT_EXPIRED(409, "snapshot-expired"),

    /**
     * The client tried to update a {@code locked} {@code @Wire} field (a field marked
     * {@code @LievitProperty(locked = true)}). Maps to {@code 403}: the snapshot signature stops
     * tampering between requests, but the lock is what stops the first request from setting a
     * server-owned field, and a client that tries is treated like a tamper (ADR-0001 amendment,
     * Livewire {@code #[Locked]} parity).
     */
    LOCKED_PROPERTY(403, "locked-property"),

    /**
     * Too many checksum / signature failures from one client in the rate-limit window (10 in 600 s,
     * Livewire parity). Maps to {@code 429}: a brute-force / probing defense layered on top of the
     * HMAC (ADR-0001 amendment).
     */
    TOO_MANY_CHECKSUM_FAILURES(429, "too-many-failures"),

    /** The {@code cls} FQN no longer resolves to a component. Maps to {@code 410}. */
    UNKNOWN_COMPONENT(410, "gone"),

    /** The request payload exceeded 64 kb. Maps to {@code 413}. */
    PAYLOAD_TOO_LARGE(413, "too-large"),

    /** An action exceeded the 5 s timeout. Maps to {@code 504}. */
    ACTION_TIMEOUT(504, "timeout");

    private final int status;
    private final String reason;

    WireError(int status, String reason) {
        this.status = status;
        this.reason = reason;
    }

    /**
     * @return the HTTP status code this error maps to
     */
    public int status() {
        return status;
    }

    /**
     * @return the {@code Lievit-Reason} header value for this error
     */
    public String reason() {
        return reason;
    }
}
