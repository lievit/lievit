/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.spring;

import java.util.Locale;

import org.jspecify.annotations.Nullable;

/**
 * Injects lievit's runtime {@code <style>} (before {@code </head>}) and {@code <script>} (before
 * {@code </body>}) into a full-page HTML document so a host app gets the client runtime with zero
 * manual tags (issue #121, ADR-0039; Livewire's {@code SupportAutoInjectedAssets}). It is the
 * deterministic string surgery only: the decision of <em>whether</em> a lievit component rendered on
 * the page (so non-lievit pages stay clean) is the caller's (the {@link LievitPageRenderer} only
 * ever produces a page from a mounted component, so injection there is unconditional; a future MVC
 * response filter would gate on the presence of a {@code data-lievit-component} marker).
 *
 * <p>The injector is robust to malformed / oddly-cased markup (issue #121 AC): it matches the
 * closing tags case-insensitively, injects before the <em>last</em> {@code </body>} and the
 * <em>first</em> {@code </head>}, and if a closing tag is absent it appends the asset at the end (a
 * fragment without a {@code </body>} still ships the runtime rather than silently dropping it). It
 * never double-injects: a document that already carries the runtime script {@code src} is left
 * untouched, so an explicit include plus the auto-inject fallback cannot load the runtime twice.
 *
 * <p>Under the repo's strict CSP the injected {@code <script>} carries a {@code nonce} when one is
 * supplied (no inline script, no inline handlers; ADR-0019 / repo CLAUDE.md): the runtime is an
 * external module referenced by {@code src}, the nonce authorises that external load on a
 * nonce-based policy. The {@code data-csrf} / {@code data-update-uri} attributes are the bootstrap
 * contract the client runtime reads (see {@code runtime/wire.ts}); how the bundle itself is built,
 * served, and versioned is the asset-pipeline concern tracked separately (issue #171).
 */
public final class LievitAssetInjector {

    private final String scriptSrc;
    private final @Nullable String styleHref;
    private final String updateUri;

    /**
     * @param scriptSrc the runtime bundle URL (the {@code src} of the injected script); the
     *     ship-once marker is keyed on it
     * @param styleHref the runtime stylesheet URL, or {@code null} to inject no stylesheet (zero-CSS
     *     default, ADR-0005)
     * @param updateUri the wire-update endpoint the runtime POSTs to (the {@code data-update-uri})
     */
    public LievitAssetInjector(String scriptSrc, @Nullable String styleHref, String updateUri) {
        if (scriptSrc == null || scriptSrc.isBlank()) {
            throw new IllegalArgumentException("the runtime script src must be non-blank");
        }
        if (updateUri == null || updateUri.isBlank()) {
            throw new IllegalArgumentException("the update-uri must be non-blank");
        }
        this.scriptSrc = scriptSrc;
        this.styleHref = (styleHref == null || styleHref.isBlank()) ? null : styleHref;
        this.updateUri = updateUri;
    }

    /**
     * Injects the runtime assets into a full-page HTML document.
     *
     * @param html the rendered full-page HTML
     * @param csrfToken the CSRF token to stamp as {@code data-csrf}, or {@code null} if the app runs
     *     without CSRF
     * @param nonce the CSP nonce to stamp on the injected {@code <script>} (and {@code <link>}), or
     *     {@code null} when the page uses no nonce-based CSP
     * @return the HTML with the style injected before {@code </head>} and the script before
     *     {@code </body>}; unchanged if the runtime script is already present
     */
    public String inject(String html, @Nullable String csrfToken, @Nullable String nonce) {
        if (alreadyInjected(html)) {
            return html;
        }
        String withStyle = styleHref == null ? html : injectBeforeHead(html, styleTag(nonce));
        return injectBeforeBody(withStyle, scriptTag(csrfToken, nonce));
    }

    /** @return true if the document already references the runtime script (avoids a double-load) */
    private boolean alreadyInjected(String html) {
        return html.contains(scriptSrc);
    }

    private String injectBeforeHead(String html, String fragment) {
        int at = indexOfIgnoreCase(html, "</head>", 0);
        if (at < 0) {
            // No head: prepend the style so it still loads (a head-less fragment is still styled).
            return fragment + html;
        }
        return html.substring(0, at) + fragment + html.substring(at);
    }

    private String injectBeforeBody(String html, String fragment) {
        int at = lastIndexOfIgnoreCase(html, "</body>");
        if (at < 0) {
            // No body close: append the script so the runtime still boots on a bare fragment.
            return html + fragment;
        }
        return html.substring(0, at) + fragment + html.substring(at);
    }

    private String scriptTag(@Nullable String csrfToken, @Nullable String nonce) {
        StringBuilder tag = new StringBuilder("<script src=\"").append(escapeAttr(scriptSrc)).append('"');
        tag.append(" type=\"module\" defer");
        tag.append(" data-update-uri=\"").append(escapeAttr(updateUri)).append('"');
        if (csrfToken != null && !csrfToken.isBlank()) {
            tag.append(" data-csrf=\"").append(escapeAttr(csrfToken)).append('"');
        }
        if (nonce != null && !nonce.isBlank()) {
            tag.append(" nonce=\"").append(escapeAttr(nonce)).append('"');
        }
        tag.append("></script>");
        return tag.toString();
    }

    private String styleTag(@Nullable String nonce) {
        StringBuilder tag = new StringBuilder("<link rel=\"stylesheet\" href=\"")
                .append(escapeAttr(styleHref))
                .append('"');
        if (nonce != null && !nonce.isBlank()) {
            tag.append(" nonce=\"").append(escapeAttr(nonce)).append('"');
        }
        tag.append('>');
        return tag.toString();
    }

    private static int indexOfIgnoreCase(String haystack, String needle, int from) {
        return haystack.toLowerCase(Locale.ROOT).indexOf(needle.toLowerCase(Locale.ROOT), from);
    }

    private static int lastIndexOfIgnoreCase(String haystack, String needle) {
        return haystack.toLowerCase(Locale.ROOT).lastIndexOf(needle.toLowerCase(Locale.ROOT));
    }

    private static String escapeAttr(@Nullable String value) {
        if (value == null) {
            return "";
        }
        return value.replace("&", "&amp;").replace("\"", "&quot;").replace("<", "&lt;");
    }
}
