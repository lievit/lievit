/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.upload;

/**
 * Thrown when an upload token is forged, malformed, expired, or names an unsafe path (issue #159).
 * The message stays coarse on purpose (fail-closed, ADR-0014): the HTTP edge maps this to a generic
 * client error without echoing path internals.
 */
public final class InvalidTempPathException extends RuntimeException {

    /**
     * @param message the coarse reason (never echoed to the client verbatim)
     */
    public InvalidTempPathException(String message) {
        super(message);
    }
}
