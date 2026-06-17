/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.component;

import org.jspecify.annotations.Nullable;

/**
 * A listener on a lifecycle phase (ADR-0022, the Livewire {@code on(name, listener)} analogue).
 * Registered against a {@link LifecyclePhase} on the {@link LifecycleBus}; the {@link WireDispatcher}
 * invokes {@link #before(LifecycleContext)} when the phase is triggered and runs the returned
 * {@code finish} callback (if any) after the phase's own work, in registration order. The
 * {@code finish} seam lets a listener observe or amend the result of a phase (the locales pattern:
 * capture the resolved locale on {@code dehydrate}).
 */
@FunctionalInterface
public interface LifecycleListener {

    /**
     * Runs when the phase is triggered.
     *
     * @param ctx the call context (read phase-specific data, set {@code earlyReturn}/{@code skipRender},
     *     write the memo)
     * @return a {@code finish} callback run after the phase, or {@code null} for none
     */
    @Nullable Runnable before(LifecycleContext ctx);
}
