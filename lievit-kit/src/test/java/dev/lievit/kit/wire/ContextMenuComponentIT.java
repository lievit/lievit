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
 * Wave 2 exit gate (ADR-0012): the context-menu {@code registry:wire} component, driven through
 * the REAL lievit runtime (codec + registry + dispatcher + JTE adapter). Render-asserting, not
 * structural: it proves the open-state moves SERVER-side and the template PROJECTS it (the bug
 * ADR-0012 was written to kill was a non-projected render a structure-only test missed).
 *
 * <ol>
 *   <li>mounted closed -&gt; no menu panel rendered;
 *   <li>{@code openAt} -&gt; the menu opens server-side and the template renders a {@code role=menu}
 *       of real {@code role=menuitem} buttons (the items, server-owned data, are projected);
 *   <li>the pointer coordinates the enhancer set ({@code x}/{@code y}) position the panel;
 *   <li>a selection arms {@code selectedKey} over the wire and the menu closes.
 * </ol>
 *
 * <p>It boots a Spring context, so it is an {@code *IT} (the failsafe loop, ADR-0007).
 */
@SpringBootTest(classes = ContextMenuWireTestApp.class)
@TestPropertySource(
        properties = {"lievit.signing-key=test-signing-key-0123456789abcdef-0123456789"})
class ContextMenuComponentIT {

    @Autowired LievitWireService wireService;

    private static final String COMPONENT = ContextMenuComponent.class.getName();

    /**
     * @spec.given the context-menu wire component mounted with its default (closed) state
     * @spec.when  it is rendered by JTE through the real runtime
     * @spec.then  the owned right-clickable trigger region renders but NO menu panel does (closed =
     *     the panel is absent from the DOM), proving the menu renders closed
     * @spec.adr   ADR-0012
     */
    @Test
    void renders_closed_with_no_menu_panel_on_mount() {
        WireCallResult mounted = wireService.mount(COMPONENT);

        assertThat(mounted.html())
                .contains("data-context-menu-trigger")
                .doesNotContain("data-context-menu-panel")
                .doesNotContain("role=\"menu\"");
        assertThat(mounted.snapshot()).isNotBlank();
    }

    /**
     * @spec.given a mounted (closed) context-menu
     * @spec.when  the openAt action runs over the wire (the enhancer's contextmenu handler)
     * @spec.then  the server state flips to open: the re-rendered HTML shows a role=menu panel of
     *     real role=menuitem buttons projecting the server-owned items (Copy / Paste / Delete) plus
     *     a separator, proving the open-state lives + moves server-side and the items project
     * @spec.adr   ADR-0012
     */
    @Test
    void open_at_renders_the_menu_with_real_menu_items() {
        WireCallResult mounted = wireService.mount(COMPONENT);

        WireCallResult opened =
                wireService.call(mounted.snapshot(), Map.of(), List.of("openAt"), "test-client");

        assertThat(opened.html())
                .contains("data-context-menu-panel")
                .contains("role=\"menu\"")
                .contains("role=\"menuitem\"")
                // the server-owned items are projected as real menu items.
                .contains("data-context-menu-item=\"copy\"")
                .contains(">Copy</span>")
                .contains("data-context-menu-item=\"paste\"")
                .contains("data-context-menu-item=\"delete\"")
                // the separator between paste and delete renders too.
                .contains("data-context-menu-separator");
    }

    /**
     * @spec.given an open context-menu and the pointer coordinates the enhancer wrote
     * @spec.when  it re-renders
     * @spec.then  the panel is positioned (position:fixed) at the x/y the wire fields carry,
     *     proving the @Wire int coordinates round-trip the snapshot and drive the CSS position (no
     *     @floating-ui/dom)
     * @spec.adr   ADR-0012
     */
    @Test
    void the_pointer_coordinates_position_the_panel() {
        WireCallResult mounted = wireService.mount(COMPONENT);

        // the enhancer sets x/y (a $set model update) before firing openAt; here we pass them as the
        // client _updates that ride the same action.
        WireCallResult opened =
                wireService.call(
                        mounted.snapshot(),
                        Map.of("x", 120, "y", 240),
                        List.of("openAt"),
                        "test-client");

        assertThat(opened.html())
                .contains("position: fixed")
                .contains("left: 120px")
                .contains("top: 240px");
    }

    /**
     * @spec.given an open context-menu
     * @spec.when  a menu item arms its key via the $set('selectedKey', ...) magic-action and the
     *     menu's closeAfterSelect action runs (the enhancer's selection -&gt; close flow)
     * @spec.then  selectedKey holds the chosen key and the menu closes (the panel is gone), proving
     *     the selection round-trips and the server stays the single owner of the open-state
     * @spec.adr   ADR-0012
     */
    @Test
    void selecting_an_item_arms_the_key_and_closes_the_menu() {
        WireCallResult mounted = wireService.mount(COMPONENT);
        WireCallResult opened =
                wireService.call(mounted.snapshot(), Map.of(), List.of("openAt"), "test-client");

        WireCallResult selected =
                wireService.call(
                        opened.snapshot(),
                        Map.of(),
                        List.of("$set('selectedKey', 'copy')", "closeAfterSelect"),
                        "test-client");

        // the menu closed: its panel is no longer rendered.
        assertThat(selected.html()).doesNotContain("data-context-menu-panel");
        // re-opening shows the selection was recorded server-side (selectedKey survived in the
        // snapshot); openAt clears it again for the next gesture.
        WireCallResult reopened =
                wireService.call(selected.snapshot(), Map.of(), List.of("openAt"), "test-client");
        assertThat(reopened.html()).contains("data-context-menu-panel");
    }

    /**
     * @spec.given an open context-menu
     * @spec.when  the close action runs (Escape / an outside click via the enhancer)
     * @spec.then  the menu closes server-side: the re-render drops the panel, proving close is a
     *     server-owned state transition
     * @spec.adr   ADR-0012
     */
    @Test
    void close_drops_the_menu_panel() {
        WireCallResult mounted = wireService.mount(COMPONENT);
        WireCallResult opened =
                wireService.call(mounted.snapshot(), Map.of(), List.of("openAt"), "test-client");

        WireCallResult closed =
                wireService.call(opened.snapshot(), Map.of(), List.of("close"), "test-client");

        assertThat(closed.html()).doesNotContain("data-context-menu-panel").doesNotContain("role=\"menu\"");
    }
}
