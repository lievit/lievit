/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package com.iambilotta.lievit.spring.counter;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.iambilotta.lievit.spring.LievitWireService;
import com.iambilotta.lievit.spring.WireCallResult;

/**
 * The effects-channel golden roundtrip (ADR-0012): an {@link EffectfulComponent} is mounted and its
 * signed snapshot carried into a {@code POST /lievit/{id}/call}, proving an action can (a) trigger a
 * redirect, (b) dispatch an event the client will receive, and (c) return a value, all through the
 * real codec, registry, dispatcher, JTE adapter, and HTTP endpoint. The snapshot HMAC + locked +
 * checksum invariants are untouched: a no-effects action still omits the header entirely, and the
 * effects bag is never signed (it is server-authored).
 */
@SpringBootTest(classes = CounterTestApp.class)
@AutoConfigureMockMvc
@TestPropertySource(
        properties = {"lievit.signing-key=test-signing-key-0123456789abcdef-0123456789"})
class EffectsChannelIT {

    @Autowired MockMvc mvc;
    @Autowired LievitWireService wireService;

    private final ObjectMapper json = new ObjectMapper();

    /**
     * @spec.given a mounted Effectful component (a no-effects mount response)
     * @spec.when  the mount response is inspected
     * @spec.then  it carries HTML + a snapshot but no Lievit-Effects header: a no-effects call is
     *     backward compatible with ADR-0001's HTML+snapshot response
     * @spec.adr   ADR-0012
     */
    @Test
    void a_no_effects_call_omits_the_effects_header() throws Exception {
        WireCallResult mounted = wireService.mount(EffectfulComponent.class.getName());

        // total() returns a value but never touches the wire; use save's sibling that mutates only.
        String body = call(mounted.snapshot(), List.of());

        MvcResult result =
                mvc.perform(post("/lievit/{id}/call", "cid").contentType(MediaType.APPLICATION_JSON).content(body))
                        .andExpect(status().isOk())
                        .andExpect(header().exists("Lievit-Snapshot"))
                        .andExpect(header().doesNotExist("Lievit-Effects"))
                        .andReturn();

        assertThat(result.getResponse().getContentAsString()).contains("data-lievit-count");
    }

    /**
     * @spec.given a mounted Effectful component and an action that calls redirect("/done")
     * @spec.when  the snapshot is POSTed with the leave action
     * @spec.then  the 200 response carries a Lievit-Effects header whose JSON has redirect=/done
     * @spec.adr   ADR-0012
     */
    @Test
    void an_action_triggers_a_redirect_effect() throws Exception {
        WireCallResult mounted = wireService.mount(EffectfulComponent.class.getName());

        MvcResult result =
                mvc.perform(
                                post("/lievit/{id}/call", "cid")
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content(call(mounted.snapshot(), List.of("leave"))))
                        .andExpect(status().isOk())
                        .andExpect(header().exists("Lievit-Snapshot"))
                        .andExpect(header().exists("Lievit-Effects"))
                        .andReturn();

        JsonNode effects = json.readTree(result.getResponse().getHeader("Lievit-Effects"));
        assertThat(effects.get("redirect").asText()).isEqualTo("/done");
    }

    /**
     * @spec.given a mounted Effectful component and an action that dispatches "saved" with a detail
     * @spec.when  the snapshot is POSTed with the save action
     * @spec.then  the Lievit-Effects header carries the dispatched event (name + detail) the client
     *     will re-emit as a DOM CustomEvent
     * @spec.adr   ADR-0012
     */
    @Test
    void an_action_dispatches_an_event_the_client_receives() throws Exception {
        WireCallResult mounted = wireService.mount(EffectfulComponent.class.getName());

        MvcResult result =
                mvc.perform(
                                post("/lievit/{id}/call", "cid")
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content(call(mounted.snapshot(), List.of("save"))))
                        .andExpect(status().isOk())
                        .andReturn();

        JsonNode dispatch = json.readTree(result.getResponse().getHeader("Lievit-Effects")).get("dispatch");
        assertThat(dispatch).hasSize(1);
        assertThat(dispatch.get(0).get("name").asText()).isEqualTo("saved");
        assertThat(dispatch.get(0).get("detail").get("count").asInt()).isEqualTo(1);
    }

    /**
     * @spec.given a mounted Effectful component and an action that returns a value
     * @spec.when  the snapshot is POSTed with the total action
     * @spec.then  the Lievit-Effects header carries returns=100 (the action's return value)
     * @spec.adr   ADR-0012
     */
    @Test
    void an_action_return_value_rides_the_effects_channel() throws Exception {
        WireCallResult mounted = wireService.mount(EffectfulComponent.class.getName());

        MvcResult result =
                mvc.perform(
                                post("/lievit/{id}/call", "cid")
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content(call(mounted.snapshot(), List.of("total"))))
                        .andExpect(status().isOk())
                        .andReturn();

        JsonNode effects = json.readTree(result.getResponse().getHeader("Lievit-Effects"));
        assertThat(effects.get("returns").asInt()).isEqualTo(100);
    }

    private String call(String snapshot, List<String> calls) throws Exception {
        return json.writeValueAsString(
                Map.of("_snapshot", snapshot, "_updates", Map.of(), "_calls", calls));
    }
}
