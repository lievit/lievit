/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.component;

import java.util.Map;

import org.jspecify.annotations.Nullable;

/**
 * An event the client routed back to a listening component for server-side handling (ADR-0030, the
 * receiving half of the {@code dispatch} effect). When component A dispatches {@code saved} (the
 * {@code dispatch} effect), the client re-emits it as a DOM {@code CustomEvent} and, for every
 * component B that declares an {@code @LievitOn("saved")} listener, issues a wire call carrying this
 * inbound event. The dispatcher resolves B's matching {@code @LievitOn} method (via {@link
 * EventListenerMetadata}) and invokes it with the detail.
 *
 * <p>This is distinct from a client {@code _calls} action: an inbound event targets a listener
 * (never the {@code @LievitAction} allowlist), and its handler may be a no-handler class-level
 * {@code $refresh} listener (then it only triggers a re-render).
 *
 * @param name the resolved event name (placeholders already interpolated client-side from the
 *     dispatching component, then matched against the listener's resolved name on the server)
 * @param detail the event payload (JSON-shaped) bound to the handler's parameters; may be
 *     {@code null} for a bare signal event
 */
public record InboundEvent(String name, @Nullable Map<String, Object> detail) {

    /**
     * @param name the event name (must be non-blank)
     */
    public InboundEvent {
        if (name == null || name.isBlank()) {
            throw new IllegalArgumentException("an inbound event needs a non-blank name");
        }
    }
}
