/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.component;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

import dev.lievit.LievitComponent;
import dev.lievit.LievitLazy;
import dev.lievit.Wire;

/**
 * Pins the lazy/deferred component reflector (ADR-0036, issue #147): {@code @LievitLazy} marks a
 * component lazy, {@code defer=true} flips it to load-on-init, a custom {@code placeholder()} method
 * renders the placeholder, and a non-lazy component reflects as not lazy with the default skeleton.
 */
class LazyComponentTest {

    @LievitComponent
    @LievitLazy
    static class LazyChart {
        @Wire int points = 1000;
    }

    @LievitComponent
    @LievitLazy(defer = true, placeholder = "skeleton")
    static class DeferredPanel {
        @Wire String title = "Sales";

        String skeleton() {
            return "<div class=\"skeleton\">loading " + title + "</div>";
        }
    }

    @LievitComponent
    static class Eager {
        @Wire int x;
    }

    /**
     * @spec.given a @LievitLazy component with no custom placeholder
     * @spec.when  its lazy metadata is reflected
     * @spec.then  it is lazy, not deferred, and renders the default skeleton
     * @spec.adr   ADR-0036
     */
    @Test
    void a_lazy_component_uses_the_default_skeleton() {
        LazyComponent lazy = LazyComponent.of(LazyChart.class);

        assertThat(lazy.isLazy()).isTrue();
        assertThat(lazy.defersOnInit()).isFalse();
        assertThat(lazy.placeholderHtml(new LazyChart())).contains("lievit-lazy-placeholder");
    }

    /**
     * @spec.given a @LievitLazy(defer=true, placeholder="skeleton") component
     * @spec.when  its lazy metadata is reflected and the placeholder rendered
     * @spec.then  it defers on init and the custom placeholder renders from component state
     * @spec.adr   ADR-0036
     */
    @Test
    void a_deferred_component_renders_its_custom_placeholder() {
        LazyComponent lazy = LazyComponent.of(DeferredPanel.class);

        assertThat(lazy.isLazy()).isTrue();
        assertThat(lazy.defersOnInit()).isTrue();
        assertThat(lazy.placeholderHtml(new DeferredPanel())).isEqualTo("<div class=\"skeleton\">loading Sales</div>");
    }

    /**
     * @spec.given a component with no @LievitLazy
     * @spec.when  its lazy metadata is reflected
     * @spec.then  it is not lazy (the mount path renders it normally)
     * @spec.adr   ADR-0036
     */
    @Test
    void a_plain_component_is_not_lazy() {
        assertThat(LazyComponent.of(Eager.class).isLazy()).isFalse();
    }
}
