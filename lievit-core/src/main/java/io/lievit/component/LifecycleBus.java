/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.component;

import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;

import org.jspecify.annotations.Nullable;

/**
 * The named-phase interceptor bus (ADR-0022, the Livewire {@code on()/trigger()} analogue): a
 * feature registers a {@link LifecycleListener} on a {@link LifecyclePhase} via {@link #on}, and the
 * {@link WireDispatcher} fires every listener for a phase via {@link #trigger}. {@code trigger}
 * collects each listener's non-null {@code finish} callback and returns them so the dispatcher runs
 * them after the phase's own work, in registration order (the {@code finish} seam lets a listener
 * amend the phase result).
 *
 * <p>This is the extension architecture: almost every cross-cutting feature (locale pinning,
 * persistent middleware, the future {@code updated{Prop}} hooks, magic actions, renderless) is a set
 * of listeners on these phases rather than a hardcoded branch in the dispatcher. Synchronous,
 * ordered, Spring-free (ADR-0007). The default (empty) bus changes no behavior, so the existing
 * dispatcher call sites and the Counter are unchanged.
 *
 * <p>Listeners are registered at construction / wiring time and read on every call; the bus is
 * effectively immutable once the dispatcher is built, so it is safe to share across calls.
 */
public final class LifecycleBus {

    private final Map<LifecyclePhase, List<LifecycleListener>> listeners =
            new EnumMap<>(LifecyclePhase.class);

    /** Constructs an empty bus (no listeners): the default, behavior-neutral. */
    public LifecycleBus() {}

    /**
     * Registers a listener on a phase. Listeners fire in registration order.
     *
     * @param phase the phase to listen on
     * @param listener the listener
     * @return this bus, for chaining
     */
    public LifecycleBus on(LifecyclePhase phase, LifecycleListener listener) {
        listeners.computeIfAbsent(phase, p -> new ArrayList<>()).add(listener);
        return this;
    }

    /**
     * Fires every listener registered on {@code phase}, in order, collecting their {@code finish}
     * callbacks. The dispatcher sets {@code ctx.phase} before calling and runs the returned
     * callbacks after the phase's own work.
     *
     * @param phase the phase being triggered
     * @param ctx the call context
     * @return the {@code finish} callbacks the listeners returned, in registration order (empty if
     *     none)
     */
    public List<Runnable> trigger(LifecyclePhase phase, LifecycleContext ctx) {
        ctx.phase(phase);
        List<LifecycleListener> forPhase = listeners.get(phase);
        if (forPhase == null || forPhase.isEmpty()) {
            return List.of();
        }
        List<Runnable> finishes = new ArrayList<>();
        for (LifecycleListener listener : forPhase) {
            @Nullable Runnable finish = listener.before(ctx);
            if (finish != null) {
                finishes.add(finish);
            }
        }
        return finishes;
    }

    /**
     * @param phase a phase
     * @return true if no listener is registered on the phase (the dispatcher can skip the trigger)
     */
    public boolean isEmpty(LifecyclePhase phase) {
        List<LifecycleListener> forPhase = listeners.get(phase);
        return forPhase == null || forPhase.isEmpty();
    }
}
