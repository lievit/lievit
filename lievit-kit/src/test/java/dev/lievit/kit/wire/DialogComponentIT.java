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
 * Wave 2 gate (ADR-0012): the dialog {@code registry:wire} component, {@link DialogComponent},
 * driven through the REAL lievit runtime (codec + registry + dispatcher + JTE adapter). Proves the
 * two things the pivot demands of every wire component:
 *
 * <ol>
 *   <li>the open/closed state transitions <strong>server-side</strong> on the {@code open} /
 *       {@code close} actions (no client state), and
 *   <li>the template RENDERS that state correctly (a render-asserting test, not a structural one:
 *       the bug ADR-0012 was written to kill was a non-projected render through a {@code <slot>}
 *       that a structure-only test missed). The owned body region must render whether open or
 *       closed; only the overlay's visibility (the boolean {@code hidden}) flips.
 * </ol>
 *
 * <p>It boots a Spring context, so it is an {@code *IT} (the failsafe loop, ADR-0007).
 */
@SpringBootTest(classes = OverlayWireTestApp.class)
@TestPropertySource(
        properties = {"lievit.signing-key=test-signing-key-0123456789abcdef-0123456789"})
class DialogComponentIT {

    @Autowired LievitWireService wireService;

    private static final String COMPONENT = DialogComponent.class.getName();

    /**
     * @spec.given the dialog wire component mounted with its default (closed) state
     * @spec.when  it is rendered by JTE through the real runtime
     * @spec.then  the overlay is `hidden` (closed = removed from the a11y tree) yet the panel is
     *     role=dialog aria-modal and the OWNED body region is present (it cannot fail to project,
     *     the whole point of dropping the slot), proving the dialog renders closed-but-built
     * @spec.adr   ADR-0012
     */
    @Test
    void renders_hidden_with_the_dialog_panel_and_owned_body_on_mount() {
        WireCallResult mounted = wireService.mount(COMPONENT);

        assertThat(mounted.html())
                .contains("data-lv-dialog")
                // closed: the boolean `hidden` attribute is present on the overlay root.
                .containsPattern("data-lv-dialog\\b[^>]*\\bhidden\\b")
                .contains("role=\"dialog\"")
                .contains("aria-modal=\"true\"")
                // the body is OWNED template markup, server-rendered even while closed.
                .contains("data-lv-dialog-body");
        assertThat(mounted.snapshot()).isNotBlank();
    }

    /**
     * @spec.given a mounted (closed) dialog
     * @spec.when  the open action runs over the wire
     * @spec.then  the server state flips to open: the re-render drops the `hidden` attribute so the
     *     overlay (and its owned body) is exposed, proving the open-state lives + moves server-side
     * @spec.adr   ADR-0012
     */
    @Test
    void open_shows_it_server_side_and_the_render_reflects_open() {
        WireCallResult mounted = wireService.mount(COMPONENT);

        WireCallResult opened =
                wireService.call(mounted.snapshot(), Map.of(), List.of("open"), "test-client");

        assertThat(opened.html())
                // open: the `hidden` attribute is dropped from the overlay root.
                .doesNotContainPattern("data-lv-dialog\\b[^>]*\\bhidden\\b")
                .contains("role=\"dialog\"")
                .contains("data-lv-dialog-body");
    }

    /**
     * @spec.given an opened dialog (one open call from mount)
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
                .containsPattern("data-lv-dialog\\b[^>]*\\bhidden\\b");
    }

    /**
     * @spec.given a dialog whose heading + description are set over the wire
     * @spec.when  it re-renders open
     * @spec.then  the header renders the title + description text, wires aria-labelledby ->
     *     the title id and aria-describedby -> the description id, and renders the close button,
     *     proving the @Wire string fields round-trip and drive the modal a11y wiring
     * @spec.adr   ADR-0012
     */
    @Test
    void heading_and_description_wire_the_modal_a11y() {
        WireCallResult mounted = wireService.mount(COMPONENT);

        WireCallResult labelled =
                wireService.call(
                        mounted.snapshot(),
                        Map.of("heading", "Confirm action", "description", "This cannot be undone."),
                        List.of("open"),
                        "test-client");

        assertThat(labelled.html())
                .contains(">Confirm action</h2>")
                .contains(">This cannot be undone.</p>")
                .contains("aria-labelledby=\"lv-dialog-heading\"")
                .contains("aria-describedby=\"lv-dialog-desc\"")
                .contains("data-lv-dialog-close");
    }

    /**
     * @spec.given a dialog whose `dismissible` flag is left at its default (true)
     * @spec.when  it renders open
     * @spec.then  the backdrop close button is present (the dismissible close path), proving the
     *     locked boolean drives the rendered close affordances
     * @spec.adr   ADR-0012
     */
    @Test
    void a_dismissible_dialog_renders_the_backdrop_close() {
        WireCallResult mounted = wireService.mount(COMPONENT);

        WireCallResult opened =
                wireService.call(mounted.snapshot(), Map.of(), List.of("open"), "test-client");

        assertThat(opened.html()).contains("data-lv-dialog-backdrop");
    }

    /**
     * @spec.given a fresh dialog instance
     * @spec.when  open then close are invoked directly
     * @spec.then  the open state moves true then false: the server is the single owner of the
     *     state. A plain unit assertion on the actions, no runtime needed.
     * @spec.adr   ADR-0012
     */
    @Test
    void open_then_close_moves_the_server_state() {
        DialogComponent c = new DialogComponent();

        c.open();
        assertThat(c.open).as("open() opens").isTrue();

        c.close();
        assertThat(c.open).as("close() closes").isFalse();
    }
}
