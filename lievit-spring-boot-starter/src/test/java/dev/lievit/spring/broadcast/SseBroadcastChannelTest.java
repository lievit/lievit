/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.spring.broadcast;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import tools.jackson.databind.ObjectMapper;

/**
 * Specifies the SSE broadcast channel (issue #304 / #45): a per-recipient registry of {@link
 * SseEmitter}s that {@code push} fans an event out to, the per-user scoping (a push reaches only the
 * named recipient's connections, never another's), the no-op for a recipient with no open connection,
 * and the pruning of a dead connection on a failed send. The transport is SSE (the lievit-canonical
 * real-time channel, see the broadcast ADR), so the registry is the unit under test off the wire.
 */
class SseBroadcastChannelTest {

    private final ObjectMapper json = new ObjectMapper();

    /**
     * An emitter that records every data frame it is sent (so the test reads what reached the
     * client). An {@code SseEventBuilder} emits the event as several parts (the {@code data:}
     * field-name marker, then the payload, then the line break); the test joins the parts of one
     * {@code send} into a single frame and keeps only the non-empty data frames (skipping the bare
     * heartbeat comment {@code subscribe} sends).
     */
    private static final class RecordingEmitter extends SseEmitter {
        final List<String> frames = new ArrayList<>();

        @Override
        public void send(SseEmitter.SseEventBuilder builder) throws IOException {
            StringBuilder joined = new StringBuilder();
            for (DataWithMediaType d : builder.build()) {
                if (d.getData() instanceof String s) {
                    joined.append(s);
                }
            }
            String frame = joined.toString();
            // Keep only the JSON payload frames (an event() carries `data:` + the JSON); skip the
            // bare comment heartbeat (it has no JSON body).
            if (frame.contains("{")) {
                frames.add(frame);
            }
        }
    }

    /**
     * @spec.given a recipient with one open SSE connection
     * @spec.when  an event is pushed to that recipient
     * @spec.then  the connection receives a JSON frame carrying the event name + detail
     */
    @Test
    void pushes_an_event_to_a_recipients_open_connection() {
        SseBroadcastChannel channel = new SseBroadcastChannel(json, Duration.ofMinutes(5));
        RecordingEmitter emitter = registerInto(channel, "u1");

        channel.push("u1", BroadcastEvent.of("lievit-admin-notify", Map.of("title", "Assigned")));

        assertThat(emitter.frames).hasSize(1);
        assertThat(emitter.frames.get(0)).contains("\"name\":\"lievit-admin-notify\"").contains("Assigned");
    }

    /**
     * @spec.given two recipients each with an open connection
     * @spec.when  an event is pushed to one recipient
     * @spec.then  only that recipient's connection receives it (per-user scoping, the privacy boundary)
     */
    @Test
    void scopes_a_push_to_the_named_recipient_only() {
        SseBroadcastChannel channel = new SseBroadcastChannel(json, Duration.ofMinutes(5));
        RecordingEmitter u1 = registerInto(channel, "u1");
        RecordingEmitter u2 = registerInto(channel, "u2");

        channel.push("u1", BroadcastEvent.of("ping"));

        assertThat(u1.frames).hasSize(1);
        assertThat(u2.frames).isEmpty();
    }

    /**
     * @spec.given a recipient with no open connection
     * @spec.when  an event is pushed to them
     * @spec.then  it is a no-op (best-effort live push; the durable copy is the persisted notification)
     */
    @Test
    void a_push_to_a_recipient_with_no_connection_is_a_no_op() {
        SseBroadcastChannel channel = new SseBroadcastChannel(json, Duration.ofMinutes(5));

        channel.push("nobody", BroadcastEvent.of("ping"));

        assertThat(channel.connectionCount("nobody")).isZero();
    }

    /**
     * @spec.given a recipient whose connection fails on send (a disconnected client)
     * @spec.when  an event is pushed to them
     * @spec.then  the dead connection is pruned from the registry (the next count is zero)
     */
    @Test
    void prunes_a_connection_that_fails_on_send() {
        SseBroadcastChannel channel = new SseBroadcastChannel(json, Duration.ofMinutes(5));
        // An emitter whose send throws IOException simulates a client that has gone away.
        SseEmitter dead =
                new SseEmitter() {
                    @Override
                    public void send(SseEmitter.SseEventBuilder builder) throws IOException {
                        throw new IOException("client gone");
                    }
                };
        channel.register("u1", dead);

        channel.push("u1", BroadcastEvent.of("ping"));

        assertThat(channel.connectionCount("u1")).isZero();
    }

    /**
     * @spec.given a per-component broadcast event (a bell refresh targeted at a component)
     * @spec.when  it is serialized to its SSE frame
     * @spec.then  the frame carries the `to` routing key the client reads to route it to that component
     */
    @Test
    void serializes_a_per_component_routing_target() {
        SseBroadcastChannel channel = new SseBroadcastChannel(json, Duration.ofMinutes(5));
        RecordingEmitter emitter = registerInto(channel, "u1");

        channel.push("u1", BroadcastEvent.to("dev.lievit.kit.NotificationBell", "refresh", null));

        assertThat(emitter.frames.get(0))
                .contains("\"to\":\"dev.lievit.kit.NotificationBell\"")
                .contains("\"name\":\"refresh\"");
    }

    /** Registers a fresh recording emitter for a recipient and returns it. */
    private RecordingEmitter registerInto(SseBroadcastChannel channel, String recipient) {
        RecordingEmitter emitter = new RecordingEmitter();
        channel.register(recipient, emitter);
        return emitter;
    }
}
