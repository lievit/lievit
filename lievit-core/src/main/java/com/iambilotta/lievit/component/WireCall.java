/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package com.iambilotta.lievit.component;

import java.util.Map;

/**
 * The outcome of one wire call through the {@link WireDispatcher}: the new {@code @Wire} state to
 * sign into the next snapshot, plus the {@link LievitEffects} the action(s) produced (ADR-0012).
 *
 * <p>The effects are server-authored and never signed (they are not round-tripped from the client);
 * they ride the {@code Lievit-Effects} response header. {@link LievitEffects#isEmpty()} is true for
 * a plain action (the Counter), in which case the web layer omits the header (backward compatible).
 *
 * @param wire the serialized new {@code @Wire} state after the actions ran
 * @param effects the side effects the call produced (redirect / dispatch / return value)
 */
public record WireCall(Map<String, Object> wire, LievitEffects effects) {}
