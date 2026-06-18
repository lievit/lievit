/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.spring.broadcast;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.request;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

/**
 * The broadcast SSE channel end-to-end (issue #304 / #45): a logged-in user subscribes to
 * {@code GET /lievit/broadcast} (an SSE stream keyed to their security principal), an out-of-band
 * {@code push} reaches that user's connection, and an anonymous subscribe is refused with 401 (the
 * per-user channel has no anonymous bucket). Proves the additive controller + the opt-in
 * {@code SseBroadcastChannel} bean the autoconfiguration registers behind
 * {@code lievit.broadcast.enabled=true}.
 */
@SpringBootTest(classes = BroadcastTestApp.class)
@AutoConfigureMockMvc
@TestPropertySource(
        properties = {
            "lievit.signing-key=test-signing-key-0123456789abcdef-0123456789",
            "lievit.broadcast.enabled=true"
        })
class BroadcastControllerIT {

    @Autowired private MockMvc mockMvc;
    @Autowired private SseBroadcastChannel channel;

    /**
     * @spec.given a logged-in user
     * @spec.when  they subscribe to the broadcast SSE stream and an event is pushed to them
     *     out-of-band of any request
     * @spec.then  the request starts an async text/event-stream, the user's connection is registered
     *     on the channel (the per-user channel of #304), and the out-of-band push reaches it without
     *     throwing (the frame content is pinned by SseBroadcastChannelTest)
     * @spec.us    US-304-broadcast-notifications
     */
    @Test
    void a_logged_in_user_subscribes_and_an_out_of_band_push_reaches_their_connection() throws Exception {
        // Authenticate via Spring Security's test support: with a SecurityFilterChain now active
        // (ADR-0053), request.getUserPrincipal() reads the SecurityContext, so a raw .principal()
        // would be stripped. user(...) populates the context the canonical way.
        mockMvc.perform(
                        get("/lievit/broadcast")
                                .with(user("agent-7"))
                                .accept(MediaType.TEXT_EVENT_STREAM))
                .andExpect(request().asyncStarted())
                .andExpect(content().contentTypeCompatibleWith(MediaType.TEXT_EVENT_STREAM));

        // The user's connection is registered on the channel (the per-user channel of #304).
        assertThat(channel.connectionCount("agent-7")).isEqualTo(1);

        // Push an event out-of-band of any request; it reaches the open async connection (no throw).
        channel.push(
                "agent-7",
                BroadcastEvent.of("lievit-admin-notify", Map.of("title", "Assigned to you")));
        assertThat(channel.connectionCount("agent-7")).isEqualTo(1); // a live send did not prune it
    }

    /**
     * @spec.given an anonymous request (no authenticated principal)
     * @spec.when  it tries to subscribe to the broadcast channel
     * @spec.then  it is refused with 401: the channel is per-user, there is no anonymous bucket
     * @spec.us    US-304-broadcast-notifications
     */
    @Test
    void an_anonymous_subscribe_is_refused_with_401() throws Exception {
        mockMvc.perform(get("/lievit/broadcast").accept(MediaType.TEXT_EVENT_STREAM))
                .andExpect(status().isUnauthorized());
    }
}
