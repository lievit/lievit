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
 * Wave 3 exit gate (ADR-0012 blueprint R4): the popover overlay seam in its WIRE form, driven
 * through the REAL lievit runtime (codec + registry + dispatcher + JTE adapter). This is the
 * load-bearing seam the dependents (dropdown-menu, the calendar-filter popover) build on, so it is
 * render-asserted, not structural: it proves the open-state moves SERVER-side and the template
 * PROJECTS the panel CONTENT only when open (the slot bug ADR-0012 was written to kill was a panel
 * whose body never rendered, which a structure-only test missed).
 *
 * <ol>
 *   <li>mounted closed -&gt; the trigger renders aria-expanded=false but the panel + its body are
 *       absent from the DOM (closed = the strongest projection proof);
 *   <li>{@code toggle} / {@code show} -&gt; the panel renders with its OWNED body content projected
 *       (role=dialog, aria-expanded=true), proving the open-state lives + moves server-side and the
 *       body cannot fail to project;
 *   <li>positioning is the server-pure CSS Anchor Positioning the partial documents (position-area
 *       + flip-block on the panel, anchor-name on the trigger), no @floating-ui/dom;
 *   <li>{@code close} drops the panel again.
 * </ol>
 *
 * <p>The native-popover PARTIAL form (registry/jte/popover.jte) has its render contract pinned by
 * the JTE real-compiler smoke + the popover.test.ts structural assertions (the show/hide is the
 * browser's native popover, so there is no shipped JS / server state to drive here).
 *
 * <p>It boots a Spring context, so it is an {@code *IT} (the failsafe loop, ADR-0007).
 */
@SpringBootTest(classes = PopoverWireTestApp.class)
@TestPropertySource(
        properties = {"lievit.signing-key=test-signing-key-0123456789abcdef-0123456789"})
class PopoverComponentIT {

    @Autowired LievitWireService wireService;

    private static final String COMPONENT = PopoverComponent.class.getName();

    /**
     * @spec.given the popover wire component mounted with its default (closed) state
     * @spec.when  it is rendered by JTE through the real runtime
     * @spec.then  the trigger is a button with aria-expanded=false but NO panel renders (closed =
     *     the panel + its body are absent from the DOM), proving the popover renders closed and the
     *     content is not present until opened
     * @spec.adr   ADR-0012
     */
    @Test
    void renders_closed_with_no_panel_on_mount() {
        WireCallResult mounted = wireService.mount(COMPONENT);

        assertThat(mounted.html())
                .contains("data-popover-trigger")
                .contains("aria-expanded=\"false\"")
                // closed: the panel + its owned body are absent from the DOM.
                .doesNotContain("data-popover-panel")
                .doesNotContain("data-popover-body")
                .doesNotContain("role=\"dialog\"");
        assertThat(mounted.snapshot()).isNotBlank();
    }

    /**
     * @spec.given a mounted (closed) popover
     * @spec.when  the toggle action runs over the wire (the trigger click)
     * @spec.then  the server state flips to open: the re-rendered HTML shows aria-expanded=true and
     *     the role=dialog panel with its OWNED body content (data-popover-body) now PROJECTS, proving
     *     the open-state lives + moves server-side and the panel content actually renders (the seam
     *     the slot bug hid)
     * @spec.adr   ADR-0012
     */
    @Test
    void toggle_opens_it_and_the_panel_content_projects() {
        WireCallResult mounted = wireService.mount(COMPONENT);

        WireCallResult opened =
                wireService.call(mounted.snapshot(), Map.of(), List.of("toggle"), "test-client");

        assertThat(opened.html())
                .contains("aria-expanded=\"true\"")
                .contains("role=\"dialog\"")
                .contains("data-popover-panel")
                // the owned panel body content actually renders inside the panel.
                .contains("data-popover-body")
                .contains("Popover content.");
    }

    /**
     * @spec.given an open popover
     * @spec.when  it re-renders
     * @spec.then  the panel is positioned with the server-pure CSS Anchor Positioning the partial
     *     documents (position-area + flip-block fallback on the panel, anchor-name on the trigger),
     *     proving no @floating-ui/dom is needed for the seam
     * @spec.adr   ADR-0012
     */
    @Test
    void the_open_panel_is_css_anchor_positioned() {
        WireCallResult mounted = wireService.mount(COMPONENT);

        WireCallResult opened =
                wireService.call(mounted.snapshot(), Map.of(), List.of("show"), "test-client");

        assertThat(opened.html())
                .contains("anchor-name:")
                .contains("position-anchor:")
                .contains("position-area: bottom span-all")
                .contains("position-try-fallbacks: flip-block");
    }

    /**
     * @spec.given a popover whose label is set over the wire
     * @spec.when  it re-renders
     * @spec.then  the label text is projected into the trigger (a render assertion on a @Wire string
     *     field round-tripping through the snapshot)
     * @spec.adr   ADR-0012
     */
    @Test
    void the_label_wire_field_is_projected_into_the_trigger() {
        WireCallResult mounted = wireService.mount(COMPONENT);

        WireCallResult labelled =
                wireService.call(
                        mounted.snapshot(), Map.of("label", "Filters"), List.of(), "test-client");

        assertThat(labelled.html()).contains(">Filters</span>");
    }

    /**
     * @spec.given an open popover (one toggle from mount)
     * @spec.when  the close action runs (Escape / an outside click / a server flow)
     * @spec.then  the menu closes server-side: the re-render drops the panel + its body, proving
     *     close is a server-owned state transition that un-projects the content
     * @spec.adr   ADR-0012
     */
    @Test
    void close_drops_the_panel_again() {
        WireCallResult mounted = wireService.mount(COMPONENT);
        WireCallResult opened =
                wireService.call(mounted.snapshot(), Map.of(), List.of("toggle"), "test-client");

        WireCallResult closed =
                wireService.call(opened.snapshot(), Map.of(), List.of("close"), "test-client");

        assertThat(closed.html())
                .contains("aria-expanded=\"false\"")
                .doesNotContain("data-popover-panel")
                .doesNotContain("data-popover-body");
    }

    /**
     * @spec.given a popover whose `disabled` flag is set server-side
     * @spec.when  the toggle / show actions run
     * @spec.then  the open state does NOT change: a disabled trigger is a server-side no-op, so the
     *     server stays the single owner of the state (the client cannot force a disabled popover
     *     open by editing the snapshot). A plain unit assertion on the guard, no runtime needed.
     * @spec.adr   ADR-0012
     */
    @Test
    void a_disabled_popover_does_not_open() {
        PopoverComponent c = new PopoverComponent();
        c.disabled = true;

        c.toggle();
        c.show();

        assertThat(c.open).as("disabled popover toggle/show is a no-op").isFalse();
    }
}
