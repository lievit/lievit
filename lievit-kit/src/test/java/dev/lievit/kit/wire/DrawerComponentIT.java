/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit.wire;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.TestPropertySource;

import dev.lievit.spring.LievitWireService;
import dev.lievit.spring.WireCallResult;

/**
 * Wave 2 gate (ADR-0012): the drawer {@code registry:wire} component, {@link DrawerComponent},
 * driven through the REAL lievit runtime. Same open-state-server model as {@link DialogComponentIT}
 * presented as an edge-anchored side panel: proves the open/close state moves server-side AND the
 * template renders that state + the {@code side} edge correctly (render-asserting, not structural).
 *
 * <p>It boots a Spring context, so it is an {@code *IT} (the failsafe loop, ADR-0007).
 */
@SpringBootTest(classes = OverlayWireTestApp.class)
@TestPropertySource(
        properties = {"lievit.signing-key=test-signing-key-0123456789abcdef-0123456789"})
class DrawerComponentIT {

    @Autowired LievitWireService wireService;

    private static final String COMPONENT = DrawerComponent.class.getName();

    /**
     * @spec.given the drawer wire component mounted with its default (closed, side=right) state
     * @spec.when  it is rendered by JTE through the real runtime
     * @spec.then  the overlay is `hidden`, the panel is role=dialog aria-modal, the default side is
     *     reflected on data-lv-drawer-side, and the OWNED body region is present (cannot fail to
     *     project), proving the drawer renders closed-but-built
     * @spec.adr   ADR-0012
     */
    @Test
    void renders_hidden_right_anchored_with_owned_body_on_mount() {
        WireCallResult mounted = wireService.mount(COMPONENT);

        assertThat(mounted.html())
                .contains("data-lv-drawer")
                .containsPattern("data-lv-drawer\\b[^>]*\\bhidden\\b")
                .contains("role=\"dialog\"")
                .contains("aria-modal=\"true\"")
                .contains("data-lv-drawer-side=\"right\"")
                .contains("data-lv-drawer-body");
        assertThat(mounted.snapshot()).isNotBlank();
    }

    /**
     * @spec.given a mounted (closed) drawer
     * @spec.when  the open action runs over the wire
     * @spec.then  the server state flips to open: the re-render drops the `hidden` attribute so the
     *     panel + its owned body are exposed, proving the open-state lives + moves server-side
     * @spec.adr   ADR-0012
     */
    @Test
    void open_shows_it_server_side_and_the_render_reflects_open() {
        WireCallResult mounted = wireService.mount(COMPONENT);

        WireCallResult opened =
                wireService.call(mounted.snapshot(), Map.of(), List.of("open"), "test-client");

        assertThat(opened.html())
                .doesNotContainPattern("data-lv-drawer\\b[^>]*\\bhidden\\b")
                .contains("role=\"dialog\"")
                .contains("data-lv-drawer-body");
    }

    /**
     * @spec.given an opened drawer
     * @spec.when  close runs over the wire
     * @spec.then  the state flips back to closed: the re-render re-adds the `hidden` attribute,
     *     proving the boolean transition round-trips through the snapshot in both directions
     * @spec.adr   ADR-0012
     */
    @Test
    void close_hides_it_again() {
        WireCallResult mounted = wireService.mount(COMPONENT);
        WireCallResult opened =
                wireService.call(mounted.snapshot(), Map.of(), List.of("open"), "test-client");
        WireCallResult closed =
                wireService.call(opened.snapshot(), Map.of(), List.of("close"), "test-client");

        assertThat(closed.html())
                .containsPattern("data-lv-drawer\\b[^>]*\\bhidden\\b");
    }

    /**
     * @spec.given a drawer whose `side` is set to "left" over the wire
     * @spec.when  it re-renders
     * @spec.then  the rendered overlay reflects data-lv-drawer-side="left", proving the @Wire side
     *     field round-trips and drives the edge the panel anchors to
     * @spec.adr   ADR-0012
     */
    @Test
    void the_side_wire_field_drives_the_anchored_edge() {
        WireCallResult mounted = wireService.mount(COMPONENT);

        WireCallResult lefted =
                wireService.call(
                        mounted.snapshot(), Map.of("side", "left"), List.of(), "test-client");

        assertThat(lefted.html()).contains("data-lv-drawer-side=\"left\"");
    }

    /**
     * @spec.given a drawer whose heading is set over the wire and opened
     * @spec.when  it re-renders
     * @spec.then  the header renders the title text, wires aria-labelledby -> the heading id, and
     *     renders the close button, proving the @Wire heading field drives the modal a11y wiring
     * @spec.adr   ADR-0012
     */
    @Test
    void heading_wires_aria_labelledby_and_the_close_button() {
        WireCallResult mounted = wireService.mount(COMPONENT);

        WireCallResult labelled =
                wireService.call(
                        mounted.snapshot(),
                        Map.of("heading", "Filters"),
                        List.of("open"),
                        "test-client");

        assertThat(labelled.html())
                .contains(">Filters</h2>")
                .contains("aria-labelledby=\"lv-drawer-heading\"")
                .contains("data-lv-drawer-close");
    }

    /**
     * @spec.given a fresh drawer instance
     * @spec.when  open then close are invoked directly
     * @spec.then  the open state moves true then false: the server is the single owner of the
     *     state. A plain unit assertion, no runtime needed.
     * @spec.adr   ADR-0012
     */
    @Test
    void open_then_close_moves_the_server_state() {
        DrawerComponent c = new DrawerComponent();

        c.open();
        assertThat(c.open).as("open() opens").isTrue();

        c.close();
        assertThat(c.open).as("close() closes").isFalse();
    }
}
