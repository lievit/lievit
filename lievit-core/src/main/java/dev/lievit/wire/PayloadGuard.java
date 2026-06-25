/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.wire;

import java.util.Collection;
import java.util.List;
import java.util.Map;

/**
 * Enforces the structural payload caps and the deserialization allowlist before a wire call reaches
 * the component (ADR-0013, wire-protocol.md §6). Pure Java, zero Spring (ADR-0007).
 *
 * <p>The 64 kb byte cap and the snapshot signature bound the payload at the edge; this guard bounds
 * its <em>shape</em>, so an algorithmic-complexity attack cannot ride inside a small, validly-signed
 * payload (Livewire {@code HandleComponents.php:517-520} parity: max calls, max nesting depth):
 *
 * <ul>
 *   <li><b>max {@code _updates}</b> — too many field updates is a {@link
 *       WireError#PAYLOAD_TOO_COMPLEX} (413).
 *   <li><b>max {@code _calls}</b> — too many action invocations is a {@link
 *       WireError#PAYLOAD_TOO_COMPLEX} (413).
 *   <li><b>max nesting depth</b> — an update value nested deeper than the limit is a {@link
 *       WireError#PAYLOAD_TOO_COMPLEX} (413); the recursion is bounded so a deep map/list cannot
 *       blow the stack.
 *   <li><b>deserialization allowlist</b> — every leaf in an update value must be a JSON scalar
 *       ({@code null}, boolean, number, string) and every node a {@link Map} or {@link Collection};
 *       anything else (an opaque object, a polymorphic {@code @class} hint that produced a typed
 *       instance) is a {@link WireError#FORBIDDEN_DESERIALIZATION} (422). This is the JVM gadget
 *       defense: the snapshot carries <em>state, never code</em> (ADR-0001), and a value is bound to
 *       a {@code @Wire} field only after it has been proven to be plain data (ADR-0013).
 * </ul>
 *
 * <p>The guard is invoked on the inbound {@code _updates} / {@code _calls} (the client-controlled
 * surface) and on the rehydrated snapshot {@code wire} (server-signed, but a signed payload from a
 * compromised key must still not deserialize a gadget). It never inspects field <em>names</em>
 * against the component (that is the dispatcher's allowlist job); it only bounds the shape.
 */
public final class PayloadGuard {

    /** Livewire's default: 50 calls per request. */
    public static final int DEFAULT_MAX_CALLS = 50;

    /** lievit default: 100 field updates per request (Livewire has no separate update cap). */
    public static final int DEFAULT_MAX_UPDATES = 100;

    /** Livewire's default: 10 levels of update-path / value nesting. */
    public static final int DEFAULT_MAX_NESTING_DEPTH = 10;

    private final int maxUpdates;
    private final int maxCalls;
    private final int maxNestingDepth;

    /** Uses the protocol defaults (100 updates, 50 calls, depth 10; wire-protocol.md §6). */
    public PayloadGuard() {
        this(DEFAULT_MAX_UPDATES, DEFAULT_MAX_CALLS, DEFAULT_MAX_NESTING_DEPTH);
    }

    /**
     * @param maxUpdates the cap on {@code _updates} entries
     * @param maxCalls the cap on {@code _calls} entries
     * @param maxNestingDepth the cap on update-value nesting depth (1 == a flat scalar)
     */
    public PayloadGuard(int maxUpdates, int maxCalls, int maxNestingDepth) {
        this.maxUpdates = maxUpdates;
        this.maxCalls = maxCalls;
        this.maxNestingDepth = maxNestingDepth;
    }

    /**
     * Validates the inbound client surface of a wire call: the {@code _updates} count, the
     * {@code _calls} count, and the shape of every update value.
     *
     * @param updates the client field updates
     * @param calls the client action names
     * @throws WireException {@link WireError#PAYLOAD_TOO_COMPLEX} if a count or nesting cap is
     *     exceeded; {@link WireError#FORBIDDEN_DESERIALIZATION} if a value is not plain JSON data
     */
    public void checkInbound(Map<String, Object> updates, List<String> calls) {
        if (updates.size() > maxUpdates) {
            throw new WireException(
                    WireError.PAYLOAD_TOO_COMPLEX, "too many _updates entries in one wire call");
        }
        if (calls.size() > maxCalls) {
            throw new WireException(
                    WireError.PAYLOAD_TOO_COMPLEX, "too many _calls entries in one wire call");
        }
        for (Object value : updates.values()) {
            checkValue(value, 1);
        }
    }

    /**
     * Validates the rehydrated snapshot {@code wire} state. The snapshot is server-signed, but a
     * signed payload must still never deserialize a gadget (defense in depth if the key leaks), so
     * the same allowlist applies.
     *
     * @param wire the snapshot's {@code @Wire} state map
     * @throws WireException {@link WireError#FORBIDDEN_DESERIALIZATION} if a value is not plain JSON
     *     data; {@link WireError#PAYLOAD_TOO_COMPLEX} if it nests deeper than the cap
     */
    public void checkSnapshotWire(Map<String, Object> wire) {
        for (Object value : wire.values()) {
            checkValue(value, 1);
        }
    }

    /**
     * Recursively bounds one value: depth-capped, and every node must be a JSON scalar, a {@link
     * Map}, or a {@link Collection}. Anything else is a forbidden deserialization.
     */
    private void checkValue(Object value, int depth) {
        if (depth > maxNestingDepth) {
            throw new WireException(
                    WireError.PAYLOAD_TOO_COMPLEX, "wire value nested deeper than the limit");
        }
        if (value == null || isScalar(value)) {
            return;
        }
        if (value instanceof Map<?, ?> map) {
            for (Map.Entry<?, ?> entry : map.entrySet()) {
                if (!(entry.getKey() instanceof String)) {
                    throw new WireException(
                            WireError.FORBIDDEN_DESERIALIZATION,
                            "wire map key is not a string");
                }
                checkValue(entry.getValue(), depth + 1);
            }
            return;
        }
        if (value instanceof Collection<?> collection) {
            for (Object element : collection) {
                checkValue(element, depth + 1);
            }
            return;
        }
        // Not a scalar, map, or collection: an opaque/typed object reached the wire. Refuse it
        // before it is bound to a field. This is the gadget-chain defense (ADR-0013).
        throw new WireException(
                WireError.FORBIDDEN_DESERIALIZATION,
                "wire value is not a JSON scalar, list, or object");
    }

    private static boolean isScalar(Object value) {
        return value instanceof String
                || value instanceof Number
                || value instanceof Boolean
                || value instanceof Character;
    }
}
