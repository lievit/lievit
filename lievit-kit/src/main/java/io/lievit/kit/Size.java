/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit;

/**
 * The shared size scale (the Filament {@code Support/Enums/Size}): used for action buttons, badges,
 * and other sized presentation. Five steps, extra-small to extra-large.
 */
public enum Size {
    /** Extra small. */
    EXTRA_SMALL("xs"),
    /** Small. */
    SMALL("sm"),
    /** Medium (the default). */
    MEDIUM("md"),
    /** Large. */
    LARGE("lg"),
    /** Extra large. */
    EXTRA_LARGE("xl");

    private final String token;

    Size(String token) {
        this.token = token;
    }

    /** @return the CSS-token-style backing value (e.g. {@code "sm"}) */
    public String token() {
        return token;
    }
}
