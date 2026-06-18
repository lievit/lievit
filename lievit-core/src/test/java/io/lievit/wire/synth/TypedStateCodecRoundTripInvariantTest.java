/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.wire.synth;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;

import io.lievit.wire.SigningKeys;
import io.lievit.wire.Snapshot;
import io.lievit.wire.SnapshotCodec;

/**
 * The golden typed-state round-trip THROUGH the real {@link SnapshotCodec}: a dehydrated tuple is
 * signed as an HS256 JWT, the JWT is verified and its claims decoded back to plain JSON (JJWT /
 * Jackson), and the registry hydrates the decoded JSON to the exact Java type. This proves the
 * tuple shape survives the actual codec serialization, not just an in-memory registry round-trip
 * (ADR-0020, the load-bearing golden invariant of PLAN.md).
 */
class TypedStateCodecRoundTripInvariantTest {

    private static final byte[] KEY =
            "0123456789abcdef0123456789abcdef".getBytes(); // >= 32 bytes

    private final SynthesizerRegistry registry = new SynthesizerRegistry();
    private final SnapshotCodec codec =
            new SnapshotCodec(SigningKeys.of("A", KEY), Duration.ofHours(1));

    enum Status {
        DRAFT,
        ACTIVE
    }

    record Listing(String title, BigDecimal price, Status status, LocalDate publishOn) {}

    /**
     * @spec.given a record holding a BigDecimal, an enum, and a LocalDate, dehydrated to a tuple and
     *     put into a snapshot wire
     * @spec.when  the snapshot is signed, verified, and the decoded wire is hydrated
     * @spec.then  the record reconstructs to the exact type with every field intact: the tuple shape
     *     survives JJWT + Jackson, so a typed @Wire field round-trips across a real signed wire
     * @spec.adr   ADR-0020
     */
    @Test
    void a_typed_record_round_trips_through_the_signed_codec() {
        Listing original =
                new Listing(
                        "Villa",
                        new BigDecimal("450000.00"),
                        Status.ACTIVE,
                        LocalDate.of(2026, 6, 18));
        Object tuple = registry.dehydrate(original);
        Snapshot snapshot =
                Snapshot.fresh(
                        "0K3W2A9V8C7B6N5M4Q3P2R1S0T",
                        "com.example.ListingEditor",
                        Map.of("listing", tuple),
                        Instant.parse("2026-06-17T10:00:00Z"),
                        Duration.ofHours(1));

        String signed = codec.sign(snapshot);
        Snapshot decoded = codec.verify(signed, Instant.parse("2026-06-17T10:30:00Z"));
        Object hydrated = registry.hydrate(decoded.wire().get("listing"));

        assertThat(hydrated).isInstanceOf(Listing.class);
        assertThat(hydrated).isEqualTo(original);
    }

    /**
     * @spec.given a list of enums dehydrated into a snapshot wire
     * @spec.when  it is signed, verified, and hydrated
     * @spec.then  each element reconstructs to its enum constant through the real codec
     * @spec.adr   ADR-0020
     */
    @Test
    void a_list_of_enums_round_trips_through_the_signed_codec() {
        Object tuple = registry.dehydrate(List.of(Status.DRAFT, Status.ACTIVE));
        Snapshot snapshot =
                Snapshot.fresh(
                        "0K3W2A9V8C7B6N5M4Q3P2R1S0T",
                        "com.example.X",
                        Map.of("history", tuple),
                        Instant.parse("2026-06-17T10:00:00Z"),
                        Duration.ofHours(1));

        Snapshot decoded =
                codec.verify(codec.sign(snapshot), Instant.parse("2026-06-17T10:30:00Z"));
        Object hydrated = registry.hydrate(decoded.wire().get("history"));

        assertThat(hydrated).isEqualTo(List.of(Status.DRAFT, Status.ACTIVE));
    }
}
