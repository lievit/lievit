/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit.support;

/**
 * Where an icon sits relative to its label (on a button, a link, a field affix), the filament-app
 * {@code IconPosition} enum carried over.
 */
public enum IconPosition {
    /** Icon before the label. */
    BEFORE("before"),
    /** Icon after the label. */
    AFTER("after");

    private final String token;

    IconPosition(String token) {
        this.token = token;
    }

    /**
     * @return the position token ({@code before} / {@code after})
     */
    public String token() {
        return token;
    }
}
