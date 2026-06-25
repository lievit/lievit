/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.dsl;

import org.jspecify.annotations.Nullable;

/**
 * One HTML attribute on an {@link Element}: a name and an optional value. A {@code null} value
 * renders the attribute as a boolean attribute (just the name, e.g. {@code disabled}); a non-null
 * value is context-aware encoded at render time (ADR-0018, ADR-0084): an ordinary attribute through
 * {@link Escaping#attribute} so it can never break out of its double quotes, a URL-bearing attribute
 * ({@code href}, {@code src}, {@code formaction}, {@code xlink:href}, ...) through {@link
 * Escaping#urlAttribute}, which additionally vets the URL scheme against an allowlist so a {@code
 * javascript:} / {@code data:} payload cannot survive and execute.
 *
 * <p>The attribute name is validated against an HTML name grammar at construction time: a malformed
 * name (whitespace, {@code =}, quotes, {@code /}, {@code >}) is rejected, so an attacker-influenced
 * name cannot inject a second attribute or an event handler. The wire-binding names ({@code l:click},
 * {@code l:model}) and {@code data-*} pass; an {@code on*} handler is admissible syntactically but is
 * never produced by the {@link H} factories that the DSL exposes for event wiring.
 *
 * @param name the attribute name (validated)
 * @param value the attribute value (escaped on render), or {@code null} for a boolean attribute
 */
public record Attr(String name, @Nullable String value) {

    /**
     * @param name the attribute name; must be a syntactically valid HTML attribute name
     * @param value the attribute value, or {@code null} for a boolean attribute
     */
    public Attr {
        if (!isValidName(name)) {
            throw new IllegalArgumentException(
                    "invalid HTML attribute name: \"" + name + "\" (no whitespace, =, quotes, /, <, >)");
        }
    }

    void renderTo(StringBuilder out) {
        out.append(' ').append(name);
        if (value != null) {
            // URL-bearing attributes (href, src, formaction, xlink:href, ...) need scheme
            // validation on top of attribute encoding: a javascript:/data: URL carries no quote
            // to escape and would otherwise survive intact and execute (ADR-0084). Ordinary
            // attributes only need quote-safe encoding.
            String encoded =
                    Escaping.isUrlAttribute(name)
                            ? Escaping.urlAttribute(value)
                            : Escaping.attribute(value);
            out.append("=\"").append(encoded).append('"');
        }
    }

    private static boolean isValidName(String name) {
        if (name == null || name.isEmpty()) {
            return false;
        }
        for (int i = 0; i < name.length(); i++) {
            char c = name.charAt(i);
            if (c <= ' '
                    || c == '='
                    || c == '"'
                    || c == '\''
                    || c == '/'
                    || c == '<'
                    || c == '>'
                    || c == '&'
                    || c == 0x7F) {
                return false;
            }
        }
        return true;
    }
}
