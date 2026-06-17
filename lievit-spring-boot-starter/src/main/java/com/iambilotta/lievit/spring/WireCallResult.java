/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package com.iambilotta.lievit.spring;

import org.jspecify.annotations.Nullable;

/**
 * The outcome of a successful wire call: the freshly rendered HTML fragment, the next signed
 * snapshot the client must carry into the following call, and the optional effects channel
 * (ADR-0001, ADR-0012, wire-protocol.md phase 4).
 *
 * @param html the rendered component HTML (the 200 response body)
 * @param snapshot the next signed snapshot (the {@code Lievit-Snapshot} response header)
 * @param effects the compact JSON effects bag (the {@code Lievit-Effects} response header), or
 *     {@code null} when the call produced no effects (the header is then omitted: a no-effects call
 *     is byte-for-byte the ADR-0001 response)
 */
public record WireCallResult(String html, String snapshot, @Nullable String effects) {

    /**
     * A result with no effects (the common case: an action that only mutates state).
     *
     * @param html the rendered HTML
     * @param snapshot the next signed snapshot
     * @return a result whose {@code effects} is {@code null}
     */
    public static WireCallResult of(String html, String snapshot) {
        return new WireCallResult(html, snapshot, null);
    }
}
