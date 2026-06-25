/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit.support;

/**
 * The shared width vocabulary for sized surfaces (modals, dropdowns, containers), the filament-app
 * {@code Width} enum carried over.
 */
public enum Width {
    /** Extra small. */
    EXTRA_SMALL("xs"),
    /** Small. */
    SMALL("sm"),
    /** Medium. */
    MEDIUM("md"),
    /** Large. */
    LARGE("lg"),
    /** Extra large. */
    EXTRA_LARGE("xl"),
    /** Two extra large. */
    TWO_EXTRA_LARGE("2xl"),
    /** Three extra large. */
    THREE_EXTRA_LARGE("3xl"),
    /** Full width. */
    FULL("full"),
    /** Screen width. */
    SCREEN("screen");

    private final String token;

    Width(String token) {
        this.token = token;
    }

    /**
     * @return the short CSS token for this width
     */
    public String token() {
        return token;
    }
}
