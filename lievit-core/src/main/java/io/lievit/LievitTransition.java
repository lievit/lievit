/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Marks an {@code @LievitAction} method as transition-controlling: when the action runs, lievit
 * emits a {@code transition} effect (ADR-0034, the server half of {@code l:transition}, issue #113)
 * that the client transition feature reads for <em>this</em> update's morph. The client animates the
 * morph (View Transitions API, or per-element fade fallback) honoring this control rather than only
 * the static {@code l:transition} markup.
 *
 * <p>Two server-driven controls, both optional:
 *
 * <ul>
 *   <li>{@link #skip()} = {@code true}: suppress any transition for this update (a server-driven
 *       opt-out, e.g. a poll tick that must not animate). Overrides the static markup for the call.
 *   <li>{@link #duration()} &gt; 0: override the per-element animation duration (ms) for this
 *       update. {@code 0} (the default) leaves the per-element {@code l:transition.duration.Nms}
 *       modifier in charge.
 * </ul>
 *
 * <p>An optional {@link #name()} selects a named transition the client transition feature
 * recognises (e.g. {@code "fade"}); blank leaves the client default. The effect is per-update and
 * request-scoped: it rides the {@code Lievit-Effects} header and is cleared on the next call (a call
 * with no {@code @LievitTransition} action clears it, so the static markup decides again).
 *
 * <p>This is the declarative form of the imperative {@link io.lievit.component.LievitEffects#transition}
 * runtime API: an action that needs to decide the control at runtime (skip only when nothing
 * changed) calls {@code LievitEffects.current().transition(...)} instead. If both are present the
 * imperative call wins (it runs inside the action body, after the annotation seeded the default).
 *
 * <p>If a call invokes several actions, the last {@code @LievitTransition} (or imperative
 * {@code transition()} call) wins, matching the last-write-wins of the other terminal effects.
 *
 * <p>Adding {@code @LievitTransition} is governed by ADR-0034.
 */
@Documented
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface LievitTransition {

    /**
     * @return {@code true} to suppress any transition for this update (server-driven opt-out)
     */
    boolean skip() default false;

    /**
     * @return the override animation duration in milliseconds for this update, or {@code 0} to leave
     *     the per-element default ({@code l:transition.duration.Nms}) in charge
     */
    int duration() default 0;

    /**
     * @return a named transition the client transition feature recognises (e.g. {@code "fade"}), or
     *     blank to leave the client default
     */
    String name() default "";
}
