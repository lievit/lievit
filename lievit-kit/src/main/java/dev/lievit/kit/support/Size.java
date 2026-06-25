/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit.support;

/**
 * The shared size vocabulary used across kit components (buttons, badges, inputs, icons), the
 * filament-app {@code Size} enum carried over. Kept as one enum so a component never invents its
 * own size scale and the CSS-class mapping stays in one place.
 */
public enum Size {
    /** Extra small. */
    EXTRA_SMALL("xs"),
    /** Small. */
    SMALL("sm"),
    /** Medium, the default. */
    MEDIUM("md"),
    /** Large. */
    LARGE("lg"),
    /** Extra large. */
    EXTRA_LARGE("xl");

    private final String token;

    Size(String token) {
        this.token = token;
    }

    /**
     * @return the short CSS token ({@code xs}, {@code sm}, {@code md}, {@code lg}, {@code xl})
     */
    public String token() {
        return token;
    }
}
