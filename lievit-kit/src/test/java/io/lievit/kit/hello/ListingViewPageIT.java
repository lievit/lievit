/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit.hello;

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
 * The ViewPage (Filament {@code ViewRecord}) tracer-bullet (roadmap K1): the worked
 * {@link ListingResource}'s detail page is driven through the REAL lievit runtime (codec + registry
 * + dispatcher + JTE adapter), proving an {@link io.lievit.kit.schema.infolist.Infolist Infolist} is
 * resolved over one record under VIEW and the {@link io.lievit.kit.AdminViewView} is rendered as the
 * detail sections + entries + header actions, the VALUES projected end to end (the silent-slot
 * lesson: assert the rendered DOM, not the structure).
 *
 * <p>It boots a Spring context, so it is an {@code *IT} (the failsafe loop of ADR-0007).
 */
@SpringBootTest(classes = HelloAdminTestApp.class)
@TestPropertySource(
        properties = {"lievit.signing-key=test-signing-key-0123456789abcdef-0123456789"})
class ListingViewPageIT {

    @Autowired LievitWireService wireService;

    private static final String VIEW = ListingViewComponent.class.getName();

    /**
     * @spec.given the worked ListingResource (an infolist of ref + city over the Parma row) and its
     *     view-page component mounted, the record id seeded over the wire
     * @spec.when  the load action resolves the detail view-model and JTE renders it
     * @spec.then  the response is the detail surface with the heading, the resolved entries (the
     *     PROJECTED values Ref=1 and City=Parma, not the structure), the two-column section layout,
     *     and the header actions (Edit -> the bare-id-plus-/edit route, Back -> the list)
     * @spec.us   US-K1-view-page
     */
    @Test
    void renders_the_resolved_infolist_detail_through_the_runtime() {
        WireCallResult mounted = wireService.mount(VIEW);

        WireCallResult loaded =
                wireService.call(
                        mounted.snapshot(), Map.of("recordId", "1"), List.of("load"), "test-client");

        assertThat(loaded.html())
                .contains("data-admin-view")
                .contains("<h1 data-admin-heading>Listings</h1>")
                // The section carries the infolist's column layout.
                .contains("data-admin-view-columns=\"2\"")
                // The entries are the PROJECTED label-to-value pairs, resolved from the record.
                .contains("data-admin-view-entry=\"Ref\"")
                .contains("<dd>1</dd>")
                .contains("data-admin-view-entry=\"City\"")
                .contains("<dd>Parma</dd>")
                // Header actions: Edit (primary) to the URL-addressable edit route, Back to the list.
                .contains("data-admin-view-action=\"Edit\"")
                .contains("href=\"/admin/listings/1/edit\"")
                .contains("data-admin-view-action=\"Back\"")
                .contains("href=\"/admin/listings\"");
        assertThat(loaded.snapshot()).isNotBlank();
    }

    /**
     * @spec.given the view-page component mounted, a placeholder entry (city) and a row whose city is
     *     present (so the placeholder is NOT used) loaded
     * @spec.when  the detail renders the second row (Reggio Emilia)
     * @spec.then  it projects that row's values, proving the resolution is per-record (a different id
     *     yields a different rendered value, not a cached one)
     * @spec.us   US-K1-view-page
     */
    @Test
    void resolves_per_record_so_a_different_id_renders_a_different_value() {
        WireCallResult mounted = wireService.mount(VIEW);

        WireCallResult loaded =
                wireService.call(
                        mounted.snapshot(), Map.of("recordId", "2"), List.of("load"), "test-client");

        assertThat(loaded.html())
                .contains("<dd>Reggio Emilia</dd>")
                .contains("<dd>2</dd>")
                .doesNotContain("<dd>Parma</dd>")
                .contains("href=\"/admin/listings/2/edit\"");
    }

    /**
     * @spec.given the view-page component mounted and a non-existent record id loaded
     * @spec.when  the detail resolves
     * @spec.then  it renders the not-found empty state instead of throwing, and no entries surface
     * @spec.us   US-K1-view-page
     */
    @Test
    void renders_the_not_found_empty_state_for_a_missing_record() {
        WireCallResult mounted = wireService.mount(VIEW);

        WireCallResult loaded =
                wireService.call(
                        mounted.snapshot(), Map.of("recordId", "999"), List.of("load"), "test-client");

        assertThat(loaded.html())
                .contains("data-admin-not-found")
                .doesNotContain("data-admin-view-entry=");
    }
}
