/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package com.iambilotta.lievit.dsl;

/**
 * HTML escaping, the security primitive of the DSL (ADR-0015). It is applied to every {@link
 * TextNode} body and every attribute value at render time, so a {@code @Wire} value carrying markup
 * (or a quote-breakout attribute payload) is rendered inert without any author effort.
 *
 * <p>{@link #text(String)} escapes {@code & < > } for element-content position; {@link
 * #attribute(String)} additionally escapes {@code " '} so a value can never break out of a
 * double- or single-quoted attribute. Both are deliberately conservative (the OWASP minimal set
 * plus quotes), which is correct for the contexts the DSL emits: element text and double-quoted
 * attribute values. CSP-safety is structural, not an escaping concern: the DSL has no API to emit an
 * inline {@code <script>} or an {@code on*} handler (see {@link H}).
 */
final class Escaping {

    private Escaping() {}

    /** Escapes a string for HTML <em>element-content</em> position ({@code & < >}). */
    static String text(String value) {
        StringBuilder out = new StringBuilder(value.length() + 16);
        for (int i = 0; i < value.length(); i++) {
            char c = value.charAt(i);
            switch (c) {
                case '&' -> out.append("&amp;");
                case '<' -> out.append("&lt;");
                case '>' -> out.append("&gt;");
                default -> out.append(c);
            }
        }
        return out.toString();
    }

    /** Escapes a string for an HTML <em>attribute value</em> position ({@code & < > " '}). */
    static String attribute(String value) {
        StringBuilder out = new StringBuilder(value.length() + 16);
        for (int i = 0; i < value.length(); i++) {
            char c = value.charAt(i);
            switch (c) {
                case '&' -> out.append("&amp;");
                case '<' -> out.append("&lt;");
                case '>' -> out.append("&gt;");
                case '"' -> out.append("&quot;");
                case '\'' -> out.append("&#39;");
                default -> out.append(c);
            }
        }
        return out.toString();
    }
}
