/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.component;

/**
 * The fixed, observable phases of a wire call, in dispatch order (ADR-0022, wire-protocol.md §1).
 * The {@link WireDispatcher} triggers these through the {@link LifecycleBus} so a cross-cutting
 * feature registers a listener on a named phase instead of editing the dispatcher.
 *
 * <p>Update pipeline order: {@link #HYDRATE} → {@link #UPDATE} (per update) → {@link #UPDATED}
 * (after ALL updates) → {@link #CALL} (per call) → {@link #RENDER} (skippable) → {@link #DEHYDRATE}
 * → {@link #DESTROY}. Mount pipeline: {@link #PRE_MOUNT} (reserved short-circuit) → {@link #MOUNT}
 * → {@link #RENDER} → {@link #DEHYDRATE} → {@link #DESTROY}.
 */
public enum LifecyclePhase {

    /**
     * Reserved short-circuit before mount (a future SSR / cache seam): declared so a listener can
     * register, not yet triggered by the dispatcher in v0.1.
     */
    PRE_MOUNT,

    /** A fresh component is mounted (props seeded, {@code @LievitMount} about to run). */
    MOUNT,

    /** State rehydrated from the verified snapshot, before client updates are applied. */
    HYDRATE,

    /** One client {@code _updates} field is about to be applied (the per-update phase). */
    UPDATE,

    /**
     * All client updates are applied (the deferred-finisher phase): a listener here can override
     * another update because every field is set. Runs once per call, after the last {@link #UPDATE}.
     */
    UPDATED,

    /** One client {@code _calls} action is about to be invoked (the per-call phase). */
    CALL,

    /** The render hook is about to run (skippable via {@link LifecycleContext#skipRender()}). */
    RENDER,

    /** State is read back for the next snapshot; the {@code memo} is sealed here (locales pattern). */
    DEHYDRATE,

    /** The call is finishing; per-call resources are released. */
    DESTROY
}
