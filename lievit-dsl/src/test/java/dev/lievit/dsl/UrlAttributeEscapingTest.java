/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.dsl;

import static dev.lievit.dsl.H.a;
import static dev.lievit.dsl.H.el;
import static dev.lievit.dsl.H.form;
import static dev.lievit.dsl.H.img;
import static dev.lievit.dsl.H.input;
import static dev.lievit.dsl.H.text;
import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

/**
 * The URL-attribute context of the DSL (ADR-0084): a value bound into a URL-bearing attribute
 * ({@code href}, {@code src}, {@code formaction}, {@code xlink:href}, ...) is run through a scheme
 * allowlist on top of OWASP attribute encoding, so a {@code javascript:} / {@code data:} /
 * {@code vbscript:} payload (which carries no {@code < > & " '} to escape) cannot survive and
 * execute on click. Legal URLs (absolute http(s), relative, anchor, query, mailto, tel) pass
 * unchanged. This is the load-bearing XSS-fix NFR for single-file mode.
 */
class UrlAttributeEscapingTest {

    /**
     * @spec.given a javascript: scheme bound into an href
     * @spec.when  the anchor is rendered
     * @spec.then  the javascript: URL is blocked (replaced with about:blank#blocked), so the click
     *             cannot execute script: the URL-attribute XSS gap is closed (NFR)
     * @spec.adr   ADR-0084
     */
    @Test
    void blocks_javascript_scheme_in_href() {
        Html tree = a(text("click")).attr("href", "javascript:alert(1)");

        assertThat(tree.render())
                .isEqualTo("<a href=\"about:blank#blocked\">click</a>")
                .doesNotContain("javascript:");
    }

    /**
     * @spec.given a data:text/html payload bound into an href
     * @spec.when  the anchor is rendered
     * @spec.then  the data: URL is blocked: a data: document cannot be navigated to from a bound URL
     * @spec.adr   ADR-0084
     */
    @Test
    void blocks_data_scheme_in_href() {
        Html tree =
                a(text("x")).attr("href", "data:text/html,<script>alert(1)</script>");

        assertThat(tree.render())
                .isEqualTo("<a href=\"about:blank#blocked\">x</a>")
                .doesNotContain("data:")
                .doesNotContain("<script>");
    }

    /**
     * @spec.given a vbscript: scheme bound into an href
     * @spec.when  the anchor is rendered
     * @spec.then  the vbscript: URL is blocked
     * @spec.adr   ADR-0084
     */
    @Test
    void blocks_vbscript_scheme_in_href() {
        Html tree = a(text("x")).attr("href", "vbscript:msgbox(1)");

        assertThat(tree.render()).doesNotContain("vbscript:");
    }

    /**
     * @spec.given javascript: variants that browsers normalize before resolving the scheme: a
     *             leading space, an embedded tab, an embedded newline, an embedded NUL, mixed case
     * @spec.when  each is bound into an href and rendered
     * @spec.then  every variant is detected as the javascript scheme and blocked: the classic
     *             control-character / case evasions do not survive (NFR)
     * @spec.adr   ADR-0084
     */
    @ParameterizedTest
    @ValueSource(
            strings = {
                " javascript:alert(1)",
                "java\tscript:alert(1)",
                "java\nscript:alert(1)",
                "java\rscript:alert(1)",
                "java\0script:alert(1)",
                "JaVaScRiPt:alert(1)",
                "JAVASCRIPT:alert(1)",
                "\t\n javascript:alert(1)"
            })
    void blocks_obfuscated_javascript_scheme(String vector) {
        Html tree = a(text("x")).attr("href", vector);

        assertThat(tree.render().toLowerCase())
                .doesNotContain("javascript")
                .contains("about:blank#blocked");
    }

    /**
     * @spec.given the dangerous-scheme vectors bound into src and formaction (other URL attributes)
     * @spec.when  each is rendered
     * @spec.then  the scheme allowlist applies to every URL-bearing attribute, not just href
     * @spec.adr   ADR-0084
     */
    @Test
    void blocks_dangerous_schemes_in_src_and_formaction() {
        assertThat(img().attr("src", "javascript:alert(1)").render())
                .doesNotContain("javascript:")
                .contains("about:blank#blocked");

        assertThat(form().attr("formaction", "javascript:alert(1)").render())
                .doesNotContain("javascript:")
                .contains("about:blank#blocked");

        assertThat(el("image").attr("xlink:href", "javascript:alert(1)").render())
                .doesNotContain("javascript:")
                .contains("about:blank#blocked");
    }

    /**
     * @spec.given the legal URL forms a real app binds into href: absolute https, root-absolute
     *             path, relative path, anchor, query, mailto, tel
     * @spec.when  each is rendered
     * @spec.then  it passes through unchanged: the allowlist does not break normal linking (FR)
     * @spec.adr   ADR-0084
     */
    @ParameterizedTest
    @ValueSource(
            strings = {
                "https://example.com/page",
                "http://example.com",
                "/path/to/thing",
                "./relative",
                "../up",
                "#anchor",
                "?q=1",
                "mailto:a@b.com",
                "tel:+390123456",
                "//cdn.example.com/x.js",
                "path/segment"
            })
    void legal_urls_pass_unchanged(String url) {
        Html tree = a(text("x")).attr("href", url);

        assertThat(tree.render()).isEqualTo("<a href=\"" + url + "\">x</a>");
    }

    /**
     * @spec.given a legal https URL that also contains a quote-breakout attempt
     * @spec.when  it is bound into href and rendered
     * @spec.then  the scheme is allowed AND the quote is still attribute-encoded: the allowlist does
     *             not skip the OWASP attribute encoding layer (NFR)
     * @spec.adr   ADR-0084
     */
    @Test
    void allowed_scheme_still_gets_attribute_encoded() {
        Html tree = a(text("x")).attr("href", "https://x/\"onmouseover=\"alert(1)");

        assertThat(tree.render()).doesNotContain("\"onmouseover").contains("&#34;");
    }

    /**
     * @spec.given an ordinary (non-URL) attribute carrying a javascript: string
     * @spec.when  it is rendered
     * @spec.then  the scheme allowlist does NOT apply (the value is harmless in a non-URL attribute)
     *             so it is attribute-encoded but otherwise preserved: only URL attributes are vetted
     * @spec.adr   ADR-0084
     */
    @Test
    void ordinary_attribute_is_not_scheme_filtered() {
        Html tree = input().attr("value", "javascript:not-a-url-here");

        assertThat(tree.render())
                .isEqualTo("<input value=\"javascript:not-a-url-here\">");
    }

    /**
     * @spec.given an empty value bound into a URL attribute
     * @spec.when  it is rendered
     * @spec.then  it stays empty (no scheme, nothing to block): the path is null/empty-safe
     * @spec.adr   ADR-0084
     */
    @Test
    void empty_url_value_stays_empty() {
        Html tree = a(text("x")).attr("href", "");

        assertThat(tree.render()).isEqualTo("<a href=\"\">x</a>");
    }
}
