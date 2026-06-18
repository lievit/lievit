/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.spring.broadcast;

import java.io.IOException;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import tools.jackson.databind.ObjectMapper;

/**
 * The default {@link BroadcastChannel}: a Server-Sent-Events fan-out over Spring MVC's
 * {@link SseEmitter} (the canonical servlet SSE primitive). It holds a per-recipient registry of open
 * emitters; {@link #push} serializes the {@link BroadcastEvent} to a JSON {@code data:} frame and
 * sends it to every one of the recipient's connections, pruning any that fail (a disconnected client).
 *
 * <p><strong>Why SSE, not WebSocket</strong> (ADR-0001 / the new ADR): a persistent WebSocket with
 * server-held state forces sticky sessions and breaks lievit's stateless, scale-to-zero posture. SSE
 * is a one-way server→client stream over plain HTTP, needs no extra dependency (servlet
 * {@code spring-web}), and rides the page's existing same-origin {@code connect-src 'self'} CSP with
 * no change. The client transport is the same {@code EventSource} the streaming feature already uses.
 *
 * <p>Thread-safety: the registry is a {@link ConcurrentHashMap} of {@link ConcurrentHashMap#newKeySet
 * concurrent sets}; {@link #push} runs from any thread off the request (an action that broadcasts, a
 * scheduled job). An {@link SseEmitter#send} is itself synchronized. A failed send removes the emitter
 * from the registry but does NOT call {@code complete()} on it: per Spring's contract the container's
 * async error notification handles cleanup once the client has gone (calling complete on a dead
 * emitter would double-complete).
 */
public final class SseBroadcastChannel implements BroadcastChannel {

    private static final Logger log = LoggerFactory.getLogger(SseBroadcastChannel.class);

    private final Map<String, Set<SseEmitter>> byRecipient = new ConcurrentHashMap<>();
    private final ObjectMapper json;
    private final long timeoutMillis;

    /**
     * @param json the mapper used to serialize a {@link BroadcastEvent} to its JSON frame
     * @param timeout the SSE connection idle timeout; the client {@code EventSource} reconnects after
     *     it, so the connection is bounded server-side (no forever-open emitter)
     */
    public SseBroadcastChannel(ObjectMapper json, Duration timeout) {
        this.json = json;
        this.timeoutMillis = timeout.toMillis();
    }

    /**
     * Opens a new SSE connection for a recipient and registers its emitter. The caller (the
     * controller) returns the emitter to Spring MVC, which streams it to the client. The emitter is
     * pruned from the registry when it completes, times out, or errors.
     *
     * @param recipient the recipient user id the connection belongs to
     * @return the registered emitter to hand back to Spring MVC
     */
    public SseEmitter subscribe(String recipient) {
        SseEmitter emitter = new SseEmitter(timeoutMillis);
        register(recipient, emitter);
        // An initial comment frame opens the stream promptly (some proxies buffer until first byte).
        try {
            emitter.send(SseEmitter.event().comment("connected"));
        } catch (IOException e) {
            remove(recipient, emitter);
        }
        return emitter;
    }

    /**
     * Registers an emitter for a recipient and wires its teardown callbacks to prune it. The {@link
     * #subscribe} path uses this after creating the emitter; tests use it to inject a recording
     * emitter without a live HTTP connection.
     *
     * @param recipient the recipient user id the emitter belongs to
     * @param emitter the emitter to register
     */
    void register(String recipient, SseEmitter emitter) {
        Set<SseEmitter> set =
                byRecipient.computeIfAbsent(recipient, key -> ConcurrentHashMap.newKeySet());
        set.add(emitter);
        emitter.onCompletion(() -> remove(recipient, emitter));
        emitter.onTimeout(() -> remove(recipient, emitter));
        emitter.onError(error -> remove(recipient, emitter));
    }

    @Override
    public void push(String recipient, BroadcastEvent event) {
        Set<SseEmitter> set = byRecipient.get(recipient);
        if (set == null || set.isEmpty()) {
            return; // no open connection: best-effort live push, the durable copy is the persisted notification
        }
        String frame = serialize(event);
        for (SseEmitter emitter : set) {
            try {
                emitter.send(SseEmitter.event().data(frame));
            } catch (IOException | IllegalStateException e) {
                // The client disconnected (IO) or the emitter already completed (IllegalState): prune
                // it. Do NOT complete() it — Spring's async error notification owns the teardown.
                set.remove(emitter);
            }
        }
    }

    @Override
    public int connectionCount(String recipient) {
        Set<SseEmitter> set = byRecipient.get(recipient);
        return set == null ? 0 : set.size();
    }

    /** Serializes the event to the JSON frame the client {@code parseBroadcastEvent} reads. */
    private String serialize(BroadcastEvent event) {
        Map<String, Object> envelope = new LinkedHashMap<>();
        envelope.put("name", event.name());
        if (event.detail() != null) {
            envelope.put("detail", event.detail());
        }
        if (event.to() != null) {
            envelope.put("to", event.to());
        }
        try {
            return json.writeValueAsString(envelope);
        } catch (RuntimeException e) {
            // A non-JSON-serializable detail is a programming error; log and drop the frame rather
            // than break the fan-out for the other recipients.
            log.warn("dropping a broadcast event that did not serialize: {}", event.name());
            return "{\"name\":\"" + event.name() + "\"}";
        }
    }

    private void remove(String recipient, SseEmitter emitter) {
        Set<SseEmitter> set = byRecipient.get(recipient);
        if (set != null) {
            set.remove(emitter);
            if (set.isEmpty()) {
                byRecipient.remove(recipient, set);
            }
        }
    }
}
