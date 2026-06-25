/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.wire;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;

import org.junit.jupiter.api.Test;

/**
 * Specifies the snapshot codec: HS256 signing, roundtrip, tamper-evidence, expiry, and {@code kid}
 * rotation. These are the load-bearing wire-protocol invariants (ADR-0001, ADR-0007,
 * wire-protocol.md sections 2 and 3).
 */
class SnapshotCodecTest {

    private static final byte[] KEY_A =
            "0123456789abcdef0123456789abcdef".getBytes(); // >= 32 bytes
    private static final byte[] KEY_B =
            "fedcba9876543210fedcba9876543210".getBytes();

    private SnapshotCodec codecWith(byte[] current) {
        return new SnapshotCodec(SigningKeys.of("A", current), Duration.ofHours(1));
    }

    private Snapshot sampleState() {
        return Snapshot.fresh(
                "0K3W2A9V8C7B6N5M4Q3P2R1S0T",
                "com.example.CounterComponent",
                Map.of("count", 7),
                Instant.parse("2026-06-17T10:00:00Z"),
                Duration.ofHours(1));
    }

    /**
     * @spec.given a snapshot carrying component state
     * @spec.when  it is signed and then verified+decoded with the same key
     * @spec.then  the decoded snapshot equals the original (state survives the roundtrip)
     * @spec.adr   ADR-0001
     */
    @Test
    void signs_then_verifies_a_snapshot_roundtrip() {
        SnapshotCodec codec = codecWith(KEY_A);
        Snapshot original = sampleState();

        String signed = codec.sign(original);
        Snapshot decoded = codec.verify(signed, Instant.parse("2026-06-17T10:30:00Z"));

        assertThat(decoded.cid()).isEqualTo(original.cid());
        assertThat(decoded.cls()).isEqualTo(original.cls());
        assertThat(decoded.wire()).isEqualTo(original.wire());
        assertThat(decoded.iat()).isEqualTo(original.iat());
        assertThat(decoded.exp()).isEqualTo(original.exp());
    }

    /**
     * @spec.given a signed snapshot whose payload byte has been altered
     * @spec.when  the codec verifies it
     * @spec.then  it rejects the snapshot as tampered (HMAC mismatch), never returning state
     * @spec.adr   ADR-0001
     */
    @Test
    void rejects_a_tampered_snapshot() {
        SnapshotCodec codec = codecWith(KEY_A);
        String signed = codec.sign(sampleState());
        String tampered = flipOnePayloadChar(signed);

        assertThatThrownBy(() -> codec.verify(tampered, Instant.parse("2026-06-17T10:30:00Z")))
                .isInstanceOf(WireException.class)
                .extracting(e -> ((WireException) e).error())
                .isEqualTo(WireError.SNAPSHOT_FORGED);
    }

    /**
     * @spec.given a signed snapshot read after its expiry instant
     * @spec.when  the codec verifies it
     * @spec.then  it is rejected with the snapshot-expired error (maps to 409)
     * @spec.adr   ADR-0001
     */
    @Test
    void rejects_an_expired_snapshot() {
        SnapshotCodec codec = codecWith(KEY_A);
        String signed = codec.sign(sampleState());

        assertThatThrownBy(() -> codec.verify(signed, Instant.parse("2026-06-17T11:00:01Z")))
                .isInstanceOf(WireException.class)
                .extracting(e -> ((WireException) e).error())
                .isEqualTo(WireError.SNAPSHOT_EXPIRED);
    }

    /**
     * @spec.given a snapshot signed with the previous key, within the 24 h grace window
     * @spec.when  a codec holding the new key plus the previous key verifies it (by kid)
     * @spec.then  it verifies against the previous key and returns the state
     * @spec.adr   ADR-0001
     */
    @Test
    void verifies_a_previous_key_snapshot_within_grace() {
        SnapshotCodec oldCodec = codecWith(KEY_A);
        String signedWithA = oldCodec.sign(sampleState());

        SnapshotCodec rotated =
                new SnapshotCodec(
                        SigningKeys.rotated("B", KEY_B, "A", KEY_A), Duration.ofHours(1));

        Snapshot decoded = rotated.verify(signedWithA, Instant.parse("2026-06-17T10:30:00Z"));
        assertThat(decoded.cls()).isEqualTo("com.example.CounterComponent");
    }

    /**
     * @spec.given a snapshot signed with a key whose kid is unknown to the verifier
     * @spec.when  the codec verifies it after the grace window (previous key removed)
     * @spec.then  it is rejected as forged: an unknown kid cannot be honored
     * @spec.adr   ADR-0001
     */
    @Test
    void rejects_a_snapshot_signed_with_a_retired_key() {
        SnapshotCodec oldCodec = codecWith(KEY_A);
        String signedWithA = oldCodec.sign(sampleState());

        SnapshotCodec afterGrace = codecWith(KEY_B); // only kid B known now

        assertThatThrownBy(
                        () ->
                                afterGrace.verify(
                                        signedWithA, Instant.parse("2026-06-17T10:30:00Z")))
                .isInstanceOf(WireException.class)
                .extracting(e -> ((WireException) e).error())
                .isEqualTo(WireError.SNAPSHOT_FORGED);
    }

    /**
     * @spec.given a fresh snapshot built with a 1 h idle TTL
     * @spec.when  its expiry is computed
     * @spec.then  exp equals iat plus the TTL
     * @spec.adr   ADR-0001
     */
    @Test
    void sets_expiry_to_issued_at_plus_ttl() {
        Snapshot s = sampleState();
        assertThat(s.exp()).isEqualTo(s.iat().plus(Duration.ofHours(1)));
    }

    /**
     * @spec.given two independent component snapshots, a parent and a child, each with its own cid /
     *     cls / wire state (the child mounted under the parent; ADR-0016 nested components)
     * @spec.when  each is signed and verified independently
     * @spec.then  both roundtrip to their own state and stay distinct: a child carries its own
     *     snapshot, never a fragment of the parent's, so the statelessness invariant holds per
     *     component
     * @spec.adr   ADR-0016
     */
    @Test
    void signs_independent_parent_and_child_snapshots() {
        SnapshotCodec codec = codecWith(KEY_A);
        Instant iat = Instant.parse("2026-06-17T10:00:00Z");

        Snapshot parent =
                Snapshot.fresh(
                        "0PARENT9V8C7B6N5M4Q3P2R1S0T",
                        "com.example.ListComponent",
                        Map.of("rows", 2),
                        iat,
                        Duration.ofHours(1));
        Snapshot child =
                Snapshot.fresh(
                        "0CHILD89V8C7B6N5M4Q3P2R1S0T",
                        "com.example.RowComponent",
                        Map.of("label", "row 0"),
                        iat,
                        Duration.ofHours(1));

        Snapshot decodedParent =
                codec.verify(codec.sign(parent), Instant.parse("2026-06-17T10:30:00Z"));
        Snapshot decodedChild =
                codec.verify(codec.sign(child), Instant.parse("2026-06-17T10:30:00Z"));

        assertThat(decodedParent.cls()).isEqualTo("com.example.ListComponent");
        assertThat(decodedParent.wire()).containsEntry("rows", 2).doesNotContainKey("label");
        assertThat(decodedChild.cls()).isEqualTo("com.example.RowComponent");
        assertThat(decodedChild.wire()).containsEntry("label", "row 0");
        assertThat(decodedChild.cid()).isNotEqualTo(decodedParent.cid());
    }

    /**
     * @spec.given a snapshot whose wire state nests a prop map a parent passed down (ADR-0016)
     * @spec.when  it is signed and verified
     * @spec.then  the nested structure roundtrips intact (the wire is JSON-shaped, props included)
     * @spec.adr   ADR-0016
     */
    @Test
    void roundtrips_a_snapshot_with_nested_prop_state() {
        SnapshotCodec codec = codecWith(KEY_A);
        Snapshot s =
                Snapshot.fresh(
                        "0NESTED99V8C7B6N5M4Q3P2R1S0T",
                        "com.example.RowComponent",
                        Map.of("item", Map.of("id", 7, "name", "parma")),
                        Instant.parse("2026-06-17T10:00:00Z"),
                        Duration.ofHours(1));

        Snapshot decoded = codec.verify(codec.sign(s), Instant.parse("2026-06-17T10:30:00Z"));

        @SuppressWarnings("unchecked")
        Map<String, Object> item = (Map<String, Object>) decoded.wire().get("item");
        assertThat(item).containsEntry("name", "parma");
        assertThat(((Number) item.get("id")).intValue()).isEqualTo(7);
    }

    private static String flipOnePayloadChar(String jwt) {
        String[] parts = jwt.split("\\.");
        char[] payload = parts[1].toCharArray();
        // flip a char to a different base64url char, keeping it decodable but signature-breaking
        payload[0] = payload[0] == 'a' ? 'b' : 'a';
        return parts[0] + "." + new String(payload) + "." + parts[2];
    }
}
