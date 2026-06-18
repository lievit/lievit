/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.spring.broadcast;

import java.security.Principal;

import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import org.jspecify.annotations.Nullable;

/**
 * The broadcast subscribe endpoint (issue #304 / #45): {@code GET /lievit/broadcast} opens a
 * Server-Sent-Events stream the logged-in user's clients listen on for live-pushed events. The
 * <strong>per-user channel</strong> is derived from the request's {@link Principal} (the page's
 * security context, wire-protocol.md §7), so a client can only ever subscribe to its own user's
 * channel: the user id is never taken from a request parameter the client controls. An anonymous
 * request (no principal) is {@code 401}, never an open channel.
 *
 * <p>It is an additive route (like the upload controller), gated by
 * {@code lievit.broadcast.enabled=true} in the autoconfiguration; an app that does not push live
 * notifications never mounts it and pays no open-connection cost.
 */
@RestController
public final class BroadcastController {

    private final SseBroadcastChannel channel;

    /**
     * @param channel the SSE broadcast channel that registers the connection
     */
    public BroadcastController(SseBroadcastChannel channel) {
        this.channel = channel;
    }

    /**
     * Opens the SSE stream for the authenticated user.
     *
     * @param principal the request's security principal (the per-user channel key); {@code null} when
     *     the request is anonymous
     * @return the SSE emitter Spring MVC streams to the client
     * @throws ResponseStatusException 401 when the request carries no authenticated principal
     */
    @GetMapping(path = "/lievit/broadcast", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter subscribe(@Nullable Principal principal) {
        if (principal == null || principal.getName() == null || principal.getName().isBlank()) {
            // No user, no channel: the broadcast channel is per-user, there is nothing to subscribe to.
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        }
        return channel.subscribe(principal.getName());
    }
}
