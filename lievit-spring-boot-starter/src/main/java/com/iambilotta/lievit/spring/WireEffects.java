/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package com.iambilotta.lievit.spring;

import java.util.List;
import java.util.Map;

import org.jspecify.annotations.Nullable;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.iambilotta.lievit.component.DispatchedEvent;
import com.iambilotta.lievit.component.LievitEffects;

/**
 * The wire-serializable form of the effects channel: the JSON object carried in the
 * {@code Lievit-Effects} response header (ADR-0012). Built from the core {@link LievitEffects} sink
 * by the web layer; only the non-null keys are emitted, so a plain action serializes to an empty
 * object (and the web layer then omits the header entirely).
 *
 * @param redirect the navigation the action requested, or {@code null}
 * @param dispatch the events the action queued (omitted when empty)
 * @param returns the action's return value, or {@code null}
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record WireEffects(
        @Nullable String redirect,
        @JsonInclude(JsonInclude.Include.NON_EMPTY) List<Event> dispatch,
        @Nullable Object returns) {

    /**
     * One queued browser event, the serialized {@link DispatchedEvent}.
     *
     * @param name the event name (the {@code CustomEvent} type)
     * @param detail the event payload, or {@code null} for a bare signal
     */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record Event(String name, @Nullable Map<String, Object> detail) {}

    /**
     * Projects the core effects sink into its wire form.
     *
     * @param effects the per-call effects sink
     * @return the serializable effects, or {@code null} if the sink produced nothing (the header is
     *     then omitted, keeping a no-effects call byte-for-byte compatible with ADR-0001)
     */
    public static @Nullable WireEffects from(LievitEffects effects) {
        if (effects.isEmpty()) {
            return null;
        }
        List<Event> events =
                effects.dispatched().stream()
                        .map(d -> new Event(d.name(), d.detail()))
                        .toList();
        return new WireEffects(effects.redirect(), events, effects.returnValue());
    }
}
