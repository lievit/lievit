/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.spring;

import java.util.List;
import java.util.Map;

import org.jspecify.annotations.Nullable;

import com.fasterxml.jackson.annotation.JsonInclude;
import io.lievit.component.DispatchedEvent;
import io.lievit.component.LievitEffects;

/**
 * The wire-serializable form of the effects channel: the JSON object carried in the
 * {@code Lievit-Effects} response header (ADR-0012). Built from the core {@link LievitEffects} sink
 * by the web layer; only the non-null keys are emitted, so a plain action serializes to an empty
 * object (and the web layer then omits the header entirely).
 *
 * <p>The {@code errors} key is the real-time validation effect: a {@code {field: [message, ...]}}
 * map set by the dispatcher when {@link io.lievit.component.FieldValidator} returns
 * constraint violations. The client renders per-field error messages from it. Only constraint
 * messages are surfaced; no internal class names or payload content ever appear (ADR-0014).
 *
 * @param redirect the navigation the action requested, or {@code null}
 * @param dispatch the events the action queued (omitted when empty)
 * @param returns the action's return value, or {@code null}
 * @param errors per-field validation errors ({@code {fieldName: ["message", ...]}}) set when the
 *     {@link io.lievit.component.FieldValidator} found constraint violations; absent
 *     when validation passed or no validator is configured
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record WireEffects(
        @Nullable String redirect,
        @JsonInclude(JsonInclude.Include.NON_EMPTY) List<Event> dispatch,
        @Nullable Object returns,
        @JsonInclude(JsonInclude.Include.NON_EMPTY) @Nullable Map<String, List<String>> errors) {

    /**
     * One queued browser event, the serialized {@link DispatchedEvent}. The {@code to} / {@code self}
     * keys carry the routing target so the client runtime delivers the event to the right listeners
     * (ADR-0030): {@code self=true} for {@code dispatchSelf}, {@code to="component-name"} for
     * {@code dispatchTo}; both absent for a global {@code dispatch}.
     *
     * @param name the event name (the {@code CustomEvent} type)
     * @param detail the event payload, or {@code null} for a bare signal
     * @param to the target component name for {@code dispatchTo}, else {@code null}
     * @param self {@code true} for {@code dispatchSelf}, else {@code null} (omitted)
     */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record Event(
            String name,
            @Nullable Map<String, Object> detail,
            @Nullable String to,
            @Nullable Boolean self) {}

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
                        .map(WireEffects::toEvent)
                        .toList();
        return new WireEffects(
                effects.redirect(), events, effects.returnValue(), effects.validationErrors());
    }

    private static Event toEvent(DispatchedEvent d) {
        return new Event(
                d.name(),
                d.detail(),
                d.target() == DispatchedEvent.Target.TO_COMPONENT ? d.targetName() : null,
                d.target() == DispatchedEvent.Target.SELF ? Boolean.TRUE : null);
    }
}
