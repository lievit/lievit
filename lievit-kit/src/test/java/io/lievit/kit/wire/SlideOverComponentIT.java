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
 * The SlideOver (Filament slide-over parity, roadmap K2) end-to-end gate: the kit-level
 * {@link SlideOverComponent} driven through the REAL lievit runtime. It proves the panel slides in
 * from the RIGHT (reusing the drawer wire's open-state-server model + structure), hosts a record's
 * resolved {@link io.lievit.kit.schema.infolist.Infolist Infolist} (the "view in panel" outcome,
 * the values PROJECTED), and closes.
 *
 * <p>It boots a Spring context, so it is an {@code *IT} (the failsafe loop, ADR-0007).
 */
@SpringBootTest(classes = SlideOverWireTestApp.class)
@TestPropertySource(
        properties = {"lievit.signing-key=test-signing-key-0123456789abcdef-0123456789"})
class SlideOverComponentIT {

    @Autowired LievitWireService wireService;

    private static final String COMPONENT = SlideOverComponent.class.getName();

    /**
     * @spec.given the slide-over wire component mounted with its default (closed) state
     * @spec.when  it is rendered by JTE through the real runtime
     * @spec.then  the overlay is `hidden`, it reuses the drawer structure right-anchored
     *     (role=dialog, data-lv-drawer-side="right"), and the owned body region is present, proving
     *     it is the right-edge drawer specialization rendered closed-but-built
     * @spec.us   US-K2-slide-over
     */
    @Test
    void renders_hidden_right_anchored_on_mount() {
        WireCallResult mounted = wireService.mount(COMPONENT);

        assertThat(mounted.html())
                .contains("data-lv-slide-over")
                .containsPattern("data-lv-drawer\\b[^>]*\\bhidden\\b")
                .contains("role=\"dialog\"")
                .contains("aria-modal=\"true\"")
                .contains("data-lv-drawer-side=\"right\"")
                .contains("data-lv-slide-over-body");
        assertThat(mounted.snapshot()).isNotBlank();
    }

    /**
     * @spec.given a mounted slide-over, a record id + heading set over the wire
     * @spec.when  the open action runs
     * @spec.then  the panel opens (the `hidden` attribute drops) AND its body hosts the record's
     *     resolved infolist entries (the PROJECTED values Ref=1 and City=Parma, the "view in panel"
     *     outcome), proving the slide-over slides in from the right hosting the Infolist content
     * @spec.us   US-K2-slide-over
     */
    @Test
    void open_slides_in_from_the_right_hosting_the_record_infolist() {
        WireCallResult mounted = wireService.mount(COMPONENT);

        WireCallResult opened =
                wireService.call(
                        mounted.snapshot(),
                        Map.of("recordId", "1", "heading", "Listing detail"),
                        List.of("open"),
                        "test-client");

        assertThat(opened.html())
                // Open: the hidden attribute is gone, the right-anchored panel is exposed.
                .doesNotContainPattern("data-lv-drawer\\b[^>]*\\bhidden\\b")
                .contains("data-lv-drawer-side=\"right\"")
                .contains("role=\"dialog\"")
                // The heading drives the a11y label.
                .contains(">Listing detail</h2>")
                .contains("aria-labelledby=\"lv-slide-over-heading\"")
                // The hosted Infolist: the resolved (projected) entries of the Parma row.
                .contains("data-lv-slide-over-entries")
                .contains("data-lv-slide-over-entry=\"Ref\"")
                .contains("<dd>1</dd>")
                .contains("data-lv-slide-over-entry=\"City\"")
                .contains("<dd>Parma</dd>")
                .doesNotContain("data-lv-slide-over-empty");
    }

    /**
     * @spec.given an opened slide-over hosting a record
     * @spec.when  close runs over the wire
     * @spec.then  the panel hides again (`hidden` re-added), proving the open transition round-trips
     *     through the snapshot in both directions, exactly as the drawer wire it builds on
     * @spec.us   US-K2-slide-over
     */
    @Test
    void close_hides_the_panel_again() {
        WireCallResult mounted = wireService.mount(COMPONENT);
        WireCallResult opened =
                wireService.call(
                        mounted.snapshot(),
                        Map.of("recordId", "1"),
                        List.of("open"),
                        "test-client");

        WireCallResult closed =
                wireService.call(opened.snapshot(), Map.of(), List.of("close"), "test-client");

        assertThat(closed.html()).containsPattern("data-lv-drawer\\b[^>]*\\bhidden\\b");
    }

    /**
     * @spec.given a slide-over whose `side` field is locked to "right" (the slide-over is the
     *     right-edge specialization of the drawer)
     * @spec.when  a client tries to flip it to "left" over the wire
     * @spec.then  the call is rejected with the LOCKED_PROPERTY terminal error: a client cannot turn
     *     the slide-over into a left drawer by editing the snapshot, the server owns the edge
     * @spec.us   US-K2-slide-over
     */
    @Test
    void the_right_side_is_locked() {
        WireCallResult mounted = wireService.mount(COMPONENT);

        org.assertj.core.api.Assertions.assertThatThrownBy(
                        () ->
                                wireService.call(
                                        mounted.snapshot(),
                                        Map.of("side", "left"),
                                        List.of("open"),
                                        "test-client"))
                .isInstanceOf(io.lievit.wire.WireException.class)
                .extracting(e -> ((io.lievit.wire.WireException) e).error())
                .isEqualTo(io.lievit.wire.WireError.LOCKED_PROPERTY);
    }

    /**
     * @spec.given a fresh slide-over instance bound to the listings resource
     * @spec.when  showRecord opens the panel for a record id (the kit "view in panel" API)
     * @spec.then  the server state opens and the resolved content carries the record's infolist
     *     entries, proving the open-with-Infolist API resolves + opens in one call (a plain unit
     *     assertion, no runtime needed)
     * @spec.us   US-K2-slide-over
     */
    @Test
    void show_record_resolves_and_opens_the_panel() {
        // Build the component directly over the resource to exercise the head-less API.
        // (The runtime ITs above prove the wire path; this pins the API contract.)
        SlideOverComponent component = new SlideOverComponent(slideOverResource());

        component.showRecord("2");

        assertThat(component.open).isTrue();
        assertThat(component.recordId).isEqualTo("2");
        assertThat(component.content()).isNotNull();
        assertThat(component.content().entries())
                .containsEntry("Ref", "2")
                .containsEntry("City", "Reggio Emilia");
    }

    /** Builds a resource head-lessly for the unit assertion above (mirrors the test app wiring). */
    private static io.lievit.kit.hello.ListingResource slideOverResource() {
        return new io.lievit.kit.hello.ListingResource(
                new io.lievit.kit.hello.InMemoryListingRepository(),
                jakarta.validation.Validation.buildDefaultValidatorFactory().getValidator());
    }
}
