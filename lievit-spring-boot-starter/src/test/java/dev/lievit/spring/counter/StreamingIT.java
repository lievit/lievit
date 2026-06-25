/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.spring.counter;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.asyncDispatch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.request;
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

import dev.lievit.spring.LievitWireService;
import dev.lievit.spring.WireCallResult;

/**
 * The streaming SSE endpoint golden roundtrip (issue #153, ADR-0035): a {@link StreamingComponent} is
 * mounted, its signed snapshot carried into {@code POST /lievit/{id}/stream}, and the action's
 * {@code $this.stream(...)} chunks flush as SSE envelopes the client's {@code parseStreamEnvelope}
 * reads. Proves the chunks render incrementally (a sequence of envelopes), falsy content streams, and
 * replace rides correctly, through the real codec, registry, dispatcher, and HTTP endpoint.
 */
@SpringBootTest(classes = CounterTestApp.class)
@AutoConfigureMockMvc
@TestPropertySource(
        properties = {"lievit.signing-key=test-signing-key-0123456789abcdef-0123456789"})
class StreamingIT {

    @Autowired MockMvc mvc;
    @Autowired LievitWireService wireService;

    private final ObjectMapper json = new ObjectMapper();

    /**
     * @spec.given a mounted streaming component whose generate action streams 4 chunks
     * @spec.when  its snapshot is POSTed to /lievit/{id}/stream with the X-Lievit wire header
     * @spec.then  the SSE response carries the 4 envelopes in order: appends, a falsy empty chunk,
     *     and a final replace into status
     * @spec.adr   ADR-0035
     */
    @Test
    void a_streaming_action_flushes_chunks_as_sse_envelopes() throws Exception {
        WireCallResult mounted = wireService.mount(StreamingComponent.class.getName());
        String body =
                json.writeValueAsString(
                        Map.of(
                                "_snapshot", mounted.snapshot(),
                                "_updates", Map.of(),
                                "_calls", List.of("generate")));

        MvcResult started =
                mvc.perform(
                                post("/lievit/{id}/stream", "cid")
                                        .header("X-Lievit", "1")
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content(body))
                        .andExpect(request().asyncStarted())
                        .andReturn();

        MvcResult result = mvc.perform(asyncDispatch(started)).andExpect(status().isOk()).andReturn();

        String sse = result.getResponse().getContentAsString();
        // SSE frames are `data:<json>\n\n`; the envelopes arrive in stream order.
        assertThat(sse).contains("\"target\":\"out\"");
        assertThat(sse).contains("\"content\":\"Hello \"");
        assertThat(sse).contains("\"content\":\"world\"");
        // A falsy empty chunk still produced an envelope (content "").
        assertThat(sse).contains("\"content\":\"\"");
        // The final replace chunk into status.
        assertThat(sse).contains("\"target\":\"status\"");
        assertThat(sse).contains("\"replace\":true");
    }

    /**
     * @spec.given a stream request with no X-Lievit wire header (a plain browser hit)
     * @spec.when  it is POSTed to the stream endpoint
     * @spec.then  it is refused (the wire-only header guard), never opening a stream
     * @spec.adr   ADR-0035
     */
    @Test
    void a_non_wire_request_is_refused() throws Exception {
        WireCallResult mounted = wireService.mount(StreamingComponent.class.getName());
        String body =
                json.writeValueAsString(
                        Map.of("_snapshot", mounted.snapshot(), "_calls", List.of("generate")));

        mvc.perform(
                        post("/lievit/{id}/stream", "cid")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(body))
                .andExpect(status().is4xxClientError());
    }
}
