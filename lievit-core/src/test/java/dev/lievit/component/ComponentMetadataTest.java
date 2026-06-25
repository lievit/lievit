/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.component;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

import dev.lievit.LievitComponent;
import dev.lievit.LievitRender;
import dev.lievit.Wire;

/**
 * Pins the reflect-time contract of {@link ComponentMetadata}, in particular the single-file vs
 * multi-file render modes (ADR-0001): they are mutually exclusive, and the illegal combination
 * (a named template AND a markup-returning {@code @LievitRender}) is rejected at startup rather than
 * silently resolved by the adapter at render time.
 */
class ComponentMetadataTest {

    /** Multi-file, legal: a named template with a void prepare-hook. */
    @LievitComponent(template = "counter")
    static class MultiFilePrepareHook {
        @Wire int n;

        @LievitRender
        void prepare() {
            this.n++;
        }
    }

    /** Single-file, legal: empty template with a markup-returning render. */
    @LievitComponent
    static class SingleFileRender {
        @Wire int n;

        @LievitRender
        String render() {
            return "<div>" + n + "</div>";
        }
    }

    /** Illegal: a named template AND a markup-returning render: which one wins is undefined. */
    @LievitComponent(template = "counter")
    static class TemplateAndMarkupRender {
        @Wire int n;

        @LievitRender
        String render() {
            return "<div>" + n + "</div>";
        }
    }

    /**
     * @spec.given a component with a named template and a void @LievitRender prepare-hook
     * @spec.when  its metadata is reflected
     * @spec.then  reflection succeeds: a void render hook alongside a template is the legal
     *             multi-file mode
     * @spec.adr   ADR-0001
     */
    @Test
    void a_named_template_with_a_void_render_hook_is_legal_multi_file() {
        ComponentMetadata meta = ComponentMetadata.of(MultiFilePrepareHook.class);
        assertThat(meta.template()).isEqualTo("counter");
        assertThat(meta.render()).isNotNull();
    }

    /**
     * @spec.given a component with an empty template and a markup-returning @LievitRender
     * @spec.when  its metadata is reflected
     * @spec.then  reflection succeeds: a returning render with no template is the legal single-file
     *             mode
     * @spec.adr   ADR-0001
     */
    @Test
    void an_empty_template_with_a_markup_returning_render_is_legal_single_file() {
        ComponentMetadata meta = ComponentMetadata.of(SingleFileRender.class);
        assertThat(meta.template()).isEmpty();
        assertThat(meta.render()).isNotNull();
    }

    /**
     * @spec.given a component declaring BOTH a named template AND a markup-returning @LievitRender
     * @spec.when  its metadata is reflected
     * @spec.then  reflection fails fast (startup) with a message naming both halves; the adapter is
     *             never left to silently pick a winner
     * @spec.adr   ADR-0001
     */
    @Test
    void a_named_template_plus_a_markup_returning_render_is_rejected_at_reflect_time() {
        assertThatThrownBy(() -> ComponentMetadata.of(TemplateAndMarkupRender.class))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("counter")
                .hasMessageContaining("@LievitRender")
                .hasMessageContaining("undefined");
    }
}
