/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.component;

import java.lang.reflect.Method;

import org.jspecify.annotations.Nullable;

import io.lievit.LievitRenderless;

/**
 * Implements {@code @LievitRenderless} (ADR-0031, Livewire {@code #[Renderless]} parity): an action
 * marked renderless skips the re-render, so the response carries no HTML patch and the client leaves
 * the DOM untouched.
 *
 * <p>Registered on {@link LifecyclePhase#CALL} (it tallies whether each invoked action renders) and
 * {@link LifecyclePhase#RENDER} (it skips the render when every invoked action was renderless). A
 * magic action (a {@code $}-prefixed call) is not tallied: {@code $set} / {@code $refresh} re-render
 * normally. A call with no action at all (a pure {@code wire:model} update) also re-renders.
 */
public final class RenderlessListener implements LifecycleListener {

    /**
     * Registers this listener on the CALL and RENDER phases.
     *
     * @param bus the lifecycle bus
     * @return the same bus, for chaining
     */
    public static LifecycleBus registerOn(LifecycleBus bus) {
        RenderlessListener listener = new RenderlessListener();
        bus.on(LifecyclePhase.CALL, listener);
        bus.on(LifecyclePhase.RENDER, listener);
        return bus;
    }

    @Override
    public @Nullable Runnable before(LifecycleContext ctx) {
        return switch (ctx.phase()) {
            case CALL -> {
                String call = ctx.callName();
                if (call != null && !MagicAction.isMagic(call)) {
                    Method action = ctx.metadata().action(call);
                    // A real action: tally whether it is renderless. An unknown call name resolves
                    // to no action (the dispatcher will reject it); do not tally it.
                    if (action != null) {
                        ctx.recordAction(action.isAnnotationPresent(LievitRenderless.class));
                    }
                }
                yield null;
            }
            case RENDER -> {
                if (ctx.allActionsRenderless()) {
                    ctx.requestSkipRender();
                }
                yield null;
            }
            default -> null;
        };
    }
}
