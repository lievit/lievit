/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package com.iambilotta.lievit.component;

import java.util.List;
import java.util.Map;

/**
 * The outcome of one wire call through the {@link WireDispatcher}: the new {@code @Wire} state to
 * sign into the next snapshot, the {@link LievitEffects} the action(s) produced (ADR-0012), and the
 * child components the render declared (ADR-0015, nested components).
 *
 * <p>The effects are server-authored and never signed (they are not round-tripped from the client);
 * they ride the {@code Lievit-Effects} response header. {@link LievitEffects#isEmpty()} is true for
 * a plain action (the Counter), in which case the web layer omits the header (backward compatible).
 *
 * <p>{@code children} are the children the parent declared via {@link LievitChildren} during its
 * render; the web layer mounts each as an independent component and substitutes its HTML into the
 * parent's placeholder. {@code children} is empty for a leaf component (the common case), so a leaf
 * render is unchanged from before nesting existed.
 *
 * @param wire the serialized new {@code @Wire} state after the actions ran
 * @param effects the side effects the call produced (redirect / dispatch / return value)
 * @param children the child components declared in the render, in render order (empty for a leaf)
 */
public record WireCall(
        Map<String, Object> wire, LievitEffects effects, List<ChildComponent> children) {

    /**
     * Defensive copy of the children list (the wire state and effects are already owned by the
     * dispatcher).
     */
    public WireCall {
        children = List.copyOf(children);
    }
}
