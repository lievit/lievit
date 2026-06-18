/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.spring.slots;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.TestPropertySource;

import io.lievit.spring.LievitWireService;
import io.lievit.spring.WireCallResult;

/**
 * Slots end-to-end (issue #91): a parent supplies named + default slot content rendered in the
 * parent's scope; the child positions it; the web layer substitutes the parent HTML into the child
 * markup wrapped in slot fragment markers. A parent re-render re-supplies the slots, so slot content
 * survives the child's re-render.
 */
@SpringBootTest(classes = SlotsTestApp.class)
@TestPropertySource(
        properties = {"lievit.signing-key=test-signing-key-0123456789abcdef-0123456789"})
class SlotsIT {

    @Autowired LievitWireService wireService;

    /**
     * @spec.given a parent that renders a header slot (its @Wire title) and a default body slot (a
     *     parent-action button) into a Card child
     * @spec.when  the parent is mounted and rendered
     * @spec.then  the child markup carries the parent-rendered slot content (the title and the parent
     *     button), each wrapped in slot fragment markers inside the child's card chrome
     * @spec.adr   ADR-0033
     * @spec.us    US-091-slots
     */
    @Test
    void default_and_named_slots_render_parent_content_inside_the_child() {
        WireCallResult mounted = wireService.mount(CardHostComponent.class.getName());
        String html = mounted.html();

        // The child rendered its card chrome.
        assertThat(html).contains("data-card").contains("data-card-header").contains("data-card-body");
        // The header slot carries the parent's title (rendered in the parent's scope).
        assertThat(html).contains("data-host-title").contains("Welcome");
        // The default slot carries the parent's action button (parent-owned event).
        assertThat(html).contains("data-host-btn").contains("l:click=\"bump\"");
        // The slot content sits inside slot fragment markers (a distinct, morphable region).
        assertThat(html).contains("<!--lievit:slot-start:header-->");
        assertThat(html).contains("<!--lievit:slot-start:default-->");
    }

    /**
     * @spec.given the slotted parent re-rendered after a rename action mutates the parent's title
     * @spec.when  the parent's render re-supplies the slot fragments
     * @spec.then  the child markup still carries the (now updated) slot content: slots survive the
     *     child re-render and stay parent-owned
     * @spec.adr   ADR-0033
     * @spec.us    US-091-slots
     */
    @Test
    void slots_survive_a_re_render_with_updated_parent_state() {
        WireCallResult mounted = wireService.mount(CardHostComponent.class.getName());

        WireCallResult after =
                wireService.call(
                        mounted.snapshot(),
                        java.util.Map.of(),
                        java.util.List.of("rename"),
                        "127.0.0.1");

        // The re-render re-supplied the header slot with the new title.
        assertThat(after.html()).contains("data-card-header").contains("Renamed");
        assertThat(after.html()).contains("data-card-body").contains("l:click=\"bump\"");
    }
}
