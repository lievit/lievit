/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.component;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.Map;

import org.junit.jupiter.api.Test;

/**
 * Pins the {@link LievitSlots} proxy semantics (issue #91): presence, default vs named slot
 * placeholders, the content accessor used by the web layer, and the bound/unbound contract.
 */
class LievitSlotsTest {

    /**
     * @spec.given a bound slot proxy with a named header slot and the default slot
     * @spec.when  the child reads has()/get()/slot()
     * @spec.then  has() reflects presence, get()/slot() return the per-slot placeholder tokens the web
     *     layer substitutes, and content() exposes the parent HTML for substitution
     * @spec.adr   ADR-0033
     * @spec.us    US-091-slots
     */
    @Test
    void exposes_presence_placeholders_and_content_for_a_bound_proxy() {
        LievitSlots.bindFor(Map.of("header", "<h1>hi</h1>", "default", "<p>body</p>"));
        try {
            LievitSlots slots = LievitSlots.current();
            assertThat(slots.has("header")).isTrue();
            assertThat(slots.has("footer")).isFalse();
            assertThat(slots.hasDefault()).isTrue();
            assertThat(slots.get("header")).isEqualTo("<!--lievit:slot:header-->");
            assertThat(slots.slot()).isEqualTo("<!--lievit:slot:default-->");
            assertThat(slots.content("header")).isEqualTo("<h1>hi</h1>");
        } finally {
            LievitSlots.clearFor();
        }
    }

    /**
     * @spec.given no slot proxy bound (a slotless child render)
     * @spec.when  the child calls LievitSlots.current()
     * @spec.then  it fails fast with a clear message (the same bound/unbound contract as the children
     *     sink and the effects sink)
     * @spec.adr   ADR-0033
     * @spec.us    US-091-slots
     */
    @Test
    void current_outside_a_child_render_fails_fast() {
        assertThatThrownBy(LievitSlots::current)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("no slot proxy is bound");
    }
}
