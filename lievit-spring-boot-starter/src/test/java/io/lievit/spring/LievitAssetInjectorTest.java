/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.spring;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

/**
 * Unit-level pin of the auto-injected-assets string surgery (issue #121, ADR-0037): the
 * {@link LievitAssetInjector} injects the runtime script before {@code </body>} and the style before
 * {@code </head>}, is robust to malformed / oddly-cased markup, is idempotent (never double-loads),
 * and stamps the CSRF token + CSP nonce onto the injected tags. Pure logic, no Spring context.
 */
class LievitAssetInjectorTest {

    private final LievitAssetInjector injector =
            new LievitAssetInjector("/lievit/lievit.js", "/lievit/lievit.css", "/lievit/update");

    /**
     * @spec.given a well-formed HTML document and the runtime injector
     * @spec.when  the assets are injected with no csrf and no nonce
     * @spec.then  the stylesheet lands before {@code </head>}, the script before {@code </body>} with
     *     the {@code data-update-uri} bootstrap attribute, and the original body markup is preserved
     * @spec.adr   ADR-0037
     * @spec.us    US-121-auto-inject-assets
     */
    @Test
    void injects_style_before_head_and_script_before_body() {
        String html = "<!doctype html><html><head><title>x</title></head><body><p>hi</p></body></html>";

        String out = injector.inject(html, null, null);

        assertThat(out).contains("<link rel=\"stylesheet\" href=\"/lievit/lievit.css\"></head>");
        assertThat(out).contains("data-update-uri=\"/lievit/update\"></script></body>");
        assertThat(out).contains("<p>hi</p>");
        assertThat(out.indexOf("/lievit/lievit.css")).isLessThan(out.indexOf("</head>"));
        assertThat(out.indexOf("/lievit/lievit.js")).isLessThan(out.indexOf("</body>"));
    }

    /**
     * @spec.given an HTML document already referencing the runtime script
     * @spec.when  the injector runs again over it
     * @spec.then  it is left byte-for-byte unchanged: an explicit include plus the fallback cannot
     *     load the runtime twice
     * @spec.adr   ADR-0037
     */
    @Test
    void is_idempotent_when_the_runtime_is_already_present() {
        String html = "<html><head></head><body><script src=\"/lievit/lievit.js\"></script></body></html>";

        assertThat(injector.inject(html, null, null)).isEqualTo(html);
    }

    /**
     * @spec.given an oddly-cased, malformed document (uppercase tags, missing head close)
     * @spec.when  the assets are injected
     * @spec.then  the script still lands before the uppercase {@code </BODY>} (case-insensitive
     *     match) and the style is prepended when no {@code </head>} exists, so a malformed page still
     *     ships the runtime rather than silently dropping it
     * @spec.adr   ADR-0037
     */
    @Test
    void handles_malformed_and_oddly_cased_html() {
        String html = "<HTML><BODY>content</BODY></HTML>";

        String out = injector.inject(html, null, null);

        assertThat(out).contains("/lievit/lievit.js");
        assertThat(out.toLowerCase(java.util.Locale.ROOT).indexOf("/lievit/lievit.js"))
                .isLessThan(out.toLowerCase(java.util.Locale.ROOT).indexOf("</body>"));
        // No </head>: the style is prepended so it still loads.
        assertThat(out).startsWith("<link rel=\"stylesheet\"");
    }

    /**
     * @spec.given a strict-CSP page (a nonce) and a CSRF-protected app (a token)
     * @spec.when  the assets are injected with both
     * @spec.then  the injected script carries the nonce (authorising the external module load on a
     *     nonce policy) and the {@code data-csrf} the client runtime reads, with attribute values
     *     escaped
     * @spec.adr   ADR-0037
     * @spec.us    US-121-auto-inject-assets
     */
    @Test
    void stamps_the_csp_nonce_and_csrf_token() {
        String html = "<html><head></head><body></body></html>";

        String out = injector.inject(html, "tok\"en", "n0nce");

        assertThat(out).contains("nonce=\"n0nce\"");
        assertThat(out).contains("data-csrf=\"tok&quot;en\"");
    }

    /**
     * @spec.given an injector configured with no stylesheet (the zero-CSS default, ADR-0005)
     * @spec.when  the assets are injected
     * @spec.then  no {@code <link>} is emitted; only the runtime script is injected
     * @spec.adr   ADR-0037
     */
    @Test
    void emits_no_stylesheet_when_none_is_configured() {
        LievitAssetInjector noStyle =
                new LievitAssetInjector("/lievit/lievit.js", "", "/lievit/update");

        String out = noStyle.inject("<html><head></head><body></body></html>", null, null);

        assertThat(out).doesNotContain("<link");
        assertThat(out).contains("/lievit/lievit.js");
    }

    /**
     * @spec.given construction arguments
     * @spec.when  a blank script src or a blank update-uri is passed
     * @spec.then  the constructor rejects it (the injector cannot ship a runtime with no source or
     *     no wire endpoint)
     * @spec.adr   ADR-0037
     */
    @Test
    void rejects_a_blank_script_src_or_update_uri() {
        assertThatThrownBy(() -> new LievitAssetInjector("  ", "", "/lievit/update"))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new LievitAssetInjector("/lievit/lievit.js", "", " "))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
