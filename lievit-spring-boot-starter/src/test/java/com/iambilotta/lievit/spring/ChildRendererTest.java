/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package com.iambilotta.lievit.spring;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

/**
 * Specifies the child-root marker injection (ADR-0015): the snapshot, key, and id markers the client
 * morph needs are stamped onto a child's root element, on both a normal and a self-closing tag, and
 * the value is HTML-escaped. The substitution logic itself is exercised end-to-end in
 * {@code NestedComponentsIT}; this pins the string surgery in isolation.
 */
class ChildRendererTest {

    /**
     * @spec.given a child's rendered HTML whose root is a normal {@code <div>} element
     * @spec.when  the client-glue markers are injected
     * @spec.then  data-lievit-id, lievit:key, and data-lievit-snapshot are stamped on the root tag,
     *     before its closing angle bracket, leaving the inner HTML untouched
     * @spec.adr   ADR-0015
     */
    @Test
    void injects_markers_onto_a_normal_root_tag() {
        String html = "<div class=\"row\"><span>hi</span></div>";

        String marked = ChildRenderer.injectMarkers(html, "row-7", "CID123", "snap.shot.sig");

        assertThat(marked)
                .contains("lievit:key=\"row-7\"")
                .contains("data-lievit-id=\"CID123\"")
                .contains("data-lievit-snapshot=\"snap.shot.sig\"")
                .contains("<span>hi</span></div>");
        // The markers land inside the root tag, before its '>'.
        assertThat(marked.indexOf("lievit:key")).isLessThan(marked.indexOf("<span>"));
    }

    /**
     * @spec.given a child whose root element is self-closing ({@code <input ... />})
     * @spec.when  the markers are injected
     * @spec.then  they are placed before the {@code />}, so the tag stays well-formed
     * @spec.adr   ADR-0015
     */
    @Test
    void injects_markers_before_a_self_closing_tag() {
        String html = "<input value=\"x\"/>";

        String marked = ChildRenderer.injectMarkers(html, "k", "CID", "sig");

        assertThat(marked).endsWith("/>");
        assertThat(marked).contains("lievit:key=\"k\"");
        assertThat(marked.indexOf("lievit:key")).isLessThan(marked.indexOf("/>"));
    }

    /**
     * @spec.given a snapshot value containing characters that must not break the attribute
     * @spec.when  the markers are injected
     * @spec.then  the value is HTML-escaped so it cannot break out of the attribute (XSS-safe)
     * @spec.adr   ADR-0015
     */
    @Test
    void escapes_the_marker_values() {
        String html = "<div></div>";

        String marked = ChildRenderer.injectMarkers(html, "k\"<x", "CID", "a&b");

        assertThat(marked).contains("&quot;").contains("&lt;").contains("a&amp;b");
        assertThat(marked).doesNotContain("k\"<x");
    }
}
