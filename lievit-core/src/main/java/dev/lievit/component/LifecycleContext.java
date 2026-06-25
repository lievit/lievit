/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.component;

import java.util.LinkedHashMap;
import java.util.Map;

import org.jspecify.annotations.Nullable;

/**
 * The mutable context passed to every {@link LifecycleListener} for one wire call (ADR-0022). It
 * carries the component metadata and instance, the phase-specific data (the update key/value for
 * {@link LifecyclePhase#UPDATE}, the call name for {@link LifecyclePhase#CALL}), and the control
 * signals a listener sets to amend the call:
 *
 * <ul>
 *   <li>{@link #earlyReturn()} — a {@link LifecyclePhase#CALL} listener short-circuits the method
 *       dispatch (the {@code $set}-style magic-action seam).
 *   <li>{@link #skipRender()} — a {@link LifecyclePhase#RENDER} listener marks the render skipped
 *       (the {@code renderless} seam); the dispatcher then does not invoke the render hook.
 *   <li>{@link #memo()} — a String-keyed bag a listener writes on {@link LifecyclePhase#DEHYDRATE}
 *       and reads on {@link LifecyclePhase#HYDRATE} to pin cross-cutting state across the stateless
 *       round trip (the locales / persistent-middleware pattern). The dispatcher merges the memo
 *       into the snapshot wire under a reserved key.
 * </ul>
 *
 * <p>One context per call; nothing survives between calls except the snapshot (ADR-0001).
 */
public final class LifecycleContext {

    private final ComponentMetadata metadata;
    private final Object instance;
    private final boolean mount;
    private final Map<String, Object> memo = new LinkedHashMap<>();

    private LifecyclePhase phase;
    private @Nullable String updateKey;
    private @Nullable Object updateValue;
    private @Nullable String callName;
    private boolean earlyReturn;
    private boolean skipRender;
    private int renderingActions;
    private int renderlessActions;

    /**
     * @param metadata the component metadata
     * @param instance the component instance
     * @param mount true if this is a mount pipeline, false if an update pipeline
     */
    public LifecycleContext(ComponentMetadata metadata, Object instance, boolean mount) {
        this.metadata = metadata;
        this.instance = instance;
        this.mount = mount;
        this.phase = mount ? LifecyclePhase.MOUNT : LifecyclePhase.HYDRATE;
    }

    /**
     * @return the component metadata
     */
    public ComponentMetadata metadata() {
        return metadata;
    }

    /**
     * @return the component instance
     */
    public Object instance() {
        return instance;
    }

    /**
     * @return true if this is the mount pipeline (vs an update pipeline)
     */
    public boolean isMount() {
        return mount;
    }

    /**
     * @return the phase currently being triggered
     */
    public LifecyclePhase phase() {
        return phase;
    }

    void phase(LifecyclePhase phase) {
        this.phase = phase;
    }

    /**
     * @return the field name being updated (set only during {@link LifecyclePhase#UPDATE})
     */
    public @Nullable String updateKey() {
        return updateKey;
    }

    /**
     * @return the value being applied (set only during {@link LifecyclePhase#UPDATE})
     */
    public @Nullable Object updateValue() {
        return updateValue;
    }

    void update(String key, @Nullable Object value) {
        this.updateKey = key;
        this.updateValue = value;
    }

    /**
     * @return the action name being invoked (set only during {@link LifecyclePhase#CALL})
     */
    public @Nullable String callName() {
        return callName;
    }

    void callName(@Nullable String callName) {
        this.callName = callName;
    }

    /**
     * Signals that the current {@link LifecyclePhase#CALL} should not dispatch the method (the
     * magic-action short-circuit). Reset by the dispatcher before each call.
     */
    public void requestEarlyReturn() {
        this.earlyReturn = true;
    }

    /**
     * @return true if a listener requested an early return for the current call
     */
    public boolean earlyReturn() {
        return earlyReturn;
    }

    void resetEarlyReturn() {
        this.earlyReturn = false;
    }

    /**
     * Signals that the render hook should be skipped this call (the {@code renderless} seam).
     */
    public void requestSkipRender() {
        this.skipRender = true;
    }

    /**
     * @return true if a listener marked the render skipped
     */
    public boolean skipRender() {
        return skipRender;
    }

    /**
     * Records that the action invoked this call renders (the default) or is renderless
     * ({@code @LievitRenderless}). The renderless listener reads the tally on RENDER: it skips the
     * render only when at least one renderless action ran and no rendering action did, matching
     * Livewire's "skip render when no rendering action ran" rule (ADR-0031).
     *
     * @param renderless true if the invoked action is {@code @LievitRenderless}
     */
    public void recordAction(boolean renderless) {
        if (renderless) {
            renderlessActions++;
        } else {
            renderingActions++;
        }
    }

    /**
     * @return true if at least one renderless action ran and no rendering action did (so the render
     *     can be skipped). False when no action ran at all (e.g. a pure {@code wire:model} update),
     *     which still renders.
     */
    public boolean allActionsRenderless() {
        return renderlessActions > 0 && renderingActions == 0;
    }

    /**
     * @return the cross-call memo bag (written on dehydrate, read on hydrate); never null
     */
    public Map<String, Object> memo() {
        return memo;
    }
}
