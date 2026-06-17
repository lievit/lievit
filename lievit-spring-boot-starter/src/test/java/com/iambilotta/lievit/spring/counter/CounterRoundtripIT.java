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

import com.fasterxml.jackson.databind.ObjectMapper;
import com.iambilotta.lievit.spring.LievitWireService;
import com.iambilotta.lievit.spring.WireCallResult;

/**
 * The walking-skeleton golden roundtrip (ADR-0007): the Counter is mounted, its signed snapshot is
 * carried into a {@code POST /lievit/{id}/call} that invokes {@code increment}, and the re-rendered
 * HTML shows the count advanced by one with a fresh snapshot returned. Plus the load-bearing
 * security check: a client {@code _updates} entry for the locked {@code label} field is rejected
 * with 403 even though the snapshot is validly signed (the ADR-0001 amendment).
 *
 * <p>This is the single end-to-end tracer-bullet the skeleton exists to prove: mount -&gt; render
 * -&gt; l:click -&gt; re-render, over the real codec, registry, dispatcher, JTE adapter, and HTTP
 * endpoint.
 */
@SpringBootTest(classes = CounterTestApp.class)
@AutoConfigureMockMvc
@TestPropertySource(
        properties = {
            // A >= 32-byte dev signing key (the codec floor). Spring Security is not on the test
            // classpath, so CSRF is not exercised here; it is enforced upstream in a deployed app.
            "lievit.signing-key=test-signing-key-0123456789abcdef-0123456789"
        })
class CounterRoundtripIT {

    @Autowired MockMvc mvc;
    @Autowired LievitWireService wireService;

    private final ObjectMapper json = new ObjectMapper();

    /**
     * @spec.given a freshly mounted Counter and its signed initial snapshot
     * @spec.when  that snapshot is POSTed back with an increment action
     * @spec.then  the response is 200 text/html showing count 1, with a fresh Lievit-Snapshot header
     * @spec.adr   ADR-0001
     */
    @Test
    void mounts_then_increments_over_the_wire_endpoint() throws Exception {
        WireCallResult mounted = wireService.mount(CounterComponent.class.getName());
        assertThat(mounted.html()).contains(">0<").contains("l:click=\"increment\"");

        String body =
                json.writeValueAsString(
                        Map.of(
                                "_snapshot", mounted.snapshot(),
                                "_updates", Map.of(),
                                "_calls", List.of("increment")));

        MvcResult result =
                mvc.perform(
                                post("/lievit/{id}/call", "ignored-path-cid")
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content(body))
                        .andExpect(status().isOk())
                        .andExpect(header().exists("Lievit-Snapshot"))
                        .andReturn();

        String html = result.getResponse().getContentAsString();
        assertThat(html).contains(">1<");
        assertThat(result.getResponse().getHeader("Lievit-Snapshot")).isNotBlank();
    }

    /**
     * @spec.given a validly signed Counter snapshot and a client update to the locked label field
     * @spec.when  the snapshot is POSTed back with that update
     * @spec.then  the call is rejected 403 with Lievit-Reason: locked-property: the signature does
     *     not stop the first POST from writing a server-owned field; the lock does
     * @spec.adr   ADR-0001
     */
    @Test
    void rejects_a_client_update_to_a_locked_field_with_403() throws Exception {
        WireCallResult mounted = wireService.mount(CounterComponent.class.getName());

        String body =
                json.writeValueAsString(
                        Map.of(
                                "_snapshot", mounted.snapshot(),
                                "_updates", Map.of("label", "attacker-set"),
                                "_calls", List.of("increment")));

        mvc.perform(
                        post("/lievit/{id}/call", "cid")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(body))
                .andExpect(status().isForbidden())
                .andExpect(header().string("Lievit-Reason", "locked-property"));
    }

    /**
     * @spec.given a tampered snapshot (a flipped payload char) carried back to the endpoint
     * @spec.when  it is POSTed
     * @spec.then  the call is rejected (the HMAC boundary holds), never reaching the component
     * @spec.adr   ADR-0001
     */
    @Test
    void rejects_a_tampered_snapshot_at_the_endpoint() throws Exception {
        WireCallResult mounted = wireService.mount(CounterComponent.class.getName());
        String[] parts = mounted.snapshot().split("\\.");
        char[] payload = parts[1].toCharArray();
        payload[0] = payload[0] == 'a' ? 'b' : 'a';
        String tampered = parts[0] + "." + new String(payload) + "." + parts[2];

        String body =
                json.writeValueAsString(
                        Map.of(
                                "_snapshot", tampered,
                                "_updates", Map.of(),
                                "_calls", List.of("increment")));

        mvc.perform(
                        post("/lievit/{id}/call", "cid")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(body))
                .andExpect(status().isForbidden());
    }
}
