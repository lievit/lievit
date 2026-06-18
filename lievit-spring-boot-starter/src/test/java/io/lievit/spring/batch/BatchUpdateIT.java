/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.spring.batch;

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
import io.lievit.spring.counter.CounterComponent;
import io.lievit.spring.counter.CounterTestApp;

/**
 * The batched update transport (issue #177): {@code POST /lievit/update} commits an array of
 * components in one request, returns one result per component, skips an inert reactive child, and
 * rejects a request missing the {@code X-Lievit} wire header. This is the page-level transport that
 * keeps a page of several islands at one HTTP round trip instead of N (the N+1 the per-component
 * endpoint would cause).
 */
@SpringBootTest(classes = CounterTestApp.class)
@AutoConfigureMockMvc
@TestPropertySource(
        properties = {"lievit.signing-key=test-signing-key-0123456789abcdef-0123456789"})
class BatchUpdateIT {

    @Autowired MockMvc mvc;
    @Autowired LievitWireService wireService;

    private final ObjectMapper json = new ObjectMapper();

    /**
     * @spec.given two mounted counters in one batch: one carries an increment call, the other carries
     *     no updates and no calls (an inert reactive child)
     * @spec.when  the batch is POSTed to /lievit/update with the X-Lievit header
     * @spec.then  the working component commits (its own snapshot + rendered HTML showing count 1) and
     *     the inert one is answered with a bare {skip:true,id} marker (no lifecycle, no html)
     * @spec.us    US-177-batch-commit
     */
    @Test
    void two_components_commit_in_one_request_and_an_inert_child_is_skipped() throws Exception {
        WireCallResult a = wireService.mount(CounterComponent.class.getName());
        WireCallResult b = wireService.mount(CounterComponent.class.getName());

        String body =
                json.writeValueAsString(
                        Map.of(
                                "components",
                                List.of(
                                        Map.of(
                                                "snapshot", a.snapshot(),
                                                "calls", List.of("increment")),
                                        Map.of("snapshot", b.snapshot()))));

        MvcResult result =
                mvc.perform(
                                post("/lievit/update")
                                        .header("X-Lievit", "1")
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content(body))
                        .andExpect(status().isOk())
                        .andReturn();

        JsonNode components = json.readTree(result.getResponse().getContentAsString()).get("components");
        assertThat(components).hasSize(2);

        JsonNode committed = components.get(0);
        assertThat(committed.has("skip")).isFalse();
        assertThat(committed.get("snapshot").asText()).isNotBlank();
        assertThat(committed.get("html").asText()).contains(">1<");

        JsonNode skipped = components.get(1);
        assertThat(skipped.get("skip").asBoolean()).isTrue();
        assertThat(skipped.get("id").asText()).isNotBlank();
        assertThat(skipped.has("html")).isFalse();
        assertThat(skipped.has("snapshot")).isFalse();
    }

    /**
     * @spec.given a well-formed batch payload but no X-Lievit wire header (a plain browser POST)
     * @spec.when  it hits /lievit/update
     * @spec.then  it is rejected 400 with the missing-header reason: the wire-only endpoint refuses a
     *     non-wire request, keeping the wire surface separate from the page surface
     * @spec.us    US-177-batch-commit
     */
    @Test
    void a_request_without_the_wire_header_is_rejected() throws Exception {
        WireCallResult a = wireService.mount(CounterComponent.class.getName());
        String body =
                json.writeValueAsString(
                        Map.of("components", List.of(Map.of("snapshot", a.snapshot()))));

        mvc.perform(
                        post("/lievit/update")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(body))
                .andExpect(status().isBadRequest())
                .andExpect(
                        org.springframework.test.web.servlet.result.MockMvcResultMatchers.header()
                                .string("Lievit-Reason", "missing-header"));
    }
}
