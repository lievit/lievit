/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit.wire;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.TestPropertySource;

import io.lievit.spring.LievitWireService;
import io.lievit.spring.WireCallResult;

/**
 * Wave 0 exit gate (ADR-0012): the first {@code registry:wire} component, {@link
 * CollapsibleComponent}, driven through the REAL lievit runtime (codec + registry + dispatcher +
 * JTE adapter). Proves the two things the pivot demands of every wire component:
 *
 * <ol>
 *   <li>the open/closed state transitions <strong>server-side</strong> on the {@code toggle}
 *       action (no client state), and
 *   <li>the template RENDERS that state correctly (a render-asserting test, not a structural one:
 *       the bug ADR-0012 was written to kill was a wrong/non-projected render that a structure-only
 *       test missed).
 * </ol>
 *
 * <p>It boots a Spring context, so it is an {@code *IT} (the failsafe loop, ADR-0007).
 */
@SpringBootTest(classes = CollapsibleWireTestApp.class)
@TestPropertySource(
        properties = {"lievit.signing-key=test-signing-key-0123456789abcdef-0123456789"})
class CollapsibleComponentIT {

    @Autowired LievitWireService wireService;

    private static final String COMPONENT = CollapsibleComponent.class.getName();

    /**
     * @spec.given the collapsible wire component mounted with its default (closed) state
     * @spec.when  it is rendered by JTE through the real runtime
     * @spec.then  the trigger is a button with aria-expanded=false and the region is `hidden`
     *     (collapsed = removed from the a11y tree), proving the disclosure renders closed
     * @spec.adr   ADR-0012
     */
    @Test
    void renders_collapsed_with_the_region_hidden_on_mount() {
        WireCallResult mounted = wireService.mount(COMPONENT);

        assertThat(mounted.html())
                .contains("data-collapsible-trigger")
                .contains("aria-expanded=\"false\"")
                .contains("data-collapsible-region")
                // the region is closed: the boolean `hidden` attribute is present on the panel div.
                .containsPattern("role=\"region\"[^>]*\\bhidden\\b[^>]*data-collapsible-region");
        assertThat(mounted.snapshot()).isNotBlank();
    }

    /**
     * @spec.given a mounted (closed) collapsible
     * @spec.when  the toggle action runs over the wire
     * @spec.then  the server state flips to open: the re-rendered HTML shows aria-expanded=true and
     *     the region is no longer hidden (the body is now exposed), proving the state lives + moves
     *     server-side and the template projects it
     * @spec.adr   ADR-0012
     */
    @Test
    void toggle_opens_it_server_side_and_the_render_reflects_open() {
        WireCallResult mounted = wireService.mount(COMPONENT);

        WireCallResult opened =
                wireService.call(mounted.snapshot(), Map.of(), List.of("toggle"), "test-client");

        assertThat(opened.html())
                .contains("aria-expanded=\"true\"")
                // open: the `hidden` attribute is dropped, so the region body is exposed.
                .doesNotContainPattern("role=\"region\"[^>]*\\bhidden\\b")
                .contains("data-collapsible-body");
    }

    /**
     * @spec.given an opened collapsible (one toggle from mount)
     * @spec.when  toggle runs again
     * @spec.then  the state flips back to closed: the re-render shows aria-expanded=false and the
     *     region is `hidden` again, proving the boolean transition round-trips through the snapshot
     * @spec.adr   ADR-0012
     */
    @Test
    void a_second_toggle_closes_it_again() {
        WireCallResult mounted = wireService.mount(COMPONENT);
        WireCallResult opened =
                wireService.call(mounted.snapshot(), Map.of(), List.of("toggle"), "test-client");
        WireCallResult closed =
                wireService.call(opened.snapshot(), Map.of(), List.of("toggle"), "test-client");

        assertThat(closed.html())
                .contains("aria-expanded=\"false\"")
                .containsPattern("role=\"region\"[^>]*\\bhidden\\b[^>]*data-collapsible-region");
    }

    /**
     * @spec.given a collapsible whose label is set over the wire
     * @spec.when  it re-renders
     * @spec.then  the label text is projected into the trigger (a render assertion on a @Wire
     *     string field round-tripping through the snapshot)
     * @spec.adr   ADR-0012
     */
    @Test
    void the_label_wire_field_is_projected_into_the_trigger() {
        WireCallResult mounted = wireService.mount(COMPONENT);

        WireCallResult labelled =
                wireService.call(
                        mounted.snapshot(), Map.of("label", "Details"), List.of(), "test-client");

        assertThat(labelled.html()).contains(">Details</span>");
    }

    /**
     * @spec.given a collapsible whose `disabled` flag is set server-side
     * @spec.when  the toggle action runs
     * @spec.then  the open state does NOT change: a disabled trigger is a server-side no-op, so the
     *     server stays the single owner of the state (the client cannot force a disabled disclosure
     *     open). A plain unit assertion on the guard, no runtime needed.
     * @spec.adr   ADR-0012
     */
    @Test
    void a_disabled_collapsible_does_not_toggle() {
        CollapsibleComponent c = new CollapsibleComponent();
        c.disabled = true;

        c.toggle();

        assertThat(c.open).as("disabled toggle is a no-op").isFalse();
    }
}
