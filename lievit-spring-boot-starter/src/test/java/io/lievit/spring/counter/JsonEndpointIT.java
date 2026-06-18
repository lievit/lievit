/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.spring.counter;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
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
import io.lievit.spring.LievitWireService;
import io.lievit.spring.WireCallResult;

/**
 * The {@code @LievitJson} JSON RPC endpoint (issue #99) end-to-end through the real wire pipeline:
 * the client's {@code $lievit.method()} maps to an action call whose return value rides the
 * {@code Lievit-Effects} {@code returns} key and whose response carries <strong>no HTML patch</strong>
 * (the render is skipped). The typed RPC is decoupled from rendering.
 */
@SpringBootTest(classes = CounterTestApp.class)
@AutoConfigureMockMvc
@TestPropertySource(
        properties = {"lievit.signing-key=test-signing-key-0123456789abcdef-0123456789"})
class JsonEndpointIT {

    @Autowired MockMvc mvc;
    @Autowired LievitWireService wireService;

    private final ObjectMapper json = new ObjectMapper();

    /**
     * @spec.given a mounted Effectful component with a @LievitJson lookup() returning a map
     * @spec.when  the lookup action is called over the wire
     * @spec.then  the return value rides Lievit-Effects.returns and the HTML body is empty (no
     *     re-render): the JSON RPC is decoupled from rendering
     * @spec.adr   ADR-0032
     * @spec.us    US-099-json-endpoint
     */
    @Test
    void a_json_endpoint_returns_a_value_without_re_rendering() throws Exception {
        WireCallResult mounted = wireService.mount(EffectfulComponent.class.getName());

        MvcResult result =
                mvc.perform(
                                post("/lievit/{id}/call", "cid")
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content(
                                                json.writeValueAsString(
                                                        Map.of(
                                                                "_snapshot", mounted.snapshot(),
                                                                "_calls", List.of("lookup")))))
                        .andExpect(status().isOk())
                        .andReturn();

        JsonNode returns =
                json.readTree(result.getResponse().getHeader("Lievit-Effects")).get("returns");
        assertThat(returns.get("answer").asInt()).isEqualTo(42);
        // No HTML patch: a renderless JSON RPC sends an empty body so the client leaves the DOM alone.
        assertThat(result.getResponse().getContentAsString()).isEmpty();
    }
}
