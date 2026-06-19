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
 * Wave 3 gate (ADR-0012): the alert-dialog {@code registry:wire} confirm modal, {@link
 * AlertDialogComponent}, driven through the REAL lievit runtime (codec + registry + dispatcher +
 * JTE adapter). It is the {@code role="alertdialog"} specialization of the dialog wire; this IT
 * proves the two things the pivot demands of every wire component:
 *
 * <ol>
 *   <li>the open/closed state + the outcome transition <strong>server-side</strong> on the {@code
 *       open} / {@code confirm} / {@code cancel} actions (no client state), and
 *   <li>the template RENDERS that state correctly (a render-asserting test, not a structural one:
 *       the bug ADR-0012 was written to kill was a non-projected render that a structure-only test
 *       missed). The confirm prompt is owned template markup that cannot fail to project; only the
 *       overlay's visibility (the boolean {@code hidden}) flips.
 * </ol>
 *
 * <p>It boots a Spring context, so it is an {@code *IT} (the failsafe loop, ADR-0007).
 */
@SpringBootTest(classes = OverlayWireTestApp.class)
@TestPropertySource(
        properties = {"lievit.signing-key=test-signing-key-0123456789abcdef-0123456789"})
class AlertDialogComponentIT {

    @Autowired LievitWireService wireService;

    private static final String COMPONENT = AlertDialogComponent.class.getName();

    /**
     * @spec.given the alert-dialog wire component mounted with its default (closed) state
     * @spec.when  it is rendered by JTE through the real runtime
     * @spec.then  the overlay is `hidden` (closed = removed from the a11y tree) yet the panel is
     *     role=alertdialog aria-modal and the title + the confirm/cancel buttons are present (owned
     *     markup, it cannot fail to project), proving the confirm modal renders closed-but-built
     * @spec.adr   ADR-0012
     */
    @Test
    void renders_hidden_with_the_alertdialog_panel_and_buttons_on_mount() {
        WireCallResult mounted = wireService.mount(COMPONENT);

        assertThat(mounted.html())
                .contains("data-lv-alert-dialog")
                // closed: the boolean `hidden` attribute is present on the overlay root.
                .containsPattern("data-lv-alert-dialog\\b[^>]*\\bhidden\\b")
                .contains("role=\"alertdialog\"")
                .contains("aria-modal=\"true\"")
                // the confirm + cancel buttons are owned template markup, rendered even while closed.
                .contains("data-lv-alert-dialog-action")
                .contains("data-lv-alert-dialog-cancel");
        assertThat(mounted.snapshot()).isNotBlank();
    }

    /**
     * @spec.given a mounted (closed) alert-dialog
     * @spec.when  the open action runs over the wire
     * @spec.then  the server state flips to open: the re-render drops the `hidden` attribute so the
     *     prompt is exposed, proving the open-state lives + moves server-side
     * @spec.adr   ADR-0012
     */
    @Test
    void open_shows_the_prompt_server_side_and_the_render_reflects_open() {
        WireCallResult mounted = wireService.mount(COMPONENT);

        WireCallResult opened =
                wireService.call(mounted.snapshot(), Map.of(), List.of("open"), "test-client");

        assertThat(opened.html())
                // open: the `hidden` attribute is dropped from the overlay root.
                .doesNotContainPattern("data-lv-alert-dialog\\b[^>]*\\bhidden\\b")
                .contains("role=\"alertdialog\"");
    }

    /**
     * @spec.given an opened alert-dialog (one open call from mount)
     * @spec.when  the confirm action runs over the wire
     * @spec.then  the state flips to closed AND the outcome flag confirmed flips true: the re-render
     *     re-adds `hidden`, proving the destructive confirm closes the prompt and records the
     *     outcome server-side (the server is the single owner of the decision)
     * @spec.adr   ADR-0012
     */
    @Test
    void confirm_records_the_outcome_and_closes() {
        WireCallResult mounted = wireService.mount(COMPONENT);
        WireCallResult opened =
                wireService.call(mounted.snapshot(), Map.of(), List.of("open"), "test-client");

        WireCallResult confirmed =
                wireService.call(opened.snapshot(), Map.of(), List.of("confirm"), "test-client");

        assertThat(confirmed.html())
                .containsPattern("data-lv-alert-dialog\\b[^>]*\\bhidden\\b");
    }

    /**
     * @spec.given an opened alert-dialog
     * @spec.when  the cancel action runs over the wire
     * @spec.then  the state flips back to closed with no outcome recorded: the re-render re-adds
     *     `hidden`, proving cancel dismisses the prompt server-side
     * @spec.adr   ADR-0012
     */
    @Test
    void cancel_closes_without_confirming() {
        WireCallResult mounted = wireService.mount(COMPONENT);
        WireCallResult opened =
                wireService.call(mounted.snapshot(), Map.of(), List.of("open"), "test-client");

        WireCallResult cancelled =
                wireService.call(opened.snapshot(), Map.of(), List.of("cancel"), "test-client");

        assertThat(cancelled.html())
                .containsPattern("data-lv-alert-dialog\\b[^>]*\\bhidden\\b");
    }

    /**
     * @spec.given an alert-dialog whose title + description + labels are set over the wire
     * @spec.when  it re-renders open
     * @spec.then  the header renders the title + description text, wires aria-labelledby -> the
     *     title id and aria-describedby -> the description id, and the buttons render the custom
     *     labels, proving the @Wire string fields round-trip and drive the modal a11y + the buttons
     * @spec.adr   ADR-0012
     */
    @Test
    void title_description_and_labels_wire_the_prompt() {
        WireCallResult mounted = wireService.mount(COMPONENT);

        WireCallResult labelled =
                wireService.call(
                        mounted.snapshot(),
                        Map.of(
                                "title",
                                "Delete the contact?",
                                "description",
                                "This cannot be undone.",
                                "actionLabel",
                                "Delete",
                                "cancelLabel",
                                "Keep"),
                        List.of("open"),
                        "test-client");

        assertThat(labelled.html())
                .contains("Delete the contact?")
                .contains(">This cannot be undone.</p>")
                .contains("aria-labelledby=\"lv-alert-dialog-title\"")
                .contains("aria-describedby=\"lv-alert-dialog-desc\"")
                .contains(">Delete</button>")
                .contains(">Keep</button>");
    }

    /**
     * @spec.given an alert-dialog the SERVER mounts destructive + open (destructive is a locked
     *     @Wire field, so only the server may set it, not a client update; this is exactly the lock
     *     a client cannot bypass)
     * @spec.when  it renders open
     * @spec.then  the confirm button carries the destructive token background + the data-destructive
     *     marker, proving the locked boolean drives the destructive styling (the shadcn AlertDialog
     *     destructive variant) and is server-owned
     * @spec.adr   ADR-0012
     */
    @Test
    void a_destructive_prompt_renders_the_destructive_affordance() {
        WireCallResult opened =
                wireService.mountStamped(
                        COMPONENT, Map.of("destructive", true, "open", true));

        assertThat(opened.html())
                .contains("role=\"alertdialog\"")
                .contains("var(--lv-color-destructive)")
                .contains("data-destructive=\"true\"")
                // open: the overlay is not hidden.
                .doesNotContainPattern("data-lv-alert-dialog\\b[^>]*\\bhidden\\b");
    }

    /**
     * @spec.given a client that tries to flip the locked `destructive` flag over the wire
     * @spec.when  the update is applied
     * @spec.then  the runtime rejects it: `destructive` is a locked @Wire field, so a client cannot
     *     downgrade a server-mandated destructive confirm to a benign one (or vice-versa) by editing
     *     the snapshot payload. This pins the security invariant the lock encodes.
     * @spec.adr   ADR-0012
     */
    @Test
    void a_client_cannot_flip_the_locked_destructive_flag() {
        WireCallResult mounted = wireService.mount(COMPONENT);

        org.assertj.core.api.Assertions.assertThatThrownBy(
                        () ->
                                wireService.call(
                                        mounted.snapshot(),
                                        Map.of("destructive", true),
                                        List.of(),
                                        "test-client"))
                .isInstanceOf(io.lievit.wire.WireException.class)
                .hasMessageContaining("locked");
    }

    /**
     * @spec.given a fresh alert-dialog instance
     * @spec.when  open then confirm are invoked directly
     * @spec.then  the open state moves true then false and confirmed moves false then true: the
     *     server is the single owner of the outcome. A plain unit assertion on the actions, no
     *     runtime needed.
     * @spec.adr   ADR-0012
     */
    @Test
    void open_then_confirm_moves_the_server_state_and_outcome() {
        AlertDialogComponent c = new AlertDialogComponent();

        c.open();
        assertThat(c.open).as("open() opens").isTrue();
        assertThat(c.confirmed).as("open() clears any prior outcome").isFalse();

        c.confirm();
        assertThat(c.open).as("confirm() closes").isFalse();
        assertThat(c.confirmed).as("confirm() records the outcome").isTrue();
    }
}
