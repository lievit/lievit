/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit.support;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

/**
 * Specifies {@link Markdown}: the safe-subset CommonMark-style renderer used for helper text,
 * placeholders, and infolist text. It renders a curated inline + block subset to sanitized HTML and,
 * critically, never emits author-or-user HTML verbatim, so no {@code <script>} can ride through (the
 * CSP refuses inline script anyway; this keeps the source from ever producing one).
 */
class MarkdownTest {

    /**
     * @spec.given markdown with bold, italic, and inline code
     * @spec.when  it is rendered
     * @spec.then  the inline spans become their HTML tags inside a paragraph
     */
    @Test
    void renders_inline_emphasis_and_code() {
        String html = Markdown.toHtml("a **bold** and *italic* and `code`");

        assertThat(html)
                .isEqualTo("<p>a <strong>bold</strong> and <em>italic</em> and <code>code</code></p>");
    }

    /**
     * @spec.given markdown with a heading and a list
     * @spec.when  it is rendered
     * @spec.then  the block structure becomes heading + unordered list HTML
     */
    @Test
    void renders_headings_and_lists() {
        String html = Markdown.toHtml("# Title\n\n- one\n- two");

        assertThat(html).contains("<h1>Title</h1>");
        assertThat(html).contains("<ul><li>one</li><li>two</li></ul>");
    }

    /**
     * @spec.given markdown containing an inline link
     * @spec.when  it is rendered
     * @spec.then  it becomes an anchor with an escaped href
     */
    @Test
    void renders_links() {
        String html = Markdown.toHtml("see [docs](https://lievit.io/guide)");

        assertThat(html).contains("<a href=\"https://lievit.io/guide\">docs</a>");
    }

    /**
     * @spec.given markdown that embeds a raw script tag (a hostile or pasted fragment)
     * @spec.when  it is rendered
     * @spec.then  the angle brackets are escaped, so no executable {@code <script>} survives
     */
    @Test
    void never_emits_a_script_tag() {
        String html = Markdown.toHtml("hi <script>alert(1)</script> there");

        assertThat(html).doesNotContain("<script>");
        assertThat(html).contains("&lt;script&gt;");
    }

    /**
     * @spec.given markdown with an angle bracket and ampersand in plain text
     * @spec.when  it is rendered
     * @spec.then  the dangerous characters are HTML-escaped in the output
     */
    @Test
    void escapes_html_special_characters_in_text() {
        String html = Markdown.toHtml("1 < 2 & 3 > 0");

        assertThat(html).isEqualTo("<p>1 &lt; 2 &amp; 3 &gt; 0</p>");
    }
}
