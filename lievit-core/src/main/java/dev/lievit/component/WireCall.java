/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.component;

import java.util.List;
import java.util.Map;

import org.jspecify.annotations.Nullable;

/**
 * The outcome of one wire call through the {@link WireDispatcher}: the new {@code @Wire} state to
 * sign into the next snapshot, the {@link LievitEffects} the action(s) produced (ADR-0012), the
 * per-request computed values resolved during this call (ADR-0015), and the child components the
 * render declared (ADR-0016, nested components).
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
 * <p>{@code children} are the children the parent declared via {@link LievitChildren} during its
 * render; the web layer mounts each as an independent component and substitutes its HTML into the
 * parent's placeholder. {@code children} is empty for a leaf component (the common case), so a leaf
 * render is unchanged from before nesting existed.
 *
 * <p>{@code viewData} carries the extra view variables a component's {@code with()} method returned
 * for this render (ADR-0041, #65, Livewire {@code with()} parity): derived data the template needs
 * that is NOT persisted {@code @Wire} state. It is never signed into the snapshot (like computed, it
 * is rederived each render) and the template adapter merges it into the model AFTER the {@code @Wire}
 * state, so a {@code with()} entry takes precedence over a same-named property. Empty for a
 * component without a {@code with()} method (the common case).
 *
 * @param wire the serialized new {@code @Wire} state after the actions ran
 * @param effects the side effects the call produced (redirect / dispatch / return value)
 * @param computed the memoized computed values resolved this call, keyed by method name
 * @param children the child components declared in the render, in render order (empty for a leaf)
 * @param renderSkipped whether the render hook was skipped this call (renderless / redirect)
 * @param viewData the extra view variables the {@code with()} method returned (empty if none)
 */
public record WireCall(
        Map<String, Object> wire,
        LievitEffects effects,
        Map<String, @Nullable Object> computed,
        List<ChildComponent> children,
        boolean renderSkipped,
        Map<String, @Nullable Object> viewData) {

    /**
     * Defensive copy of the children list and the view data (the wire state and effects are already
     * owned by the dispatcher).
     */
    public WireCall {
        children = List.copyOf(children);
        viewData = Map.copyOf(viewData);
    }

    /**
     * Keeps the five-argument call sites intact (no {@code with()} data): {@code viewData} defaults
     * to empty.
     *
     * @param wire the serialized new {@code @Wire} state
     * @param effects the side effects the call produced
     * @param computed the memoized computed values resolved this call
     * @param children the child components declared in the render
     * @param renderSkipped whether the render hook was skipped this call
     */
    public WireCall(
            Map<String, Object> wire,
            LievitEffects effects,
            Map<String, @Nullable Object> computed,
            List<ChildComponent> children,
            boolean renderSkipped) {
        this(wire, effects, computed, children, renderSkipped, Map.of());
    }

    /**
     * The common constructor (render not skipped, no {@code with()} data): keeps the four-argument
     * call sites and golden tests intact. {@code renderSkipped} defaults to {@code false}.
     *
     * @param wire the serialized new {@code @Wire} state
     * @param effects the side effects the call produced
     * @param computed the memoized computed values resolved this call
     * @param children the child components declared in the render
     */
    public WireCall(
            Map<String, Object> wire,
            LievitEffects effects,
            Map<String, @Nullable Object> computed,
            List<ChildComponent> children) {
        this(wire, effects, computed, children, false, Map.of());
    }
}
