/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.compiler.convert;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

/**
 * Spec for the two convert writers (issue #141, ADR-0070/0071): {@link DslViewWriter} renders a
 * neutral {@link ViewNode} tree back to the {@code io.lievit.dsl.H} builder expression, and
 * {@link JteViewWriter} renders it to a JTE template body. The load-bearing property is
 * <strong>round-trip stability</strong>: parsing a written form back yields the same AST, so a
 * convert is idempotent (a fixed point), which the {@link ViewConverterTest} pins end-to-end and this
 * spec pins per-writer.
 */
class ViewWriterTest {

    private final DslViewWriter dsl = new DslViewWriter();
    private final JteViewWriter jte = new JteViewWriter();
    private final DslViewParser dslParser = new DslViewParser();
    private final JteViewParser jteParser = new JteViewParser();

    private static ViewNode counter() {
        return new ViewNode.Element(
                "div",
                java.util.List.of(),
                java.util.List.of(
                        new ViewNode.Element(
                                "button",
                                java.util.List.of(ViewAttribute.literal("l:click", "decrement")),
                                java.util.List.of(new ViewNode.Literal("-"))),
                        new ViewNode.Element(
                                "span",
                                java.util.List.of(ViewAttribute.bool("data-lievit-count")),
                                java.util.List.of(new ViewNode.Expression("count"))),
                        new ViewNode.Element(
                                "button",
                                java.util.List.of(ViewAttribute.literal("l:click", "increment")),
                                java.util.List.of(new ViewNode.Literal("+")))));
    }

    /**
     * @spec.given the neutral counter tree
     * @spec.when  it is written as a DSL expression
     * @spec.then  l:click renders via the fluent wireClick helper and text literals via text("...")
     * @spec.adr   ADR-0070
     */
    @Test
    void writes_dsl_with_fluent_wire_helpers() {
        String out = dsl.write(counter());
        assertThat(out).contains("button(text(\"-\")).wireClick(\"decrement\")");
        assertThat(out).contains("span(text(count)).attr(\"data-lievit-count\")");
        assertThat(out).startsWith("div(");
    }

    /**
     * @spec.given the neutral counter tree
     * @spec.when  it is written as a JTE template body
     * @spec.then  ${count} renders for the expression, the literal attribute renders bare, and the
     *     l:click renders verbatim
     * @spec.adr   ADR-0071
     */
    @Test
    void writes_jte_with_interpolation_and_directives() {
        String out = jte.write(counter());
        assertThat(out).contains("${count}");
        assertThat(out).contains("l:click=\"increment\"");
        assertThat(out).contains("<span data-lievit-count>");
    }

    /**
     * @spec.given the neutral counter tree
     * @spec.when  it is written to DSL then re-parsed
     * @spec.then  the re-parsed AST equals the original (DSL round-trip is a fixed point)
     * @spec.adr   ADR-0070
     */
    @Test
    void dsl_round_trip_is_stable() {
        ViewNode original = counter();
        ParsedView reparsed = dslParser.parse(dsl.write(original));
        assertThat(reparsed.isFaithful()).isTrue();
        assertThat(reparsed.root()).contains(original);
    }

    /**
     * @spec.given the neutral counter tree
     * @spec.when  it is written to JTE then re-parsed
     * @spec.then  the re-parsed AST equals the original (JTE round-trip is a fixed point)
     * @spec.adr   ADR-0071
     */
    @Test
    void jte_round_trip_is_stable() {
        ViewNode original = counter();
        ParsedView reparsed = jteParser.parse(jte.write(original));
        assertThat(reparsed.isFaithful()).isTrue();
        assertThat(reparsed.root()).contains(original);
    }

    /**
     * @spec.given a dynamic attribute value (an expression, not a string literal)
     * @spec.when  written to both shapes
     * @spec.then  DSL emits a bare expression arg, JTE emits a ${...} interpolated attribute value
     * @spec.adr   ADR-0070
     */
    @Test
    void dynamic_attribute_renders_per_shape() {
        ViewNode node =
                new ViewNode.Element(
                        "a",
                        java.util.List.of(ViewAttribute.dynamic("href", "url")),
                        java.util.List.of(new ViewNode.Literal("link")));
        assertThat(dsl.write(node)).contains(".attr(\"href\", url)");
        assertThat(jte.write(node)).contains("href=\"${url}\"");
    }
}
