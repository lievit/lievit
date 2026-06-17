/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.component;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;

import io.lievit.LievitAction;
import io.lievit.LievitComponent;
import io.lievit.Wire;

/**
 * Pins the typed-state round-trip invariant through the full dispatcher: a {@code @Wire} property
 * that is a record / enum / date / money VO dehydrates to a tuple and rehydrates to the exact type,
 * surviving a second wire call. This is the confirmed kit-CRUD blocker: before the synthesizer
 * registry, the value rehydrated as a {@code LinkedHashMap} and the second action died (ADR-0020,
 * issue #163).
 */
class TypedStateRoundTripInvariantTest {

    private final WireDispatcher dispatcher = new WireDispatcher();

    enum Status {
        DRAFT,
        ACTIVE,
        ARCHIVED
    }

    record Listing(String title, BigDecimal price, Status status) {}

    @LievitComponent
    static class ListingEditor {
        @Wire Listing listing = new Listing("Villa", new BigDecimal("450000.00"), Status.DRAFT);
        @Wire LocalDate publishOn = LocalDate.of(2026, 1, 1);

        @LievitAction
        void activate() {
            this.listing = new Listing(listing.title(), listing.price(), Status.ACTIVE);
        }

        @LievitAction
        void bumpDay() {
            this.publishOn = this.publishOn.plusDays(1);
        }
    }

    /**
     * @spec.given a ListingEditor mounted with a record + enum + BigDecimal + LocalDate state
     * @spec.when  it is mounted
     * @spec.then  the wire carries typed tuples (not bare maps) for the record and the date, and the
     *     scalar title rides plain inside the record tuple
     * @spec.adr   ADR-0020
     */
    @Test
    void mount_dehydrates_typed_state_to_tuples() {
        ComponentMetadata meta = ComponentMetadata.of(ListingEditor.class);

        WireCall mounted = dispatcher.mount(meta, new ListingEditor());

        assertThat(io.lievit.wire.synth.Dehydrated.isEnvelope(mounted.wire().get("listing")))
                .isTrue();
        assertThat(io.lievit.wire.synth.Dehydrated.isEnvelope(mounted.wire().get("publishOn")))
                .isTrue();
    }

    /**
     * @spec.given the mounted typed wire fed back as a snapshot (the codec round-trips it as JSON)
     * @spec.when  a first call invokes activate, then its output wire feeds a second call invoking
     *     bumpDay (two requests, the kit-CRUD second-action scenario)
     * @spec.then  the record and date reconstruct to the exact types on every call: the second
     *     action sees a real LocalDate (plusDays works) and a real Listing record (status mutated),
     *     never a LinkedHashMap
     * @spec.adr   ADR-0020
     */
    @Test
    void typed_state_survives_two_wire_calls_as_the_exact_types() {
        ComponentMetadata meta = ComponentMetadata.of(ListingEditor.class);

        WireCall mounted = dispatcher.mount(meta, new ListingEditor());

        // First call: activate. The dispatcher must rehydrate the record tuple to a Listing.
        WireCall first =
                dispatcher.call(
                        meta, new ListingEditor(), mounted.wire(), Map.of(), List.of("activate"));

        // Second call: feed the FIRST call's output wire back (the next snapshot) and bump the date.
        WireCall second =
                dispatcher.call(
                        meta, new ListingEditor(), first.wire(), Map.of(), List.of("bumpDay"));

        // Reconstruct the final typed state from the second call's wire to assert the exact types.
        ListingEditor finalInstance = new ListingEditor();
        dispatcher.call(meta, finalInstance, second.wire(), Map.of(), List.of());

        assertThat(finalInstance.listing).isInstanceOf(Listing.class);
        assertThat(finalInstance.listing.status()).isEqualTo(Status.ACTIVE);
        assertThat(finalInstance.listing.price()).isEqualTo(new BigDecimal("450000.00"));
        assertThat(finalInstance.publishOn).isInstanceOf(LocalDate.class);
        assertThat(finalInstance.publishOn).isEqualTo(LocalDate.of(2026, 1, 2));
    }

    /**
     * @spec.given a ListingEditor and a wire:model update writing a raw ISO date string to publishOn
     * @spec.when  the dispatcher applies the update
     * @spec.then  the field rehydrates to a LocalDate (the typed-update path), not a String, so a
     *     later plusDays does not blow up
     * @spec.adr   ADR-0020
     */
    @Test
    void a_raw_date_string_update_rehydrates_to_local_date() {
        ComponentMetadata meta = ComponentMetadata.of(ListingEditor.class);
        ListingEditor instance = new ListingEditor();
        WireCall mounted = dispatcher.mount(meta, new ListingEditor());

        dispatcher.call(
                meta,
                instance,
                mounted.wire(),
                Map.of("publishOn", "2026-12-25"),
                List.of("bumpDay"));

        assertThat(instance.publishOn).isEqualTo(LocalDate.of(2026, 12, 26));
    }
}
