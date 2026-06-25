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
 * Wave 2 gate (ADR-0012): the sheet {@code registry:wire} component, {@link SheetComponent}, driven
 * through the REAL lievit runtime. The richer four-side generalisation of the drawer (structured
 * header / description / footer + a built-in close button), same open-state-server model: proves
 * the open/close state moves server-side AND the template renders that state, the {@code side}
 * edge, the labelled header and the close button correctly (render-asserting, not structural).
 *
 * <p>It boots a Spring context, so it is an {@code *IT} (the failsafe loop, ADR-0007).
 */
@SpringBootTest(classes = OverlayWireTestApp.class)
@TestPropertySource(
        properties = {"lievit.signing-key=test-signing-key-0123456789abcdef-0123456789"})
class SheetComponentIT {

    @Autowired LievitWireService wireService;

    private static final String COMPONENT = SheetComponent.class.getName();

    /**
     * @spec.given the sheet wire component mounted with its default (closed, side=right,
     *     showClose=true) state
     * @spec.when  it is rendered by JTE through the real runtime
     * @spec.then  the overlay is `hidden`, the panel is role=dialog aria-modal, the default side is
     *     reflected, the built-in close button renders, and the OWNED body + footer regions are
     *     present (cannot fail to project), proving the sheet renders closed-but-built
     * @spec.adr   ADR-0012
     */
    @Test
    void renders_hidden_right_anchored_with_close_and_owned_regions_on_mount() {
        WireCallResult mounted = wireService.mount(COMPONENT);

        assertThat(mounted.html())
                .contains("data-lv-sheet")
                .containsPattern("data-lv-sheet\\b[^>]*\\bhidden\\b")
                .contains("role=\"dialog\"")
                .contains("aria-modal=\"true\"")
                .contains("data-lv-sheet-side=\"right\"")
                .contains("data-lv-sheet-close")
                .contains("data-lv-sheet-body")
                .contains("data-lv-sheet-footer");
        assertThat(mounted.snapshot()).isNotBlank();
    }

    /**
     * @spec.given a mounted (closed) sheet
     * @spec.when  the open action runs over the wire
     * @spec.then  the server state flips to open: the re-render drops the `hidden` attribute so the
     *     panel + its owned regions are exposed, proving the open-state lives + moves server-side
     * @spec.adr   ADR-0012
     */
    @Test
    void open_shows_it_server_side_and_the_render_reflects_open() {
        WireCallResult mounted = wireService.mount(COMPONENT);

        WireCallResult opened =
                wireService.call(mounted.snapshot(), Map.of(), List.of("open"), "test-client");

        assertThat(opened.html())
                .doesNotContainPattern("data-lv-sheet\\b[^>]*\\bhidden\\b")
                .contains("role=\"dialog\"")
                .contains("data-lv-sheet-body");
    }

    /**
     * @spec.given an opened sheet
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
                .containsPattern("data-lv-sheet\\b[^>]*\\bhidden\\b");
    }

    /**
     * @spec.given a sheet whose heading + description + side are set over the wire and opened
     * @spec.when  it re-renders
     * @spec.then  the header renders the title + description, wires aria-labelledby -> the title id
     *     and aria-describedby -> the description id, and the panel anchors to the requested edge,
     *     proving the @Wire string fields round-trip and drive the modal a11y + positioning
     * @spec.adr   ADR-0012
     */
    @Test
    void heading_description_and_side_drive_render() {
        WireCallResult mounted = wireService.mount(COMPONENT);

        WireCallResult labelled =
                wireService.call(
                        mounted.snapshot(),
                        Map.of(
                                "heading", "Edit profile",
                                "description", "Make changes here.",
                                "side", "left"),
                        List.of("open"),
                        "test-client");

        assertThat(labelled.html())
                .contains(">Edit profile</h2>")
                .contains(">Make changes here.</p>")
                .contains("aria-labelledby=\"lv-sheet-title\"")
                .contains("aria-describedby=\"lv-sheet-desc\"")
                .contains("data-lv-sheet-side=\"left\"");
    }

    /**
     * @spec.given a sheet whose `showClose` is set false over the wire and opened
     * @spec.when  it re-renders
     * @spec.then  the built-in close button is NOT rendered, proving the @Wire boolean drives the
     *     close affordance on/off
     * @spec.adr   ADR-0012
     */
    @Test
    void show_close_false_drops_the_built_in_close_button() {
        WireCallResult mounted = wireService.mount(COMPONENT);

        WireCallResult noClose =
                wireService.call(
                        mounted.snapshot(),
                        Map.of("showClose", false),
                        List.of("open"),
                        "test-client");

        assertThat(noClose.html()).doesNotContain("data-lv-sheet-close");
    }

    /**
     * @spec.given a fresh sheet instance
     * @spec.when  open then close are invoked directly
     * @spec.then  the open state moves true then false: the server is the single owner of the
     *     state. A plain unit assertion, no runtime needed.
     * @spec.adr   ADR-0012
     */
    @Test
    void open_then_close_moves_the_server_state() {
        SheetComponent c = new SheetComponent();

        c.open();
        assertThat(c.open).as("open() opens").isTrue();

        c.close();
        assertThat(c.open).as("close() closes").isFalse();
    }
}
