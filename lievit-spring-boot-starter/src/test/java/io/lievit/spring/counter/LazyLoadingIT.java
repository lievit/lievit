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

import com.fasterxml.jackson.databind.ObjectMapper;

import io.lievit.spring.LievitWireService;
import io.lievit.spring.WireCallResult;

/**
 * The lazy-loading golden roundtrip (issue #147, ADR-0036): a {@code @LievitLazy} component's first
 * mount renders the placeholder + the {@code l:lazy="$refresh"} trigger (not the heavy body) carrying
 * the real signed snapshot, and the follow-up {@code $refresh} call renders the full body from that
 * snapshot — the {@code points} mount state survives the load.
 */
@SpringBootTest(classes = CounterTestApp.class)
@AutoConfigureMockMvc
@TestPropertySource(
        properties = {"lievit.signing-key=test-signing-key-0123456789abcdef-0123456789"})
class LazyLoadingIT {

    @Autowired MockMvc mvc;
    @Autowired LievitWireService wireService;

    private final ObjectMapper json = new ObjectMapper();

    /**
     * @spec.given a @LievitLazy chart component mounted for the first page load
     * @spec.when  the mount HTML + snapshot are inspected
     * @spec.then  the placeholder + l:lazy="$refresh" trigger render, not the heavy chart body, and
     *     the root carries the wire markers (id + snapshot) so the client hydrates it
     * @spec.adr   ADR-0036
     */
    @Test
    void the_first_mount_renders_the_placeholder_and_trigger() {
        WireCallResult mounted = wireService.mount(LazyChartComponent.class.getName());

        assertThat(mounted.html()).contains("preparing chart");
        assertThat(mounted.html()).contains("l:lazy=\"$refresh\"");
        assertThat(mounted.html()).doesNotContain("heavy chart");
        assertThat(mounted.html()).contains("data-lievit-snapshot");
        assertThat(mounted.snapshot()).isNotBlank();
    }

    /**
     * @spec.given the lazy component's mount snapshot
     * @spec.when  the client fires the load trigger ($refresh) against /lievit/{id}/call
     * @spec.then  the full chart body renders with the preserved points state, no placeholder
     * @spec.adr   ADR-0036
     */
    @Test
    void the_refresh_load_renders_the_full_body_with_preserved_state() throws Exception {
        WireCallResult mounted = wireService.mount(LazyChartComponent.class.getName());
        String body =
                json.writeValueAsString(
                        Map.of(
                                "_snapshot", mounted.snapshot(),
                                "_updates", Map.of(),
                                "_calls", List.of("$refresh")));

        MvcResult result =
                mvc.perform(
                                post("/lievit/{id}/call", "cid")
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content(body))
                        .andExpect(status().isOk())
                        .andReturn();

        String html = result.getResponse().getContentAsString();
        assertThat(html).contains("heavy chart with 1000 points");
        assertThat(html).doesNotContain("preparing chart");
    }
}
