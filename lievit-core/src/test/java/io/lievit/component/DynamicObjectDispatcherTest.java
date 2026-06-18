/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.component;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;

import io.lievit.LievitComponent;
import io.lievit.Wire;
import io.lievit.wire.synth.DynamicObject;

/**
 * Specifies dynamic-object binding (the stdClass analogue, issue #137): a {@code @Wire}
 * {@link DynamicObject} field accepts dotted-path {@code l:model.live} updates that create missing
 * nested keys, dehydrates to a plain JSON map, and round-trips through dehydrate / hydrate. Only a
 * {@code @Wire} field is settable (ADR-0013); a dynamic object never stores a typed Java object.
 */
class DynamicObjectDispatcherTest {

    private final WireDispatcher dispatcher = new WireDispatcher();

    @LievitComponent(template = "ad-hoc")
    static class AdHocComponent {
        @Wire
        DynamicObject obj = new DynamicObject();
    }

    @LievitComponent(template = "ad-hoc-null")
    static class NullDynamicComponent {
        @Wire
        DynamicObject obj; // intentionally null until first set
    }

    /**
     * @spec.given a component with an initially-empty @Wire DynamicObject and an _updates entry
     *     {@code {"obj.name": "parma"}}
     * @spec.when  the dispatcher applies the update and reads back the wire
     * @spec.then  the new snapshot carries the value at obj.name: the dotted set on an empty dynamic
     *     object round-trips
     * @spec.adr   ADR-0020
     */
    @Test
    void sets_a_nested_key_on_an_initially_empty_dynamic_object_and_round_trips() {
        ComponentMetadata meta = ComponentMetadata.of(AdHocComponent.class);
        Map<String, Object> snapshotWire = Map.of("obj", Map.of());
        Map<String, Object> updates = Map.of("obj.name", "parma");

        WireCall result = dispatcher.call(meta, new AdHocComponent(), snapshotWire, updates, List.of());

        Map<String, Object> objWire = unwrap(result.wire().get("obj"));
        assertThat(objWire).containsEntry("name", "parma");
    }

    /**
     * @spec.given an initially-empty dynamic object and a deep dotted update {@code obj.address.city}
     * @spec.when  the dispatcher applies it
     * @spec.then  the missing intermediate key is created and the leaf round-trips at the deep path
     * @spec.adr   ADR-0020
     */
    @Test
    void deep_dotted_update_creates_missing_intermediate_key() {
        ComponentMetadata meta = ComponentMetadata.of(AdHocComponent.class);
        Map<String, Object> snapshotWire = Map.of("obj", Map.of());
        Map<String, Object> updates = Map.of("obj.address.city", "Parma");

        WireCall result = dispatcher.call(meta, new AdHocComponent(), snapshotWire, updates, List.of());

        Map<String, Object> objWire = unwrap(result.wire().get("obj"));
        @SuppressWarnings("unchecked")
        Map<String, Object> address = (Map<String, Object>) objWire.get("address");
        assertThat(address).containsEntry("city", "Parma");
    }

    /**
     * @spec.given a null @Wire DynamicObject field (no snapshot entry) and a dotted update
     * @spec.when  the dispatcher applies it
     * @spec.then  the dynamic object is materialized and the value binds, so a fresh component needs
     *     no @LievitMount hook to initialize the field
     * @spec.adr   ADR-0020
     */
    @Test
    void materializes_a_null_dynamic_object_on_first_dotted_set() {
        ComponentMetadata meta = ComponentMetadata.of(NullDynamicComponent.class);
        Map<String, Object> updates = Map.of("obj.flag", true);

        WireCall result = dispatcher.call(meta, new NullDynamicComponent(), Map.of(), updates, List.of());

        Map<String, Object> objWire = unwrap(result.wire().get("obj"));
        assertThat(objWire).containsEntry("flag", true);
    }

    /**
     * @spec.given a dynamic object that already holds one nested key, hydrated from the snapshot
     * @spec.when  a sibling deep key is set and the wire is read back
     * @spec.then  the prior key survives the hydrate and both keys are present (state round-trips)
     * @spec.adr   ADR-0020
     */
    @Test
    void hydrates_prior_state_and_keeps_it_across_a_new_set() {
        ComponentMetadata meta = ComponentMetadata.of(AdHocComponent.class);
        Map<String, Object> snapshotWire = Map.of("obj", Map.of("address", Map.of("city", "Parma")));
        Map<String, Object> updates = Map.of("obj.address.zip", "43121");

        WireCall result = dispatcher.call(meta, new AdHocComponent(), snapshotWire, updates, List.of());

        Map<String, Object> objWire = unwrap(result.wire().get("obj"));
        @SuppressWarnings("unchecked")
        Map<String, Object> address = (Map<String, Object>) objWire.get("address");
        assertThat(address).containsEntry("city", "Parma").containsEntry("zip", "43121");
    }

    /**
     * @spec.given a dynamic object component with a stray dotted update naming a non-@Wire head
     * @spec.when  the dispatcher applies the updates
     * @spec.then  the stray update is dropped (only a @Wire field is settable, ADR-0013), the valid
     *     dynamic-object update still applies
     * @spec.adr   ADR-0013
     */
    @Test
    void drops_a_dotted_update_whose_head_is_not_a_wire_field() {
        ComponentMetadata meta = ComponentMetadata.of(AdHocComponent.class);
        Map<String, Object> snapshotWire = Map.of("obj", Map.of());
        java.util.Map<String, Object> updates = new java.util.LinkedHashMap<>();
        updates.put("notAField.x", "evil");
        updates.put("obj.ok", "yes");

        WireCall result = dispatcher.call(meta, new AdHocComponent(), snapshotWire, updates, List.of());

        Map<String, Object> objWire = unwrap(result.wire().get("obj"));
        assertThat(objWire).containsEntry("ok", "yes").doesNotContainKey("notAField");
    }

    /**
     * The wire value of a DynamicObject field is a {@code @w} tuple ({"@w": {"d": <map>, "s": "dyn"}}).
     * This helper unwraps it to the inner data map for assertions.
     */
    @SuppressWarnings("unchecked")
    private static Map<String, Object> unwrap(Object wireValue) {
        assertThat(wireValue).isInstanceOf(Map.class);
        Map<String, Object> envelope = (Map<String, Object>) wireValue;
        Map<String, Object> inner = (Map<String, Object>) envelope.get("@w");
        assertThat(inner).containsEntry("s", "dyn");
        return (Map<String, Object>) inner.get("d");
    }
}
