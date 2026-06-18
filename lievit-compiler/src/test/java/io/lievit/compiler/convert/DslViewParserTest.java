/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.compiler.convert;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

/**
 * Spec for parsing the single-file DSL render expression ({@code io.lievit.dsl.H} builder, ADR-0018)
 * into the neutral convert AST (issue #141, ADR-0070), the forward half of the SFC-&gt;MFC convert.
 * It reads the {@code return ...;} expression of an {@code @LievitRender} method: the {@code H.*}
 * factory calls become {@link ViewNode.Element}s, {@code text("...")} a {@link ViewNode.Literal},
 * {@code text(expr)} an {@link ViewNode.Expression}, {@code raw("...")} a {@link ViewNode.Raw}, and
 * the fluent {@code .attr(...)} / {@code .wireClick(...)} chain becomes {@link ViewAttribute}s. A
 * builder call it cannot map faithfully ({@code fragment(...)}, a non-DSL method call) is
 * warn-and-skipped, never guessed.
 */
class DslViewParserTest {

    private final DslViewParser parser = new DslViewParser();

    /**
     * @spec.given the DslCounter render expression: div(button(text("-")).wireClick("decrement"),
     *     span(text(count)), button(text("+")).wireClick("increment"))
     * @spec.when  it is parsed
     * @spec.then  the root div has three children: two wired buttons (l:click via wireClick) and a
     *     span carrying the ${count} expression, with no warnings
     * @spec.adr   ADR-0070
     */
    @Test
    void parses_counter_render_expression() {
        String expr =
                "div("
                        + "button(text(\"-\")).wireClick(\"decrement\"),"
                        + "span(text(count)),"
                        + "button(text(\"+\")).wireClick(\"increment\"))";

        ParsedView parsed = parser.parse(expr);

        assertThat(parsed.isFaithful()).isTrue();
        ViewNode.Element root = (ViewNode.Element) parsed.root().orElseThrow();
        assertThat(root.tag()).isEqualTo("div");
        assertThat(root.children()).hasSize(3);
        ViewNode.Element first = (ViewNode.Element) root.children().get(0);
        assertThat(first.tag()).isEqualTo("button");
        assertThat(first.attributes()).containsExactly(ViewAttribute.literal("l:click", "decrement"));
        assertThat(first.children()).containsExactly(new ViewNode.Literal("-"));
        ViewNode.Element span = (ViewNode.Element) root.children().get(1);
        assertThat(span.tag()).isEqualTo("span");
        assertThat(span.children()).containsExactly(new ViewNode.Expression("count"));
    }

    /**
     * @spec.given a render expression using el("custom"), an attr with a dynamic value, raw(...) and
     *     a wireModel binding
     * @spec.when  it is parsed
     * @spec.then  el maps to its tag, the dynamic attr carries the expression, raw maps to a Raw node,
     *     and wireModel maps to an l:model attribute
     * @spec.adr   ADR-0070
     */
    @Test
    void parses_el_dynamic_attr_raw_and_wire_model() {
        String expr =
                "el(\"section\","
                        + "input().attr(\"value\", count).wireModel(\"name\"),"
                        + "div(raw(\"<b>x</b>\")).attr(\"class\", \"box\"))";

        ParsedView parsed = parser.parse(expr);

        ViewNode.Element root = (ViewNode.Element) parsed.root().orElseThrow();
        assertThat(root.tag()).isEqualTo("section");
        ViewNode.Element input = (ViewNode.Element) root.children().get(0);
        assertThat(input.tag()).isEqualTo("input");
        assertThat(input.attributes())
                .containsExactly(
                        ViewAttribute.dynamic("value", "count"),
                        ViewAttribute.literal("l:model", "name"));
        ViewNode.Element div = (ViewNode.Element) root.children().get(1);
        assertThat(div.children()).containsExactly(new ViewNode.Raw("<b>x</b>"));
        assertThat(div.attributes()).containsExactly(ViewAttribute.literal("class", "box"));
    }

    /**
     * @spec.given a render expression wrapping the root in fragment(...) (no single DSL root element)
     * @spec.when  it is parsed
     * @spec.then  fragment is warn-and-skipped (a warning is recorded) rather than guessing a root
     * @spec.adr   ADR-0070
     */
    @Test
    void warns_and_skips_a_fragment_root() {
        String expr = "fragment(div(text(\"a\")), div(text(\"b\")))";

        ParsedView parsed = parser.parse(expr);

        assertThat(parsed.warnings())
                .extracting(ConversionWarning::construct)
                .contains("fragment");
    }
}
