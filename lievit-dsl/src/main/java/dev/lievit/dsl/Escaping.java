/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.dsl;

import java.util.Locale;
import java.util.Set;

import org.owasp.encoder.Encode;

/**
 * Context-aware HTML output encoding, the security primitive of the DSL (ADR-0018, ADR-0084). It is
 * applied to every {@link TextNode} body and every attribute value at render time, so a {@code
 * @Wire} value carrying markup (or a quote-breakout / URL-scheme payload) is rendered inert without
 * any author effort.
 *
 * <p>Encoding is delegated to the <a href="https://owasp.org/www-project-java-encoder/">OWASP Java
 * Encoder</a> (BSD), the canonical context-aware encoder, rather than a hand-rolled escaper:
 *
 * <ul>
 *   <li>{@link #text(String)} → {@code Encode.forHtmlContent}: element-content position.
 *   <li>{@link #attribute(String)} → {@code Encode.forHtmlAttribute}: a quoted attribute value (so
 *       it can never break out of its double quotes).
 *   <li>{@link #urlAttribute(String)} → scheme allowlist + {@code Encode.forHtmlAttribute}: the
 *       value of a URL-bearing attribute (see {@link #isUrlAttribute(String)}).
 * </ul>
 *
 * <p><strong>Why a separate URL path (the ADR-0084 fix).</strong> Encoding alone does not stop a
 * dangerous <em>scheme</em>: {@code javascript:alert(1)} and {@code data:text/html,...} carry no
 * {@code < > & " '} to escape, so an ordinary attribute encoder lets them through intact and they
 * execute on click in {@code href} / {@code src} / {@code formaction} / {@code xlink:href} / ... .
 * OWASP's own guidance for a complete, pre-assembled URL is to <em>validate the URL</em> (scheme
 * allowlist) and then HTML-attribute-encode; {@code forUriComponent} is for a single URI component
 * (it would corrupt a legal full URL such as {@code https://x} or {@code /path}). So
 * {@link #urlAttribute(String)} validates the scheme first, then attribute-encodes.
 *
 * <p>CSP-safety is structural, not an encoding concern: the DSL has no API to emit an inline {@code
 * <script>} or an {@code on*} handler (see {@link H}).
 */
final class Escaping {

    private Escaping() {}

    /**
     * The URL-bearing attribute names that carry a navigable / fetchable URL whose scheme must be
     * vetted. Lower-cased; matching is case-insensitive (see {@link #isUrlAttribute(String)}). Kept
     * deliberately narrow: only attributes whose value the browser dereferences as a URL.
     */
    private static final Set<String> URL_ATTRIBUTES =
            Set.of(
                    "href",
                    "src",
                    "srcset",
                    "formaction",
                    "action",
                    "xlink:href",
                    "poster",
                    "background",
                    "cite",
                    "longdesc",
                    "manifest",
                    "data",
                    "ping",
                    "icon");

    /**
     * Schemes permitted in a URL-bearing attribute. Everything else (notably {@code javascript:},
     * {@code data:}, {@code vbscript:}) is rejected. Lower-cased; the scheme is compared
     * case-insensitively after control/whitespace characters are stripped.
     */
    private static final Set<String> ALLOWED_SCHEMES = Set.of("http", "https", "mailto", "tel");

    /** A URL whose scheme failed the allowlist is replaced with this inert value. */
    private static final String BLOCKED_URL = "about:blank#blocked";

    /** True if {@code name} is a URL-bearing attribute (case-insensitive). */
    static boolean isUrlAttribute(String name) {
        return URL_ATTRIBUTES.contains(name.toLowerCase(Locale.ROOT));
    }

    /** Encodes a string for HTML <em>element-content</em> position. */
    static String text(String value) {
        return Encode.forHtmlContent(value);
    }

    /** Encodes a string for an HTML <em>quoted attribute value</em> position. */
    static String attribute(String value) {
        return Encode.forHtmlAttribute(value);
    }

    /**
     * Encodes the value of a URL-bearing attribute: the scheme is validated against {@link
     * #ALLOWED_SCHEMES} (rejecting {@code javascript:} / {@code data:} / {@code vbscript:} / any
     * unknown scheme), then the surviving URL is HTML-attribute-encoded so it cannot break out of
     * its quotes. A rejected URL becomes {@link #BLOCKED_URL}.
     */
    static String urlAttribute(String value) {
        return Encode.forHtmlAttribute(sanitizeUrl(value));
    }

    /**
     * Returns {@code value} unchanged if its scheme is allowed (or it is a scheme-relative /
     * relative / anchor / query / absolute-path URL), otherwise {@link #BLOCKED_URL}.
     *
     * <p>Scheme detection mirrors what a browser does, defeating the classic evasions: leading and
     * embedded control / whitespace characters (space, tab, newline, NUL, ...) that browsers strip
     * before resolving the scheme are removed first, so {@code " javascript:"}, {@code
     * "java\tscript:"} and {@code "java\0script:"} are all caught; the scheme test is
     * case-insensitive, so {@code JaVaScRiPt:} is caught too.
     */
    private static String sanitizeUrl(String value) {
        if (value == null || value.isEmpty()) {
            return "";
        }

        // Strip the characters a browser ignores when parsing the scheme: ASCII control chars
        // (incl. NUL, tab, CR, LF) and leading/trailing spaces. This is what lets
        // " javascript:" / "java\tscript:" / "java\0script:" be detected as the javascript scheme.
        StringBuilder canon = new StringBuilder(value.length());
        for (int i = 0; i < value.length(); i++) {
            char c = value.charAt(i);
            if (c > ' ' && c != 0x7F) {
                canon.append(c);
            }
        }
        String stripped = canon.toString();
        if (stripped.isEmpty()) {
            return "";
        }

        int colon = stripped.indexOf(':');
        int slash = stripped.indexOf('/');
        int hash = stripped.indexOf('#');
        int question = stripped.indexOf('?');

        // No colon before the first /, #, ? means there is no URL scheme: it is a relative,
        // absolute-path, scheme-relative, anchor or query URL. These are always safe.
        boolean colonIsScheme =
                colon >= 0
                        && (slash < 0 || colon < slash)
                        && (hash < 0 || colon < hash)
                        && (question < 0 || colon < question);
        if (!colonIsScheme) {
            return value;
        }

        String scheme = stripped.substring(0, colon).toLowerCase(Locale.ROOT);
        if (ALLOWED_SCHEMES.contains(scheme)) {
            return value;
        }

        // Disallowed or hostile scheme (javascript:, data:, vbscript:, file:, ...).
        // A dev-visible signal: the framework refuses to emit the URL.
        System.getLogger(Escaping.class.getName())
                .log(
                        System.Logger.Level.WARNING,
                        "blocked a URL-bearing attribute with disallowed scheme \"{0}:\" (value"
                                + " replaced with {1}); only {2} and relative/anchor/path URLs are"
                                + " allowed",
                        scheme,
                        BLOCKED_URL,
                        ALLOWED_SCHEMES);
        return BLOCKED_URL;
    }
}
