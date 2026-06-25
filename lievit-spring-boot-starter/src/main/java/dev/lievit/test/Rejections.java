/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.test;

import java.util.EnumMap;
import java.util.Map;

import dev.lievit.wire.WireError;

/**
 * The rejection type-tokens a developer names in {@link LievitTester#assertRejected(Class)}, mapped
 * to the {@link WireError} the wire pipeline actually produces (ADR-0010, wire-protocol §4).
 *
 * <p>These are <strong>not</strong> thrown anywhere: they are read-only marker types so a test
 * reads {@code assertRejected(LockedProperty.class)} instead of {@code assertRejected("locked-property")}.
 * The mapping lives here so the harness can translate a marker to the {@code Lievit-Reason} the HTTP
 * edge emits and produce a failure message that names the right code. Each token mirrors exactly one
 * {@link WireError}; the two Livewire's own component tester cannot reach ({@link LockedProperty} from
 * the attacker's seat and {@link TooManyFailures}) are first-class here.
 */
public final class Rejections {

    private Rejections() {}

    /** The base type of every rejection token; never instantiated, only referenced as a class. */
    public abstract static class Rejection {
        private Rejection() {}
    }

    /** A client {@code _updates} entry tried to write a {@code locked} field: 403 locked-property. */
    public static final class LockedProperty extends Rejection {
        private LockedProperty() {}
    }

    /** The snapshot HMAC did not verify (tamper / forged signature): 403 snapshot-forged. */
    public static final class SnapshotForged extends Rejection {
        private SnapshotForged() {}
    }

    /** The snapshot is past its {@code exp}: 409 snapshot-expired (the client re-mounts). */
    public static final class SnapshotExpired extends Rejection {
        private SnapshotExpired() {}
    }

    /** Too many signature failures from this client in the window: 429 too-many-failures. */
    public static final class TooManyFailures extends Rejection {
        private TooManyFailures() {}
    }

    /** The snapshot {@code cls} no longer resolves to a component: 410 gone. */
    public static final class UnknownComponent extends Rejection {
        private UnknownComponent() {}
    }

    /** The payload exceeded the 64 kb cap: 413 too-large. */
    public static final class PayloadTooLarge extends Rejection {
        private PayloadTooLarge() {}
    }

    /** An action exceeded the 5 s timeout: 504 timeout. */
    public static final class ActionTimeout extends Rejection {
        private ActionTimeout() {}
    }

    private static final Map<WireError, Class<? extends Rejection>> BY_ERROR =
            new EnumMap<>(WireError.class);

    static {
        BY_ERROR.put(WireError.LOCKED_PROPERTY, LockedProperty.class);
        BY_ERROR.put(WireError.SNAPSHOT_FORGED, SnapshotForged.class);
        BY_ERROR.put(WireError.SNAPSHOT_EXPIRED, SnapshotExpired.class);
        BY_ERROR.put(WireError.TOO_MANY_CHECKSUM_FAILURES, TooManyFailures.class);
        BY_ERROR.put(WireError.UNKNOWN_COMPONENT, UnknownComponent.class);
        BY_ERROR.put(WireError.PAYLOAD_TOO_LARGE, PayloadTooLarge.class);
        BY_ERROR.put(WireError.ACTION_TIMEOUT, ActionTimeout.class);
    }

    /**
     * Resolves the {@link WireError} a rejection token stands for.
     *
     * @param token the marker class a test named in {@code assertRejected}
     * @return the matching wire error
     * @throws IllegalArgumentException if the token is not a known rejection type
     */
    public static WireError errorFor(Class<? extends Rejection> token) {
        for (Map.Entry<WireError, Class<? extends Rejection>> e : BY_ERROR.entrySet()) {
            if (e.getValue() == token) {
                return e.getKey();
            }
        }
        throw new IllegalArgumentException("unknown rejection type-token: " + token.getName());
    }

    /**
     * Resolves the rejection token for an observed wire error (used to phrase failure messages when
     * the call was rejected for a <em>different</em> reason than the test expected).
     *
     * @param error the wire error the HTTP edge reported via {@code Lievit-Reason}
     * @return the matching marker type, or {@code null} if none maps (should not happen)
     */
    public static Class<? extends Rejection> tokenFor(WireError error) {
        return BY_ERROR.get(error);
    }
}
