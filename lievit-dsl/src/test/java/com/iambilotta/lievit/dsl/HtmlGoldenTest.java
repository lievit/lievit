/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package com.iambilotta.lievit.dsl;

import static com.iambilotta.lievit.dsl.H.button;
import static com.iambilotta.lievit.dsl.H.div;
import static com.iambilotta.lievit.dsl.H.input;
import static com.iambilotta.lievit.dsl.H.raw;
import static com.iambilotta.lievit.dsl.H.span;
import static com.iambilotta.lievit.dsl.H.text;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

/**
 * Golden serialization of the type-safe HTML builder (ADR-0018): the same counter tree the README
 * sketches renders to exact HTML, text and attributes escape by construction, wire bindings emit the
 * {@code l:*} markers the client binds, and the one escape hatch ({@code raw}) is the only unescaped
 * path. These are the load-bearing FR/NFR for single-file mode.
 */
class HtmlGoldenTest {

    /**
     * @spec.given the README counter tree built with the DSL factories and wire-binding helpers
     * @spec.when  it is rendered to HTML
     * @spec.then  it is the exact expected markup, carrying the l:click directives the client binds
     * @spec.adr   ADR-0018
     */
    @Test
    void renders_the_counter_tree_to_exact_html_with_wire_bindings() {
        Html tree =
                div(
                        button(text("-")).wireClick("decrement"),
                        span(text(3)).attr("data-lievit-count", ""),
                        button(text("+")).wireClick("increment"));

        assertThat(tree.render())
                .isEqualTo(
                        "<div>"
                                + "<button l:click=\"decrement\">-</button>"
                                + "<span data-lievit-count=\"\">3</span>"
                                + "<button l:click=\"increment\">+</button>"
                                + "</div>");
    }

    /**
     * @spec.given a @Wire value carrying a script tag, placed in element text via text(...)
     * @spec.when  the tree is rendered
     * @spec.then  the markup is escaped to inert text: escape-by-construction, no XSS (NFR)
     * @spec.adr   ADR-0018
     */
    @Test
    void escapes_text_content_by_construction() {
        Html tree = span(text("<script>alert('x')</script>"));

        // Text position escapes the structural chars (& < >); quotes are inert in element content,
        // so they are deliberately not escaped here (they are escaped in attribute position).
        assertThat(tree.render())
                .isEqualTo("<span>&lt;script&gt;alert('x')&lt;/script&gt;</span>")
                .doesNotContain("<script>");
    }

    /**
     * @spec.given an attacker-controlled attribute value that tries to break out of its quotes
     * @spec.when  it is set with attr(name, value) and rendered
     * @spec.then  the quotes and angle brackets are escaped, so it cannot inject a second attribute
     * @spec.adr   ADR-0018
     */
    @Test
    void escapes_attribute_values_so_they_cannot_break_out() {
        Html tree = input().attr("value", "\"><img src=x onerror=alert(1)>");

        assertThat(tree.render())
                .isEqualTo(
                        "<input value=\"&quot;&gt;&lt;img src=x onerror=alert(1)&gt;\">")
                .doesNotContain("<img");
    }

    /**
     * @spec.given a malformed attribute name that tries to inject a handler
     * @spec.when  attr(...) is called with it
     * @spec.then  construction is rejected, so a bad name can never reach the output
     * @spec.adr   ADR-0018
     */
    @Test
    void rejects_a_malformed_attribute_name() {
        assertThatThrownBy(() -> div().attr("onclick=alert(1) x", "y"))
                .isInstanceOf(IllegalArgumentException.class);
    }

    /**
     * @spec.given pre-trusted server markup passed to the explicit raw escape hatch
     * @spec.when  the tree is rendered
     * @spec.then  it is emitted verbatim: raw is the single, audit-visible unescaped path
     * @spec.adr   ADR-0018
     */
    @Test
    void raw_is_the_single_unescaped_escape_hatch() {
        Html tree = div(raw("<em>trusted</em>"));

        assertThat(tree.render()).isEqualTo("<div><em>trusted</em></div>");
    }

    /**
     * @spec.given a void element (input) with an l:model binding
     * @spec.when  it is rendered
     * @spec.then  it self-closes (no close tag) and carries the l:model marker
     * @spec.adr   ADR-0018
     */
    @Test
    void void_element_self_closes_and_carries_wire_model() {
        Html tree = input().attr("type", "text").wireModel("name");

        assertThat(tree.render()).isEqualTo("<input type=\"text\" l:model=\"name\">");
    }

    /**
     * @spec.given an immutable element to which an attribute is added
     * @spec.when  attr(...) is called
     * @spec.then  a new element is returned and the original is unchanged (value semantics)
     * @spec.adr   ADR-0018
     */
    @Test
    void elements_are_immutable_attr_returns_a_copy() {
        Element original = div(text("x"));
        Element decorated = original.attr("id", "a");

        assertThat(original.attributes()).isEmpty();
        assertThat(decorated.attributes()).hasSize(1);
        assertThat(original).isNotSameAs(decorated);
    }
}
