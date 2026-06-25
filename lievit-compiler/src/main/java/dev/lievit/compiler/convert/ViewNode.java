/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.compiler.convert;

import java.util.List;

/**
 * The engine-neutral view AST that bridges the two authoring shapes for the SFC&lt;-&gt;MFC convert
 * (issue #141, ADR-0070/0071). It is the single intermediate representation both the single-file DSL
 * (the {@code dev.lievit.dsl.H} builder, ADR-0018) and the multi-file JTE template are parsed into and
 * written out of, so a convert is always {@code parse(source) -> ViewNode -> write(otherShape)} and a
 * round-trip is stable by construction (the AST is the fixed point).
 *
 * <p>A node is one of four shapes (sealed, the analogue of the DSL's {@code Html} permits):
 *
 * <ul>
 *   <li>{@link Element} — a tag with ordered {@link ViewAttribute}s and ordered children;
 *   <li>{@link Literal} — escaped literal text (a DSL {@code text("...")} / a JTE text run);
 *   <li>{@link Expression} — an escaped dynamic value (a DSL {@code text(field)} / a JTE
 *       {@code ${expr}}), carrying the raw expression source;
 *   <li>{@link Raw} — pre-trusted markup, the one escape hatch (a DSL {@code raw("...")} / a JTE
 *       {@code $unsafe{...}}).
 * </ul>
 *
 * <p>Pure data, zero Spring, zero reflection: it is parsed from source text and serialized back to
 * source text, never executed.
 */
public sealed interface ViewNode permits ViewNode.Element, ViewNode.Literal, ViewNode.Expression, ViewNode.Raw {

    /**
     * An element: a tag, its attributes (in author order), and its children (in author order).
     *
     * @param tag the tag name
     * @param attributes the attributes, in order
     * @param children the child nodes, in order
     */
    record Element(String tag, List<ViewAttribute> attributes, List<ViewNode> children)
            implements ViewNode {
        public Element {
            attributes = List.copyOf(attributes);
            children = List.copyOf(children);
        }
    }

    /**
     * Escaped literal text content.
     *
     * @param value the literal text (un-escaped; the writer escapes per target)
     */
    record Literal(String value) implements ViewNode {}

    /**
     * An escaped dynamic value: a DSL {@code text(expr)} where {@code expr} is not a string literal,
     * or a JTE {@code ${expr}}. The expression source is carried verbatim so the convert is faithful.
     *
     * @param expression the raw expression source (e.g. {@code count}, {@code user.name()})
     */
    record Expression(String expression) implements ViewNode {}

    /**
     * Pre-trusted, unescaped markup: the DSL {@code H.raw(...)} / the JTE {@code $unsafe{...}} escape
     * hatch.
     *
     * @param markup the trusted markup
     */
    record Raw(String markup) implements ViewNode {}
}
