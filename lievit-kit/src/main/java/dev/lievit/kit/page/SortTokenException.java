/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit.page;

/**
 * Thrown by {@link SortTokenSigner#verify(String)} when a sort token is forged, tampered, or
 * malformed. The host should treat this as a 400 / ignored sort param (never a 5xx).
 */
public final class SortTokenException extends RuntimeException {

    public SortTokenException(String message) {
        super(message);
    }
}
