/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.spring.broadcast;

import java.util.Map;
import java.util.Objects;

import org.jspecify.annotations.Nullable;

/**
 * One server-pushed broadcast event (issue #304 / #45): the unit a {@link BroadcastChannel} delivers
 * to a recipient's connected clients over the SSE channel. Its wire shape is the same envelope as a
 * wire-call dispatched event ({@code { name, detail?, to? }}), so the client routes a pushed event
 * exactly as a dispatched one (the echo bridge): re-emit on {@code window}, fire the JS listeners, and
 * deliver to matching {@code @LievitOn} components.
 *
 * <p>{@code name} is the browser event name (e.g. {@code lievit-admin-notify} for a live toast,
 * {@code lievit-notifications-refresh} for a bell refresh). {@code detail} is the JSON-shaped payload
 * (the toast content). {@code to} optionally names a target component so the push reaches only that
 * component type (e.g. the bell), absent it is a global page fan-out.
 *
 * @param name the browser event name (non-blank)
 * @param detail the JSON-shaped payload, or {@code null} for a bare signal (e.g. a refresh ping)
 * @param to the target component name for a per-component delivery, or {@code null} for a global push
 */
public record BroadcastEvent(
        String name, @Nullable Map<String, Object> detail, @Nullable String to) {

    /** Compact constructor: a broadcast event must carry a non-blank name. */
    public BroadcastEvent {
        if (name == null || name.isBlank()) {
            throw new IllegalArgumentException("a broadcast event needs a non-blank name");
        }
        detail = detail == null ? null : Map.copyOf(detail);
    }

    /**
     * @param name the event name
     * @param detail the payload (JSON-shaped), may be {@code null}
     * @return a global broadcast event (no component target)
     */
    public static BroadcastEvent of(String name, @Nullable Map<String, Object> detail) {
        return new BroadcastEvent(name, detail, null);
    }

    /**
     * @param name the event name
     * @return a bare-signal broadcast event (no payload, no target)
     */
    public static BroadcastEvent of(String name) {
        return new BroadcastEvent(name, null, null);
    }

    /**
     * @param component the target component name (the client routes only to mounted components of it)
     * @param name the event name
     * @param detail the payload (JSON-shaped), may be {@code null}
     * @return a per-component broadcast event
     */
    public static BroadcastEvent to(
            String component, String name, @Nullable Map<String, Object> detail) {
        return new BroadcastEvent(
                name, detail, Objects.requireNonNull(component, "component"));
    }
}
