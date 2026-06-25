/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.component;

import org.jspecify.annotations.Nullable;

/**
 * The {@code transition} effect ({@code l:transition} / {@code @LievitTransition}, issue #113,
 * ADR-0034): an action's server-driven control over <em>this</em> update's morph animation. It
 * rides the {@code Lievit-Effects} header alongside any {@code redirect} / {@code dispatch} /
 * {@code url}; the client transition feature reads it once per morph (rather than only the static
 * {@code l:transition} markup) and animates accordingly.
 *
 * <p>The control is per-update and request-scoped: a call with no {@code @LievitTransition} action
 * (and no imperative {@link LievitEffects#transition} call) emits no effect, so the client falls back
 * to the static markup. All three fields are optional:
 *
 * <ul>
 *   <li>{@link #skip()}: {@code true} suppresses any transition for this update (server-driven
 *       opt-out). When {@code true}, {@code duration} / {@code name} are irrelevant.
 *   <li>{@link #duration()}: an override duration in ms ({@code null} leaves the per-element
 *       {@code l:transition.duration.Nms} default in charge).
 *   <li>{@link #name()}: a named transition the client recognises (e.g. {@code "fade"}); {@code null}
 *       leaves the client default.
 * </ul>
 *
 * @param skip {@code true} to suppress any transition for this update
 * @param duration the override animation duration in ms, or {@code null} for the per-element default
 * @param name a named transition the client recognises, or {@code null} for the client default
 */
public record TransitionEffect(boolean skip, @Nullable Integer duration, @Nullable String name) {

    /**
     * Normalises the record: a non-positive duration is treated as "no override" ({@code null}) and a
     * blank name is treated as "no name" ({@code null}), so the wire form omits empty keys.
     *
     * @param skip whether to suppress the transition
     * @param duration the override duration (ms); non-positive becomes {@code null}
     * @param name the transition name; blank becomes {@code null}
     */
    public TransitionEffect {
        if (duration != null && duration <= 0) {
            duration = null;
        }
        if (name != null && name.isBlank()) {
            name = null;
        }
    }

    /**
     * @return a skip-everything transition control (the server opts this update out of animation)
     */
    public static TransitionEffect skipped() {
        return new TransitionEffect(true, null, null);
    }
}
