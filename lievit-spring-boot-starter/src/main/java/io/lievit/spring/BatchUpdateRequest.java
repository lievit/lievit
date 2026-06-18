/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.spring;

import java.util.List;
import java.util.Map;

import org.jspecify.annotations.Nullable;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * The batched update request body (issue #177, Livewire {@code HandleRequests::handleUpdate}): the
 * client posts an <strong>array of components</strong> to {@code POST {prefix}/update}, each carrying
 * its own {@code {snapshot, updates, calls, events}}. A page with several islands commits them all in
 * one request instead of one HTTP round trip per island (the N+1 the per-component endpoint would
 * cause).
 *
 * <p>The field names mirror the per-component {@link WireCallRequest} but without the leading
 * underscore, because here they are nested under the {@code components[]} array rather than at the
 * request root (Livewire's batch payload uses {@code components: [{ snapshot, updates, calls }]}).
 *
 * @param components the components to commit, in order; each runs its own stateless lifecycle
 */
public record BatchUpdateRequest(@JsonProperty("components") List<Component> components) {

    /**
     * One component in the batch.
     *
     * @param snapshot the signed snapshot the client carried back for this component
     * @param updates the changed bound fields for this component (may be absent)
     * @param calls the action names to invoke in order for this component (may be absent)
     * @param events the inbound events routed to this component's {@code @LievitOn} listeners (ADR-0030)
     */
    public record Component(
            @JsonProperty("snapshot") String snapshot,
            @JsonProperty("updates") @Nullable Map<String, Object> updates,
            @JsonProperty("calls") @Nullable List<String> calls,
            @JsonProperty("events") @Nullable List<WireCallRequest.InboundEventDto> events) {

        /** @return the updates map, never null. */
        public Map<String, Object> updatesOrEmpty() {
            return updates == null ? Map.of() : updates;
        }

        /** @return the calls list, never null. */
        public List<String> callsOrEmpty() {
            return calls == null ? List.of() : calls;
        }

        /** @return the inbound events as core events, never null. */
        public List<io.lievit.component.InboundEvent> inboundEvents() {
            if (events == null) {
                return List.of();
            }
            return events.stream()
                    .map(e -> new io.lievit.component.InboundEvent(e.name(), e.detail()))
                    .toList();
        }

        /**
         * The reactive-child skip predicate (issue #177): a component with no field updates and no
         * action calls and no inbound events did nothing this request, so a reactive child whose
         * props did not change can be skipped server-side (no lifecycle, no render), answered with a
         * bare {@code {skip, id}} marker. This is the optimization that keeps a page of many islands
         * cheap when only one of them actually changed.
         *
         * @return true if this component carried no work
         */
        public boolean isInert() {
            return updatesOrEmpty().isEmpty()
                    && callsOrEmpty().isEmpty()
                    && (events == null || events.isEmpty());
        }
    }
}
