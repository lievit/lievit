/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.compiler.convert;

import java.util.Map;

/**
 * Renders a neutral {@link ViewNode} tree back to a single-file DSL render expression (the
 * {@code dev.lievit.dsl.H} builder, ADR-0018), the backward half of the MFC-&gt;SFC convert (issue
 * #141, ADR-0070). It is the exact inverse of {@link DslViewParser}: an {@link ViewNode.Element}
 * renders as its factory call ({@code div(...)} for a known tag, {@code el("tag", ...)} otherwise), a
 * {@link ViewNode.Literal} as {@code text("...")}, an {@link ViewNode.Expression} as
 * {@code text(expr)}, a {@link ViewNode.Raw} as {@code raw("...")}, and each {@link ViewAttribute} as
 * the fluent {@code wireClick}/{@code wireModel}/... helper when one exists, else {@code .attr(...)}.
 *
 * <p>The output is a compact, deterministic expression (round-trip stable with the parser). Pure
 * Java, zero Spring.
 */
public final class DslViewWriter {

    // Tags with a dedicated H.* factory (so we emit div(...) not el("div", ...)).
    private static final java.util.Set<String> NAMED_FACTORIES =
            java.util.Set.of(
                    "div", "span", "p", "button", "a", "ul", "ol", "li", "form", "label", "h1",
                    "h2", "h3", "section", "strong", "input", "br", "img", "hr");

    // The inverse of the parser's WIRE_HELPERS: l:* directive -> fluent helper method.
    private static final Map<String, String> DIRECTIVE_HELPERS =
            Map.of(
                    "l:click", "wireClick",
                    "l:submit", "wireSubmit",
                    "l:keydown.enter", "wireKeydownEnter",
                    "l:model", "wireModel",
                    "l:model.live", "wireModelLive");

    /**
     * Renders a view node to a DSL builder expression.
     *
     * @param node the neutral view node
     * @return the {@code H.*} builder expression (no {@code return}/{@code ;})
     */
    public String write(ViewNode node) {
        StringBuilder out = new StringBuilder();
        writeNode(node, out);
        return out.toString();
    }

    private void writeNode(ViewNode node, StringBuilder out) {
        switch (node) {
            case ViewNode.Literal literal -> out.append("text(\"").append(escapeJava(literal.value())).append("\")");
            case ViewNode.Expression expression -> out.append("text(").append(expression.expression()).append(')');
            case ViewNode.Raw raw -> out.append("raw(\"").append(escapeJava(raw.markup())).append("\")");
            case ViewNode.Element element -> writeElement(element, out);
        }
    }

    private void writeElement(ViewNode.Element element, StringBuilder out) {
        boolean named = NAMED_FACTORIES.contains(element.tag());
        out.append(named ? element.tag() : "el");
        out.append('(');
        boolean first = true;
        if (!named) {
            out.append('"').append(escapeJava(element.tag())).append('"');
            first = false;
        }
        for (ViewNode child : element.children()) {
            if (!first) {
                out.append(", ");
            }
            writeNode(child, out);
            first = false;
        }
        out.append(')');
        // fluent attribute chain
        for (ViewAttribute attr : element.attributes()) {
            writeAttribute(attr, out);
        }
    }

    private void writeAttribute(ViewAttribute attr, StringBuilder out) {
        String helper = !attr.dynamic() && attr.value().isPresent() ? DIRECTIVE_HELPERS.get(attr.name()) : null;
        if (helper != null) {
            out.append('.').append(helper).append("(\"").append(escapeJava(attr.value().orElseThrow())).append("\")");
            return;
        }
        if (attr.value().isEmpty()) {
            out.append(".attr(\"").append(escapeJava(attr.name())).append("\")");
        } else if (attr.dynamic()) {
            out.append(".attr(\"").append(escapeJava(attr.name())).append("\", ").append(attr.value().orElseThrow()).append(')');
        } else {
            out.append(".attr(\"").append(escapeJava(attr.name())).append("\", \"").append(escapeJava(attr.value().orElseThrow())).append("\")");
        }
    }

    /** Escapes a string for a Java double-quoted literal. */
    static String escapeJava(String s) {
        StringBuilder b = new StringBuilder(s.length());
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            switch (c) {
                case '\\' -> b.append("\\\\");
                case '"' -> b.append("\\\"");
                case '\n' -> b.append("\\n");
                case '\t' -> b.append("\\t");
                case '\r' -> b.append("\\r");
                default -> b.append(c);
            }
        }
        return b.toString();
    }
}
