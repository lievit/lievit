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
 * Wave 2 exit gate (ADR-0012): the tabs {@code registry:wire} component, {@link TabsComponent},
 * driven through the REAL lievit runtime (codec + registry + dispatcher + JTE adapter).
 * Render-asserting, not structural: it proves the active tab transitions server-side on a click and
 * that the template projects exactly one visible panel (the others {@code hidden}) with the right
 * aria-selected, the exact projection the dropped Lit island lost through its named {@code <slot>}.
 *
 * <p>A tab click is the {@code $set('active','<id>')} magic this template emits: the test mirrors it
 * by sending {@code active} as a field update (the {@code _updates} the {@code $set} produces). It
 * boots a Spring context, so it is an {@code *IT} (the failsafe loop, ADR-0007).
 */
@SpringBootTest(classes = TabsWireTestApp.class)
@TestPropertySource(
        properties = {"lievit.signing-key=test-signing-key-0123456789abcdef-0123456789"})
class TabsComponentIT {

    @Autowired LievitWireService wireService;

    private static final String COMPONENT = TabsComponent.class.getName();

    /** Clicks a tab the way the template's {@code $set('active','id')} click does. */
    private WireCallResult clickTab(String snapshot, String id) {
        return wireService.call(snapshot, Map.of("active", id), List.of(), "test-client");
    }

    /**
     * @spec.given the tabs mounted with three tabs and no active tab set
     * @spec.when  it is rendered by JTE through the real runtime
     * @spec.then  the first (enabled) tab is active by default: its tab is aria-selected=true and its
     *     panel is visible, while the other panels are `hidden`, proving the server defaults to the
     *     first enabled tab and the template projects exactly one open panel
     * @spec.adr   ADR-0012
     */
    @Test
    void defaults_to_the_first_tab_active_on_mount() {
        WireCallResult mounted = wireService.mount(COMPONENT);

        assertThat(mounted.html())
                .contains("role=\"tablist\"")
                .containsPattern(
                        "data-tabs-tab=\"alpha\"[^>]*aria-selected=\"true\"|"
                                + "aria-selected=\"true\"[^>]*data-tabs-tab=\"alpha\"")
                // alpha's panel is visible, beta's is hidden.
                .doesNotContainPattern("role=\"tabpanel\"[^>]*\\bhidden\\b[^>]*data-tabs-panel=\"alpha\"")
                .containsPattern("role=\"tabpanel\"[^>]*\\bhidden\\b[^>]*data-tabs-panel=\"beta\"")
                .contains("data-tabs-body=\"alpha\"");
        assertThat(mounted.snapshot()).isNotBlank();
    }

    /**
     * @spec.given a mounted tabs with the first tab active
     * @spec.when  the second tab is clicked (its id set as the active over the wire)
     * @spec.then  the active tab moves server-side: beta becomes aria-selected=true and its panel is
     *     visible, alpha's panel is now `hidden`, proving the active scalar lives + moves server-side
     *     and only the active panel renders visible
     * @spec.adr   ADR-0012
     */
    @Test
    void clicking_a_tab_activates_it_server_side_and_only_its_panel_shows() {
        WireCallResult mounted = wireService.mount(COMPONENT);

        WireCallResult switched = clickTab(mounted.snapshot(), "beta");

        assertThat(switched.html())
                .containsPattern(
                        "data-tabs-tab=\"beta\"[^>]*aria-selected=\"true\"|"
                                + "aria-selected=\"true\"[^>]*data-tabs-tab=\"beta\"")
                .doesNotContainPattern("role=\"tabpanel\"[^>]*\\bhidden\\b[^>]*data-tabs-panel=\"beta\"")
                .containsPattern("role=\"tabpanel\"[^>]*\\bhidden\\b[^>]*data-tabs-panel=\"alpha\"")
                .contains("data-tabs-body=\"beta\"");
    }

    /**
     * @spec.given a mounted tabs whose third tab (gamma) is disabled
     * @spec.when  a client tries to set the disabled tab active over the wire
     * @spec.then  the server refuses it: the active tab stays the first enabled one (alpha), gamma is
     *     never aria-selected, proving the server (not the client) enforces that a disabled tab is
     *     not selectable
     * @spec.adr   ADR-0012
     */
    @Test
    void a_disabled_tab_cannot_be_activated() {
        WireCallResult mounted = wireService.mount(COMPONENT);

        WireCallResult attempted = clickTab(mounted.snapshot(), "gamma");

        assertThat(attempted.html())
                .containsPattern(
                        "data-tabs-tab=\"alpha\"[^>]*aria-selected=\"true\"|"
                                + "aria-selected=\"true\"[^>]*data-tabs-tab=\"alpha\"")
                .containsPattern(
                        "data-tabs-tab=\"gamma\"[^>]*aria-selected=\"false\"|"
                                + "aria-selected=\"false\"[^>]*data-tabs-tab=\"gamma\"")
                // gamma's tab carries the disabled attribute.
                .containsPattern("data-tabs-tab=\"gamma\"[^>]*\\bdisabled\\b|\\bdisabled\\b[^>]*data-tabs-tab=\"gamma\"");
    }

    /**
     * @spec.given a mounted tabs with the first tab active
     * @spec.when  the explicit select() action runs with the second tab armed (pending=beta)
     * @spec.then  the active tab becomes beta: the @LievitAction path selects the armed tab (the
     *     action-driven equivalent of the $set click), proving select() honours the armed pending tab
     * @spec.adr   ADR-0012
     */
    @Test
    void the_select_action_activates_the_armed_pending_tab() {
        WireCallResult mounted = wireService.mount(COMPONENT);

        WireCallResult selected =
                wireService.call(
                        mounted.snapshot(), Map.of("pending", "beta"), List.of("select"), "test-client");

        assertThat(selected.html())
                .containsPattern(
                        "data-tabs-tab=\"beta\"[^>]*aria-selected=\"true\"|"
                                + "aria-selected=\"true\"[^>]*data-tabs-tab=\"beta\"")
                .doesNotContainPattern("role=\"tabpanel\"[^>]*\\bhidden\\b[^>]*data-tabs-panel=\"beta\"");
    }
}
