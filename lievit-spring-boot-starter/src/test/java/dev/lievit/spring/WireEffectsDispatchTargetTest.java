/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.spring;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Map;

import org.junit.jupiter.api.Test;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import dev.lievit.component.LievitEffects;

/**
 * Pins the server emitting-side of the events targeting matrix (issue #199, ADR-0030): a global
 * {@code dispatch}, {@code dispatchSelf}, and {@code dispatchTo("name")} each serialize into the wire
 * {@code dispatch} array with the right routing keys ({@code self} / {@code to}), so the client
 * runtime delivers each to the correct listeners. The client routing + inbound listener invocation
 * are pinned elsewhere (events.test.ts, EventListenerTest); this closes the un-pinned seam between
 * the {@code LievitEffects} dispatch calls and the {@code WireEffects} JSON.
 */
class WireEffectsDispatchTargetTest {

    private final ObjectMapper json = new ObjectMapper();

    private JsonNode serialize(LievitEffects sink) throws Exception {
        return json.readTree(json.writeValueAsString(WireEffects.from(sink))).get("dispatch");
    }

    /**
     * @spec.given an action that dispatches a global event
     * @spec.when  the effects are serialized
     * @spec.then  the event carries neither a self nor a to key (every listener receives it)
     */
    @Test
    void global_dispatch_carries_no_routing_key() throws Exception {
        LievitEffects sink = LievitEffects.capturing();
        sink.dispatch("saved", Map.of("id", 7));

        JsonNode event = serialize(sink).get(0);

        assertThat(event.get("name").asText()).isEqualTo("saved");
        assertThat(event.has("self")).isFalse();
        assertThat(event.has("to")).isFalse();
    }

    /**
     * @spec.given an action that dispatchSelf
     * @spec.when  the effects are serialized
     * @spec.then  the event carries self=true (only the dispatching component receives it)
     */
    @Test
    void dispatch_self_carries_self_true() throws Exception {
        LievitEffects sink = LievitEffects.capturing();
        sink.dispatchSelf("refresh", null);

        JsonNode event = serialize(sink).get(0);

        assertThat(event.get("self").asBoolean()).isTrue();
        assertThat(event.has("to")).isFalse();
    }

    /**
     * @spec.given an action that dispatchTo a named component
     * @spec.when  the effects are serialized
     * @spec.then  the event carries to="component-name" (only that component receives it)
     */
    @Test
    void dispatch_to_carries_the_target_component_name() throws Exception {
        LievitEffects sink = LievitEffects.capturing();
        sink.dispatchTo("inbox", "message-read", Map.of("messageId", 3));

        JsonNode event = serialize(sink).get(0);

        assertThat(event.get("to").asText()).isEqualTo("inbox");
        assertThat(event.has("self")).isFalse();
        assertThat(event.get("detail").get("messageId").asInt()).isEqualTo(3);
    }
}
