/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.dsl;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.Map;

import org.junit.jupiter.api.Test;

import dev.lievit.LievitComponent;
import dev.lievit.LievitRender;
import dev.lievit.component.ComponentMetadata;

/**
 * Pins the {@link DslTemplateAdapter} contract (ADR-0018): it renders a single-file component by
 * invoking its {@code @LievitRender} {@link Html} method, stamps the {@code data-lievit-component}
 * root marker a JTE template stamps by hand, routes only no-template + Html-render components, and
 * rejects a multi-root render.
 */
class DslTemplateAdapterTest {

    private final DslTemplateAdapter adapter = new DslTemplateAdapter();

    /**
     * @spec.given a mounted single-file DSL counter at count = 2
     * @spec.when  the DSL adapter renders it
     * @spec.then  the HTML carries the data-lievit-component root marker and the l:click bindings,
     *     so it is wire-compatible with a template-rendered component
     * @spec.adr   ADR-0018
     */
    @Test
    void renders_a_single_file_component_with_the_root_marker_and_wire_bindings() {
        DslCounter counter = new DslCounter();
        counter.count = 2;
        ComponentMetadata metadata = ComponentMetadata.of(DslCounter.class);

        String html = adapter.render(metadata, counter, Map.of("count", 2));

        assertThat(html)
                .contains("data-lievit-component=\"" + DslCounter.class.getName() + "\"")
                .contains("l:click=\"increment\"")
                .contains("<span>2</span>");
    }

    /**
     * @spec.given a component with no template and an @LievitRender returning Html
     * @spec.when  the router asks whether the DSL adapter handles it
     * @spec.then  it does; a template component does not
     * @spec.adr   ADR-0018
     */
    @Test
    void handles_only_no_template_html_render_components() {
        assertThat(DslTemplateAdapter.handles(ComponentMetadata.of(DslCounter.class))).isTrue();
        assertThat(DslTemplateAdapter.handles(ComponentMetadata.of(TemplateComponent.class)))
                .isFalse();
    }

    /**
     * @spec.given a single-file component whose @LievitRender returns a non-Element root
     * @spec.when  the DSL adapter renders it
     * @spec.then  it is rejected: the wire needs one root element to stamp and morph
     * @spec.adr   ADR-0018
     */
    @Test
    void rejects_a_render_that_is_not_a_single_root_element() {
        ComponentMetadata metadata = ComponentMetadata.of(MultiRoot.class);

        assertThatThrownBy(() -> adapter.render(metadata, new MultiRoot(), Map.of()))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("single root Element");
    }

    /**
     * @spec.given a single-file component whose root already carries data-lievit-component
     * @spec.when  the DSL adapter renders it
     * @spec.then  the marker is not duplicated (the author's wins)
     * @spec.adr   ADR-0018
     */
    @Test
    void does_not_duplicate_an_author_supplied_root_marker() {
        ComponentMetadata metadata = ComponentMetadata.of(SelfStamped.class);

        String html = adapter.render(metadata, new SelfStamped(), Map.of());

        assertThat(html.split("data-lievit-component", -1)).hasSize(2); // exactly one occurrence
        assertThat(html).contains("data-lievit-component=\"author\"");
    }

    @LievitComponent(template = "x")
    static class TemplateComponent {}

    @LievitComponent
    static class MultiRoot {
        @LievitRender
        Html view() {
            return H.text("just text, no root element");
        }
    }

    @LievitComponent
    static class SelfStamped {
        @LievitRender
        Html view() {
            return H.div(H.text("hi")).attr("data-lievit-component", "author");
        }
    }
}
