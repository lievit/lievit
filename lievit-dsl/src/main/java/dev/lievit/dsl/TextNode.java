/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.dsl;

/**
 * Escaped text content (ADR-0018). The {@code value} is rendered through {@link Escaping#text} every
 * time, so markup in a {@code @Wire} value is shown as inert text, never executed. This is the
 * default and only way to put dynamic content into element position; the explicit {@link
 * H#raw(String)} is the single, audit-visible escape hatch.
 *
 * @param value the raw (un-escaped) text; escaped at render time
 */
public record TextNode(String value) implements Html {

    /**
     * @param value the text content (escaped on render); must not be {@code null}
     */
    public TextNode {
        if (value == null) {
            throw new IllegalArgumentException("text value must not be null");
        }
    }

    @Override
    public void renderTo(StringBuilder out) {
        out.append(Escaping.text(value));
    }
}
