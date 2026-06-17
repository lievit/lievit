/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package com.iambilotta.lievit.wire;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;

/**
 * Specifies the structural payload caps and the deserialization allowlist (ADR-0013): too many
 * updates / calls and over-deep nesting are PAYLOAD_TOO_COMPLEX (413), and a value that is not a
 * JSON scalar / list / map is FORBIDDEN_DESERIALIZATION (422). These are the DoS and gadget-chain
 * guards the dispatcher runs before any value is bound to a field.
 */
class PayloadGuardTest {

    private final PayloadGuard guard = new PayloadGuard(3, 2, 3);

    /**
     * @spec.given a payload within every cap, carrying only plain JSON data
     * @spec.when  the guard checks the inbound surface
     * @spec.then  it passes (no exception): well-formed plain-data payloads are not penalized
     * @spec.adr   ADR-0013
     */
    @Test
    void passes_a_well_formed_plain_data_payload() {
        Map<String, Object> updates = Map.of("a", 1, "b", "two", "c", List.of(1, 2, 3));

        assertThatCode(() -> guard.checkInbound(updates, List.of("save")))
                .doesNotThrowAnyException();
    }

    /**
     * @spec.given more _updates entries than the configured cap (4 > 3)
     * @spec.when  the guard checks the inbound surface
     * @spec.then  it rejects with PAYLOAD_TOO_COMPLEX (413): a DoS guard on update count
     * @spec.adr   ADR-0013
     */
    @Test
    void rejects_too_many_updates() {
        Map<String, Object> updates = Map.of("a", 1, "b", 2, "c", 3, "d", 4);

        assertThatThrownBy(() -> guard.checkInbound(updates, List.of()))
                .isInstanceOf(WireException.class)
                .extracting(e -> ((WireException) e).error())
                .isEqualTo(WireError.PAYLOAD_TOO_COMPLEX);
    }

    /**
     * @spec.given more _calls entries than the configured cap (3 > 2)
     * @spec.when  the guard checks the inbound surface
     * @spec.then  it rejects with PAYLOAD_TOO_COMPLEX (413): a DoS guard on call count
     * @spec.adr   ADR-0013
     */
    @Test
    void rejects_too_many_calls() {
        assertThatThrownBy(() -> guard.checkInbound(Map.of(), List.of("a", "b", "c")))
                .isInstanceOf(WireException.class)
                .extracting(e -> ((WireException) e).error())
                .isEqualTo(WireError.PAYLOAD_TOO_COMPLEX);
    }

    /**
     * @spec.given an update value nested deeper than the depth cap (4 levels > 3)
     * @spec.when  the guard checks the inbound surface
     * @spec.then  it rejects with PAYLOAD_TOO_COMPLEX (413): bounds the recursion against a
     *     stack-blowing deep map
     * @spec.adr   ADR-0013
     */
    @Test
    void rejects_over_deep_nesting() {
        Map<String, Object> deep = Map.of("l2", Map.of("l3", Map.of("l4", "too deep")));

        assertThatThrownBy(() -> guard.checkInbound(Map.of("l1", deep), List.of()))
                .isInstanceOf(WireException.class)
                .extracting(e -> ((WireException) e).error())
                .isEqualTo(WireError.PAYLOAD_TOO_COMPLEX);
    }

    /**
     * @spec.given an update value that is an opaque (non-JSON) Java object
     * @spec.when  the guard checks the inbound surface
     * @spec.then  it rejects with FORBIDDEN_DESERIALIZATION (422): the snapshot is state-never-code,
     *     and only JSON scalars / lists / maps may be bound (the JVM gadget defense)
     * @spec.adr   ADR-0013
     */
    @Test
    void rejects_an_opaque_object_value() {
        Map<String, Object> updates = new HashMap<>();
        updates.put("gadget", new Object());

        assertThatThrownBy(() -> guard.checkInbound(updates, List.of()))
                .isInstanceOf(WireException.class)
                .extracting(e -> ((WireException) e).error())
                .isEqualTo(WireError.FORBIDDEN_DESERIALIZATION);
    }

    /**
     * @spec.given an opaque object hidden inside a nested list (one level down)
     * @spec.when  the guard checks the inbound surface
     * @spec.then  it still rejects with FORBIDDEN_DESERIALIZATION (422): the allowlist is recursive,
     *     a gadget cannot hide under a list or map node
     * @spec.adr   ADR-0013
     */
    @Test
    void rejects_an_opaque_object_nested_in_a_list() {
        List<Object> nested = new ArrayList<>();
        nested.add(new Object());

        assertThatThrownBy(() -> guard.checkInbound(Map.of("items", nested), List.of()))
                .isInstanceOf(WireException.class)
                .extracting(e -> ((WireException) e).error())
                .isEqualTo(WireError.FORBIDDEN_DESERIALIZATION);
    }

    /**
     * @spec.given a rehydrated snapshot wire map carrying an opaque object value
     * @spec.when  the guard checks the snapshot wire
     * @spec.then  it rejects with FORBIDDEN_DESERIALIZATION (422): a signed payload must still never
     *     deserialize a gadget (defense in depth if the signing key leaks)
     * @spec.adr   ADR-0013
     */
    @Test
    void rejects_a_gadget_in_the_signed_snapshot_wire() {
        Map<String, Object> wire = new HashMap<>();
        wire.put("ok", "fine");
        wire.put("gadget", new Object());

        assertThatThrownBy(() -> guard.checkSnapshotWire(wire))
                .isInstanceOf(WireException.class)
                .extracting(e -> ((WireException) e).error())
                .isEqualTo(WireError.FORBIDDEN_DESERIALIZATION);
    }

    /**
     * @spec.given the structural caps as configured (3 updates, 2 calls, depth 3)
     * @spec.when  the protocol-default guard's published constants are read
     * @spec.then  they match the wire-protocol §6 / Livewire-parity values (50 calls, depth 10)
     * @spec.adr   ADR-0013
     */
    @Test
    void publishes_the_protocol_default_caps() {
        assertThat(PayloadGuard.DEFAULT_MAX_CALLS).isEqualTo(50);
        assertThat(PayloadGuard.DEFAULT_MAX_NESTING_DEPTH).isEqualTo(10);
        assertThat(PayloadGuard.DEFAULT_MAX_UPDATES).isEqualTo(100);
    }
}
