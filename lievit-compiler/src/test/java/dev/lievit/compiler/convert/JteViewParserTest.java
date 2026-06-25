/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.compiler.convert;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

/**
 * Spec for parsing a multi-file JTE template body into the neutral convert AST (issue #141,
 * ADR-0071): the {@code @import}/{@code @param} header is dropped (it is re-derived from the class
 * fields on the way back), the HTML is parsed into {@link ViewNode.Element}s, {@code ${expr}} becomes
 * an {@link ViewNode.Expression}, plain text becomes a {@link ViewNode.Literal}, {@code $unsafe{...}}
 * becomes a {@link ViewNode.Raw}, and {@code l:*} / literal / {@code ${...}} attributes split into
 * {@link ViewAttribute}s. A construct with no faithful AST mapping (a {@code @if}/{@code @for} control
 * block) is warn-and-skipped, never guessed.
 */
class JteViewParserTest {

    private final JteViewParser parser = new JteViewParser();

    /**
     * @spec.given the canonical counter template (header + a div with a dynamic span and a wired button)
     * @spec.when  it is parsed
     * @spec.then  the header is dropped, the single root div is parsed with its dynamic and literal
     *     attributes, a ${count} expression child, and the l:click button, with no warnings
     * @spec.adr   ADR-0071
     */
    @Test
    void parses_counter_template_into_a_single_root_element() {
        String jte =
                """
                @import dev.lievit.component.ComponentMetadata
                @param int count
                @param String label
                @param ComponentMetadata _component
                <div data-lievit-component="${_component.className()}" data-lievit-label="${label}">
                    <span data-lievit-count>${count}</span>
                    <button l:click="increment">+1</button>
                </div>
                """;

        ParsedView parsed = parser.parse(jte);

        assertThat(parsed.isFaithful()).isTrue();
        assertThat(parsed.root()).isPresent();
        ViewNode.Element root = (ViewNode.Element) parsed.root().orElseThrow();
        assertThat(root.tag()).isEqualTo("div");
        // dynamic attribute carries the raw expression, literal attribute carries text
        assertThat(root.attributes())
                .contains(ViewAttribute.dynamic("data-lievit-label", "label"));
        // the wired button is a child element with an l:click attribute
        ViewNode.Element button =
                (ViewNode.Element)
                        root.children().stream()
                                .filter(n -> n instanceof ViewNode.Element e && e.tag().equals("button"))
                                .findFirst()
                                .orElseThrow();
        assertThat(button.attributes()).contains(ViewAttribute.literal("l:click", "increment"));
        assertThat(button.children()).containsExactly(new ViewNode.Literal("+1"));
        // the span carries a ${count} expression child
        ViewNode.Element span =
                (ViewNode.Element)
                        root.children().stream()
                                .filter(n -> n instanceof ViewNode.Element e && e.tag().equals("span"))
                                .findFirst()
                                .orElseThrow();
        assertThat(span.children()).containsExactly(new ViewNode.Expression("count"));
        assertThat(span.attributes()).contains(ViewAttribute.bool("data-lievit-count"));
    }

    /**
     * @spec.given a template whose body contains a @if control block around an element
     * @spec.when  it is parsed
     * @spec.then  the control block is warn-and-skipped (a warning is recorded) and the safe markup
     *     around it is still converted
     * @spec.adr   ADR-0071
     */
    @Test
    void warns_and_skips_a_control_block() {
        String jte =
                """
                @param boolean on
                <div>
                    @if(on)
                    <span>visible</span>
                    @endif
                    <p>always</p>
                </div>
                """;

        ParsedView parsed = parser.parse(jte);

        assertThat(parsed.warnings()).extracting(ConversionWarning::construct).contains("@if");
        ViewNode.Element root = (ViewNode.Element) parsed.root().orElseThrow();
        // the always-present <p> survives the skip
        assertThat(root.children())
                .anyMatch(n -> n instanceof ViewNode.Element e && e.tag().equals("p"));
    }

    /**
     * @spec.given a template with an $unsafe{...} raw block
     * @spec.when  it is parsed
     * @spec.then  the raw markup is preserved as a Raw node (the one escape hatch), no warning
     * @spec.adr   ADR-0071
     */
    @Test
    void preserves_unsafe_as_a_raw_node() {
        String jte =
                """
                @param String html
                <div>$unsafe{html}</div>
                """;

        ParsedView parsed = parser.parse(jte);

        ViewNode.Element root = (ViewNode.Element) parsed.root().orElseThrow();
        assertThat(root.children()).containsExactly(new ViewNode.Raw("html"));
        assertThat(parsed.isFaithful()).isTrue();
    }
}
