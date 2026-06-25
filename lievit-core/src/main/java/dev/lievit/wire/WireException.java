/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.wire;

/**
 * Signals that a wire call cannot proceed, carrying the precise {@link WireError} terminal state.
 *
 * <p>Thrown by the pure-Java wire layer (codec, dispatcher); the web layer maps the carried error
 * to an HTTP response (ADR-0001, wire-protocol.md section 4). The message never includes snapshot,
 * token, or payload contents (privacy rule, SECURITY.md).
 */
public final class WireException extends RuntimeException {

    private final WireError error;

    /**
     * Creates a wire exception for the given terminal error state.
     *
     * @param error the terminal error this call landed in
     * @param message a non-sensitive description (no snapshot/token/payload contents)
     */
    public WireException(WireError error, String message) {
        super(message);
        this.error = error;
    }

    /**
     * @return the terminal error state of this failed wire call
     */
    public WireError error() {
        return error;
    }
}
