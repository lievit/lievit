/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.spring.asset;

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

import dev.lievit.spring.LievitWireService;
import dev.lievit.spring.WireCallResult;

/**
 * End-to-end pin that a wire update carries the rendered component's page-level assets (issue #171,
 * the {@code getAssets()} once-semantic): a {@link Widget} (colocated script module + scoped CSS +
 * {@code @assets} head tags) is mounted and its action POSTed; the {@code Lievit-Effects} header's
 * {@code assets} block carries the {@code run($wire,$js)} module URL, the {@code @assets} head tag,
 * and the scoped-CSS {@code styleModule} the client loads, all through the real codec, dispatcher, DSL
 * adapter, asset emitter, and HTTP endpoint.
 */
@SpringBootTest(classes = AssetTestApp.class)
@AutoConfigureMockMvc
@TestPropertySource(
        properties = {"lievit.signing-key=test-signing-key-0123456789abcdef-0123456789"})
class UpdateAssetsIT {

    @Autowired MockMvc mvc;
    @Autowired LievitWireService wireService;

    private final ObjectMapper json = new ObjectMapper();

    /**
     * @spec.given a mounted Widget (colocated script module, scoped CSS, and an {@code @assets} head
     *     tag) and a wire call to its action
     * @spec.when  the snapshot is POSTed with the bump action
     * @spec.then  the Lievit-Effects header's assets block carries the component's run-module URL, its
     *     {@code @assets} head tag, and a scoped-CSS styleModule (component + hashed href), so a
     *     late-arriving component ships its JS/CSS on the update
     * @spec.adr   ADR-0060
     * @spec.us    US-171-asset-pipeline
     */
    @Test
    void a_wire_update_carries_the_rendered_components_assets() throws Exception {
        WireCallResult mounted = wireService.mount(Widget.class.getName());

        MvcResult result =
                mvc.perform(
                                post("/lievit/{id}/call", "cid")
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content(call(mounted.snapshot(), List.of("bump"))))
                        .andExpect(status().isOk())
                        .andExpect(header().exists("Lievit-Effects"))
                        .andReturn();

        JsonNode assets =
                json.readTree(result.getResponse().getHeader("Lievit-Effects")).get("assets");
        assertThat(assets).isNotNull();
        assertThat(assets.get("scripts").get(0).asText()).contains("Widget.lievit.ts");
        assertThat(assets.get("headTags").get(0).asText()).contains("cdn.example.com/lib.js");
        JsonNode styleModule = assets.get("styleModules").get(0);
        assertThat(styleModule.get("component").asText()).isEqualTo(Widget.class.getName());
        assertThat(styleModule.get("href").asText()).startsWith("/lievit/css/");
        assertThat(styleModule.get("hash").asText()).isNotBlank();
    }

    private String call(String snapshot, List<String> calls) throws Exception {
        return json.writeValueAsString(
                Map.of("_snapshot", snapshot, "_updates", Map.of(), "_calls", calls));
    }
}
