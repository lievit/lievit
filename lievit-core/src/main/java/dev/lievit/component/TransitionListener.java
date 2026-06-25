/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.component;

import java.lang.reflect.Method;

import org.jspecify.annotations.Nullable;

import dev.lievit.LievitTransition;

/**
 * Implements the {@code @LievitTransition} server effect (ADR-0034, the server half of
 * {@code l:transition}, issue #113): when a wire call invokes an action carrying
 * {@code @LievitTransition}, this listener seeds the {@code transition} control onto the per-call
 * {@link LievitEffects} sink so it rides the {@code Lievit-Effects} header and the client transition
 * feature animates (or skips) this update's morph.
 *
 * <p>Registered on {@link LifecyclePhase#CALL}, which fires <em>before</em> the action method runs
 * (see {@link WireDispatcher}). That ordering is deliberate: the annotation seeds the default, and an
 * action that decides the control at runtime by calling {@code LievitEffects.current().transition(...)}
 * inside its body overrides it (the documented imperative-wins semantics).
 *
 * <p>A magic action (a {@code $}-prefixed call) and an unknown call name carry no annotation and are
 * ignored. When several actions in one call carry the annotation, the last one wins (the sink stores
 * a single control, matching the last-write-wins of the other terminal effects). Governed by
 * ADR-0034.
 */
public final class TransitionListener implements LifecycleListener {

    /**
     * Registers this listener on the CALL phase.
     *
     * @param bus the lifecycle bus
     * @return the same bus, for chaining
     */
    public static LifecycleBus registerOn(LifecycleBus bus) {
        return bus.on(LifecyclePhase.CALL, new TransitionListener());
    }

    @Override
    public @Nullable Runnable before(LifecycleContext ctx) {
        if (ctx.phase() != LifecyclePhase.CALL) {
            return null;
        }
        String call = ctx.callName();
        if (call == null || MagicAction.isMagic(call)) {
            return null;
        }
        Method action = ctx.metadata().action(call);
        if (action == null) {
            return null;
        }
        LievitTransition annotation = action.getAnnotation(LievitTransition.class);
        if (annotation == null) {
            return null;
        }
        TransitionEffect effect =
                new TransitionEffect(
                        annotation.skip(),
                        annotation.duration() > 0 ? annotation.duration() : null,
                        annotation.name().isBlank() ? null : annotation.name());
        LievitEffects.current().transition(effect);
        return null;
    }
}
