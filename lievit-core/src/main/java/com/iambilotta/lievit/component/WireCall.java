/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package com.iambilotta.lievit.component;

import java.util.Map;

import org.jspecify.annotations.Nullable;

/**
 * The outcome of one wire call through the {@link WireDispatcher}: the new {@code @Wire} state to
 * sign into the next snapshot, the {@link LievitEffects} the action(s) produced, and the
 * per-request computed values resolved during this call (ADR-0012, ADR-0015).
 *
 * <p>The effects are server-authored and never signed (they are not round-tripped from the client);
 * they ride the {@code Lievit-Effects} response header. {@link LievitEffects#isEmpty()} is true for
 * a plain action (the Counter), in which case the web layer omits the header (backward compatible).
 *
 * <p>The computed map carries the values of {@code @LievitComputed} methods that were resolved
 * during this call (at most once each). Computed values are never serialized into the snapshot;
 * they are rederived on every render from the {@code @Wire} state. The template adapter merges
 * them into the template model alongside the {@code @Wire} fields.
 *
 * @param wire the serialized new {@code @Wire} state after the actions ran
 * @param effects the side effects the call produced (redirect / dispatch / return value)
 * @param computed the memoized computed values resolved this call, keyed by method name
 */
public record WireCall(
        Map<String, Object> wire,
        LievitEffects effects,
        Map<String, @Nullable Object> computed) {}
