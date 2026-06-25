/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit;

import java.util.Objects;

/**
 * The width of an action modal as a closed enum (the Filament {@code MaxWidth} carried over):
 * replaces the free-string width with the named scale Filament ships, so a host renders a
 * deterministic max-width class and a client cannot inject an arbitrary token. The
 * {@link #token()} is the lower-kebab handle the rendered modal stamps in
 * {@code data-lv-modal-width}.
 */
public enum ModalWidth {
    /** Extra-small. */
    EXTRA_SMALL("xs"),
    /** Small. */
    SMALL("sm"),
    /** Medium (the default). */
    MEDIUM("md"),
    /** Large. */
    LARGE("lg"),
    /** Extra-large. */
    EXTRA_LARGE("xl"),
    /** 2x large. */
    TWO_EXTRA_LARGE("2xl"),
    /** 3x large. */
    THREE_EXTRA_LARGE("3xl"),
    /** 4x large. */
    FOUR_EXTRA_LARGE("4xl"),
    /** 5x large. */
    FIVE_EXTRA_LARGE("5xl"),
    /** 6x large. */
    SIX_EXTRA_LARGE("6xl"),
    /** 7x large. */
    SEVEN_EXTRA_LARGE("7xl"),
    /** Full-bleed (the slide-over default). */
    SCREEN("screen");

    private final String token;

    ModalWidth(String token) {
        this.token = token;
    }

    /** @return the lower-kebab width token the rendered modal stamps */
    public String token() {
        return token;
    }

    /**
     * Resolves a width token (e.g. {@code "md"}, {@code "2xl"}) to its enum, defaulting to
     * {@link #MEDIUM} for an unknown or blank token (so a legacy free-string width keeps working).
     *
     * @param token the width token
     * @return the matching width, or {@link #MEDIUM}
     */
    public static ModalWidth fromToken(String token) {
        Objects.requireNonNull(token, "token");
        for (ModalWidth w : values()) {
            if (w.token.equalsIgnoreCase(token)) {
                return w;
            }
        }
        return MEDIUM;
    }
}
