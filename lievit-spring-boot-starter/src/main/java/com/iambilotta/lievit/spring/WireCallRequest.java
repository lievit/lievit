/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package com.iambilotta.lievit.spring;

import java.util.List;
import java.util.Map;

import org.jspecify.annotations.Nullable;

/**
 * The wire-call request body: {@code { _snapshot, _updates, _calls }} (ADR-0001, wire-protocol.md
 * phase 3). The CSRF {@code _token} is handled by Spring Security's standard filter, not carried
 * here.
 *
 * @param snapshot the signed snapshot the client carried back ({@code _snapshot})
 * @param updates the changed bound fields ({@code _updates}); may be absent
 * @param calls the action names to invoke in order ({@code _calls}); may be absent
 */
public record WireCallRequest(
        @com.fasterxml.jackson.annotation.JsonProperty("_snapshot") String snapshot,
        @com.fasterxml.jackson.annotation.JsonProperty("_updates") @Nullable
                Map<String, Object> updates,
        @com.fasterxml.jackson.annotation.JsonProperty("_calls") @Nullable List<String> calls) {

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
}
