/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package com.iambilotta.lievit.dsl;

/**
 * A node in lievit's type-safe HTML tree, the single-file authoring surface (ADR-0003, ADR-0018).
 *
 * <p>An {@code Html} value is an immutable, compile-time-checked description of markup: an {@link
 * Element} (a tag with attributes and children), a {@link TextNode} (escaped text content), a {@link
 * RawNode} (pre-trusted markup, the one escape hatch), or a {@link Fragment} (a group of siblings
 * with no wrapping element). It is built with the static factories on {@link H} ({@code div(...)},
 * {@code text(...)}, {@code button(...).attr("l:click", "increment")}) and serialized to a string by
 * {@link #render()}.
 *
 * <p>The security property is <strong>escape-by-construction</strong> (ADR-0018): every {@link
 * TextNode} and every attribute value is HTML-escaped when rendered, so a {@code @Wire String} that
 * carries {@code <script>} becomes inert {@code &lt;script&gt;} text with no author effort. The only
 * way to emit literal markup is {@link H#raw(String)}, which is explicit and audit-visible. There is
 * no string-template path, so the type-safety hole single-file mode exists to avoid (an unchecked
 * text block, ADR-0003) is unreachable.
 *
 * <p>Pure Java, zero Spring, zero runtime reflection (ADR-0006): a tree renders by walking itself and
 * appending to a {@link StringBuilder}.
 */
public sealed interface Html permits Element, TextNode, RawNode, Fragment {

    /**
     * Renders this node (and its subtree) to an HTML string, escaping all text and attribute values
     * by construction.
     *
     * @return the rendered HTML fragment
     */
    default String render() {
        StringBuilder out = new StringBuilder();
        renderTo(out);
        return out.toString();
    }

    /**
     * Appends this node's rendered HTML to {@code out}. The escape-by-construction contract is
     * enforced here, in the concrete node types, never by the caller.
     *
     * @param out the buffer to append to
     */
    void renderTo(StringBuilder out);
}
