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
 * Wave 2 exit gate (ADR-0012): the accordion {@code registry:wire} component, {@link
 * AccordionComponent}, driven through the REAL lievit runtime (codec + registry + dispatcher + JTE
 * adapter). Render-asserting, not structural: it proves the open SET transitions server-side on a
 * click and that the template projects each item's state (aria-expanded + the panel hidden
 * attribute), the exact projection the dropped Lit island lost through its named {@code <slot>}.
 *
 * <p>A click is the {@code $set('toggleId','<id>')} magic this template emits: the test mirrors it
 * by sending {@code toggleId} as a field update (the {@code _updates} the {@code $set} produces);
 * the {@code @LievitRender} hook then flips the open set and clears the arm. It boots a Spring
 * context, so it is an {@code *IT} (the failsafe loop, ADR-0007).
 */
@SpringBootTest(classes = AccordionWireTestApp.class)
@TestPropertySource(
        properties = {"lievit.signing-key=test-signing-key-0123456789abcdef-0123456789"})
class AccordionComponentIT {

    @Autowired LievitWireService wireService;

    private static final String COMPONENT = AccordionComponent.class.getName();

    /** Arms an item the way the template's {@code $set('toggleId','id')} click does. */
    private WireCallResult clickItem(String snapshot, String id) {
        return wireService.call(snapshot, Map.of("toggleId", id), List.of(), "test-client");
    }

    /**
     * @spec.given the accordion mounted with three items and the default (all-closed) state
     * @spec.when  it is rendered by JTE through the real runtime
     * @spec.then  every trigger is a button with aria-expanded=false and every region is `hidden`
     *     (all collapsed = removed from the a11y tree), proving the group renders fully closed
     * @spec.adr   ADR-0012
     */
    @Test
    void renders_all_items_collapsed_on_mount() {
        WireCallResult mounted = wireService.mount(COMPONENT);

        assertThat(mounted.html())
                .contains("data-accordion-trigger=\"one\"")
                .contains("data-accordion-trigger=\"two\"")
                .contains("data-accordion-trigger=\"three\"")
                .contains("aria-expanded=\"false\"")
                .doesNotContain("aria-expanded=\"true\"")
                // every region carries the boolean hidden attribute when closed.
                .containsPattern("role=\"region\"[^>]*\\bhidden\\b[^>]*data-accordion-region=\"one\"");
        assertThat(mounted.snapshot()).isNotBlank();
    }

    /**
     * @spec.given a mounted (all-closed) accordion
     * @spec.when  the first item is clicked (its toggleId armed over the wire)
     * @spec.then  the server open set gains that item: its trigger renders aria-expanded=true and its
     *     region is no longer hidden (its body exposed), while the others stay closed, proving the
     *     set state lives + moves server-side and the template projects it
     * @spec.adr   ADR-0012
     */
    @Test
    void clicking_an_item_opens_it_server_side_and_the_render_reflects_open() {
        WireCallResult mounted = wireService.mount(COMPONENT);

        WireCallResult opened = clickItem(mounted.snapshot(), "one");

        assertThat(opened.html())
                .containsPattern(
                        "data-accordion-trigger=\"one\"[^>]*aria-expanded=\"true\"|"
                                + "aria-expanded=\"true\"[^>]*data-accordion-trigger=\"one\"")
                // item one's region is exposed (no hidden), item two's stays hidden.
                .doesNotContainPattern("role=\"region\"[^>]*\\bhidden\\b[^>]*data-accordion-region=\"one\"")
                .containsPattern("role=\"region\"[^>]*\\bhidden\\b[^>]*data-accordion-region=\"two\"")
                .contains("data-accordion-body=\"one\"");
    }

    /**
     * @spec.given an accordion in {@code single} mode with the first item open
     * @spec.when  a second item is clicked
     * @spec.then  the open set holds only the second item: single mode closed the first (one open at
     *     a time), proving the server enforces the selection mode, not the client
     * @spec.adr   ADR-0012
     */
    @Test
    void single_mode_keeps_only_one_item_open() {
        WireCallResult mounted = wireService.mount(COMPONENT);
        WireCallResult first = clickItem(mounted.snapshot(), "one");

        WireCallResult second = clickItem(first.snapshot(), "two");

        assertThat(second.html())
                .containsPattern(
                        "data-accordion-trigger=\"two\"[^>]*aria-expanded=\"true\"|"
                                + "aria-expanded=\"true\"[^>]*data-accordion-trigger=\"two\"")
                // the first item closed again: its region is hidden once more.
                .containsPattern("role=\"region\"[^>]*\\bhidden\\b[^>]*data-accordion-region=\"one\"")
                .doesNotContainPattern("role=\"region\"[^>]*\\bhidden\\b[^>]*data-accordion-region=\"two\"");
    }

    /**
     * @spec.given a single-mode accordion with the first item open
     * @spec.when  the same first item is clicked again
     * @spec.then  it closes: the open set drops it, its region is `hidden` again, proving membership
     *     toggles (not just selects) and the boolean transition round-trips through the snapshot
     * @spec.adr   ADR-0012
     */
    @Test
    void clicking_an_open_item_again_closes_it() {
        WireCallResult mounted = wireService.mount(COMPONENT);
        WireCallResult opened = clickItem(mounted.snapshot(), "one");

        WireCallResult closed = clickItem(opened.snapshot(), "one");

        assertThat(closed.html())
                .containsPattern(
                        "data-accordion-trigger=\"one\"[^>]*aria-expanded=\"false\"|"
                                + "aria-expanded=\"false\"[^>]*data-accordion-trigger=\"one\"")
                .containsPattern("role=\"region\"[^>]*\\bhidden\\b[^>]*data-accordion-region=\"one\"");
    }

    /**
     * @spec.given a multiple-mode accordion (two items armed open in turn)
     * @spec.when  a second item is clicked while a first is open
     * @spec.then  both stay open: multiple mode does not close siblings, proving the server honours
     *     the mode for the many-open case too. A plain unit assertion on the flip logic, no runtime.
     * @spec.adr   ADR-0012
     */
    @Test
    void multiple_mode_allows_several_items_open() {
        AccordionComponent c = new AccordionComponent();
        c.itemIds = List.of("one", "two");
        c.labels = List.of("First", "Second");
        c.mode = "multiple";

        c.toggleId = "one";
        c.toggle();
        c.toggleId = "two";
        c.toggle();

        assertThat(c.open).as("multiple mode keeps both open").containsExactlyInAnyOrder("one", "two");
    }

    /**
     * @spec.given a mounted accordion
     * @spec.when  it re-renders with no item armed (toggleId empty)
     * @spec.then  the open set does not change: an empty arm is a no-op on the render hook, so a bare
     *     re-render (or a snapshot replay) never double-toggles, proving idempotence under replay
     * @spec.adr   ADR-0012
     */
    @Test
    void an_empty_arm_is_a_no_op_render() {
        WireCallResult mounted = wireService.mount(COMPONENT);
        WireCallResult opened = clickItem(mounted.snapshot(), "one");

        // A bare re-render: no updates, no calls. The render hook must not re-toggle item one.
        WireCallResult rerendered =
                wireService.call(opened.snapshot(), Map.of(), List.of(), "test-client");

        assertThat(rerendered.html())
                .doesNotContainPattern("role=\"region\"[^>]*\\bhidden\\b[^>]*data-accordion-region=\"one\"")
                .contains("data-accordion-body=\"one\"");
    }
}
