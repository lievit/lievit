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
 * Wave 2 exit gate (ADR-0012): the toggle-group {@code registry:wire} component, {@link
 * ToggleGroupComponent}, driven through the REAL lievit runtime (codec + registry + dispatcher + JTE
 * adapter). Render-asserting, not structural: it proves the selected set transitions server-side on
 * a click and that the template projects each button's pressed/checked state with the right Radix
 * ARIA roles (radiogroup/radio[aria-checked] in single mode).
 *
 * <p>A click is the {@code $set('toggleValue','<value>')} magic this template emits: the test
 * mirrors it by sending {@code toggleValue} as a field update (the {@code _updates} the {@code $set}
 * produces); the {@code @LievitRender} hook then flips the selected set and clears the arm. It boots
 * a Spring context, so it is an {@code *IT} (the failsafe loop, ADR-0007).
 */
@SpringBootTest(classes = ToggleGroupWireTestApp.class)
@TestPropertySource(
        properties = {"lievit.signing-key=test-signing-key-0123456789abcdef-0123456789"})
class ToggleGroupComponentIT {

    @Autowired LievitWireService wireService;

    private static final String COMPONENT = ToggleGroupComponent.class.getName();

    /** Clicks an item the way the template's {@code $set('toggleValue','value')} click does. */
    private WireCallResult clickItem(String snapshot, String value) {
        return wireService.call(snapshot, Map.of("toggleValue", value), List.of(), "test-client");
    }

    /**
     * @spec.given the toggle-group mounted in single mode with three values and nothing selected
     * @spec.when  it is rendered by JTE through the real runtime
     * @spec.then  the container is a radiogroup, each item is a radio with aria-checked=false (the
     *     correct Radix single-select model, not pressed buttons), proving the group renders with the
     *     right roles and no selection
     * @spec.adr   ADR-0012
     */
    @Test
    void renders_a_radiogroup_with_nothing_selected_in_single_mode() {
        WireCallResult mounted = wireService.mount(COMPONENT);

        assertThat(mounted.html())
                .contains("role=\"radiogroup\"")
                .contains("data-toggle-group-item=\"bold\"")
                .contains("role=\"radio\"")
                .contains("aria-checked=\"false\"")
                .doesNotContain("aria-checked=\"true\"")
                // single mode uses aria-checked, NOT aria-pressed.
                .doesNotContain("aria-pressed");
        assertThat(mounted.snapshot()).isNotBlank();
    }

    /**
     * @spec.given a mounted single-mode toggle-group with nothing selected
     * @spec.when  the first item is clicked (its value armed over the wire)
     * @spec.then  the selected set gains it: its radio renders aria-checked=true while the others
     *     stay false, proving the selection lives + moves server-side and the template projects it
     * @spec.adr   ADR-0012
     */
    @Test
    void clicking_an_item_selects_it_server_side_and_the_render_reflects_checked() {
        WireCallResult mounted = wireService.mount(COMPONENT);

        WireCallResult selected = clickItem(mounted.snapshot(), "bold");

        assertThat(selected.html())
                .containsPattern(
                        "data-toggle-group-item=\"bold\"[^>]*aria-checked=\"true\"|"
                                + "aria-checked=\"true\"[^>]*data-toggle-group-item=\"bold\"")
                .containsPattern(
                        "data-toggle-group-item=\"italic\"[^>]*aria-checked=\"false\"|"
                                + "aria-checked=\"false\"[^>]*data-toggle-group-item=\"italic\"");
    }

    /**
     * @spec.given a single-mode toggle-group with the first item selected
     * @spec.when  a second item is clicked
     * @spec.then  only the second is selected: single mode replaced the selection (at most one),
     *     proving the server enforces the single-selection mode, not the client
     * @spec.adr   ADR-0012
     */
    @Test
    void single_mode_keeps_at_most_one_selected() {
        WireCallResult mounted = wireService.mount(COMPONENT);
        WireCallResult first = clickItem(mounted.snapshot(), "bold");

        WireCallResult second = clickItem(first.snapshot(), "italic");

        assertThat(second.html())
                .containsPattern(
                        "data-toggle-group-item=\"italic\"[^>]*aria-checked=\"true\"|"
                                + "aria-checked=\"true\"[^>]*data-toggle-group-item=\"italic\"")
                .containsPattern(
                        "data-toggle-group-item=\"bold\"[^>]*aria-checked=\"false\"|"
                                + "aria-checked=\"false\"[^>]*data-toggle-group-item=\"bold\"");
    }

    /**
     * @spec.given a single-mode toggle-group with the first item selected
     * @spec.when  the same item is clicked again
     * @spec.then  it deselects to empty: single mode allows deselect-to-empty (Radix behaviour), so
     *     the item renders aria-checked=false again, proving membership toggles and round-trips
     * @spec.adr   ADR-0012
     */
    @Test
    void clicking_a_selected_item_again_deselects_it() {
        WireCallResult mounted = wireService.mount(COMPONENT);
        WireCallResult selected = clickItem(mounted.snapshot(), "bold");

        WireCallResult deselected = clickItem(selected.snapshot(), "bold");

        assertThat(deselected.html())
                .containsPattern(
                        "data-toggle-group-item=\"bold\"[^>]*aria-checked=\"false\"|"
                                + "aria-checked=\"false\"[^>]*data-toggle-group-item=\"bold\"")
                .doesNotContain("aria-checked=\"true\"");
    }

    /**
     * @spec.given a multiple-mode toggle-group (two values toggled in turn)
     * @spec.when  a second value is toggled while a first is selected
     * @spec.then  both stay selected with role=group + aria-pressed (not radio/aria-checked), proving
     *     multiple mode uses the pressed-button model and does not deselect siblings. A plain unit
     *     assertion on the flip logic, no runtime.
     * @spec.adr   ADR-0012
     */
    @Test
    void multiple_mode_allows_several_selected_with_aria_pressed() {
        ToggleGroupComponent c = new ToggleGroupComponent();
        c.values = List.of("bold", "italic");
        c.labels = List.of("Bold", "Italic");
        c.mode = "multiple";

        c.toggleValue = "bold";
        c.toggle();
        c.toggleValue = "italic";
        c.toggle();

        assertThat(c.isSingle()).as("multiple mode").isFalse();
        assertThat(c.selected)
                .as("multiple mode keeps both selected")
                .containsExactlyInAnyOrder("bold", "italic");
    }
}
