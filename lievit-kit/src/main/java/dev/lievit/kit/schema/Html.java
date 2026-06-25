/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit.schema;

import java.util.Objects;

import org.jspecify.annotations.Nullable;

/**
 * A raw-markup display component (the filament-schemas {@code Html} carried over): renders a trusted
 * HTML fragment inline in a schema. Non-input, never dehydrated, never validated.
 *
 * <p>The markup is rendered VERBATIM, so the caller owns the trust boundary: pass author-controlled
 * markup only, never user input (use {@link Text} for untrusted strings, which the view escapes).
 * This is the deliberate escape hatch for a curated banner or embed; the responsibility is the
 * adopter's, the same as Filament's {@code Htmlable}.
 */
public final class Html extends SchemaComponent<@Nullable Object, Html> {

    private final String markup;

    private Html(String markup) {
        this.markup = Objects.requireNonNull(markup, "markup");
        dehydrated(false);
    }

    /**
     * @param markup the trusted HTML fragment
     * @return a new html component
     */
    public static Html make(String markup) {
        return new Html(markup);
    }

    /**
     * @return the trusted HTML fragment, rendered verbatim
     */
    public String markup() {
        return markup;
    }
}
