/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.spring;

import java.util.List;
import java.util.Map;

import org.jspecify.annotations.Nullable;

/**
 * The wire-call request body: {@code { _snapshot, _updates, _calls, _events }} (ADR-0001, ADR-0030,
 * wire-protocol.md phase 3). The CSRF {@code _token} is handled by Spring Security's standard
 * filter, not carried here.
 *
 * @param snapshot the signed snapshot the client carried back ({@code _snapshot})
 * @param updates the changed bound fields ({@code _updates}); may be absent
 * @param calls the action names to invoke in order ({@code _calls}); may be absent
 * @param events the inbound events the client routed to this component's {@code @LievitOn} listeners
 *     ({@code _events}); may be absent (ADR-0030)
 */
public record WireCallRequest(
        @com.fasterxml.jackson.annotation.JsonProperty("_snapshot") String snapshot,
        @com.fasterxml.jackson.annotation.JsonProperty("_updates") @Nullable
                Map<String, Object> updates,
        @com.fasterxml.jackson.annotation.JsonProperty("_calls") @Nullable List<String> calls,
        @com.fasterxml.jackson.annotation.JsonProperty("_events") @Nullable
                List<InboundEventDto> events) {

    /**
     * The wire form of one inbound event: {@code { name, detail }} (ADR-0030).
     *
     * @param name the resolved event name
     * @param detail the event payload (JSON-shaped), or {@code null} for a bare signal
     */
    public record InboundEventDto(String name, @Nullable Map<String, Object> detail) {}

    /**
     * @return the updates map, never null (an absent {@code _updates} is an empty map)
     */
    public Map<String, Object> updatesOrEmpty() {
        return updates == null ? Map.of() : updates;
    }

    /**
     * @return the calls list, never null (an absent {@code _calls} is an empty list)
     */
    public List<String> callsOrEmpty() {
        return calls == null ? List.of() : calls;
    }

    /**
     * @return the inbound events as core {@link io.lievit.component.InboundEvent}s, never null (an
     *     absent {@code _events} is an empty list)
     */
    public List<io.lievit.component.InboundEvent> inboundEvents() {
        if (events == null) {
            return List.of();
        }
        return events.stream()
                .map(e -> new io.lievit.component.InboundEvent(e.name(), e.detail()))
                .toList();
    }
}
