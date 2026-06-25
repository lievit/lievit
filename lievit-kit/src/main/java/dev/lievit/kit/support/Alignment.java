/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit.support;

/**
 * Horizontal alignment of content (text cells, button rows, action groups), the filament-app
 * {@code Alignment} enum carried over.
 */
public enum Alignment {
    /** Start (left in LTR). */
    START("start"),
    /** Centered. */
    CENTER("center"),
    /** End (right in LTR). */
    END("end"),
    /** Justified. */
    JUSTIFY("justify"),
    /** Left (explicit, direction-agnostic). */
    LEFT("left"),
    /** Right (explicit, direction-agnostic). */
    RIGHT("right");

    private final String token;

    Alignment(String token) {
        this.token = token;
    }

    /**
     * @return the CSS alignment token
     */
    public String token() {
        return token;
    }
}
