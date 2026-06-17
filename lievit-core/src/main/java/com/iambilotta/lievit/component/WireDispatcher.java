/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package com.iambilotta.lievit.component;

import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.jspecify.annotations.Nullable;

import com.iambilotta.lievit.wire.WireError;
import com.iambilotta.lievit.wire.WireException;

/**
 * Drives the stateless component lifecycle for one wire call (ADR-0001, wire-protocol.md phases
 * 1-4). Pure Java, zero Spring (ADR-0007).
 *
 * <p>The two entry points are {@link #mount(ComponentMetadata, Object)} (first page load: run the
 * {@code @LievitMount} hook, then read the initial {@code @Wire} state) and
 * {@link #call(ComponentMetadata, Object, Map, Map, List)} (an interaction: rehydrate the snapshot
 * state, apply the client {@code _updates}, invoke the {@code _calls} actions in order, read back
 * the new state).
 *
 * <p>The load-bearing security rule lives in {@link #applyUpdates}: a {@code @Wire} field marked
 * {@code @LievitProperty(locked = true)} rejects any inbound update with a {@link
 * WireError#LOCKED_PROPERTY}. The snapshot signature stops tampering between requests; the lock
 * stops the first request from writing a server-owned field (ADR-0001 amendment).
 */
public final class WireDispatcher {

    /**
     * Mounts a fresh component: runs its {@code @LievitMount} hook (if any), then reads the initial
     * {@code @Wire} state for the first snapshot.
     *
     * @param metadata the component metadata
     * @param instance a fresh component instance
     * @return the serialized initial {@code @Wire} state ({@code serialize = true} fields only)
     */
    public Map<String, Object> mount(ComponentMetadata metadata, Object instance) {
        invokeHook(metadata.mount(), instance);
        invokeHook(metadata.render(), instance);
        return readWire(metadata, instance);
    }

    /**
     * Runs one wire call against a rehydrated component.
     *
     * @param metadata the component metadata
     * @param instance a fresh component instance to rehydrate onto
     * @param snapshotWire the {@code @Wire} state decoded from the verified snapshot
     * @param updates the client-supplied field updates ({@code _updates})
     * @param calls the action names to invoke, in order ({@code _calls})
     * @return the new {@code @Wire} state plus any {@link LievitEffects} the actions produced
     * @throws WireException {@link WireError#LOCKED_PROPERTY} if an update targets a locked field;
     *     {@link WireError#UNKNOWN_COMPONENT} if a call names no {@code @LievitAction}
     */
    public WireCall call(
            ComponentMetadata metadata,
            Object instance,
            Map<String, Object> snapshotWire,
            Map<String, Object> updates,
            List<String> calls) {
        LievitEffects effects = new LievitEffects();
        LievitEffects.bind(effects);
        try {
            rehydrate(metadata, instance, snapshotWire);
            applyUpdates(metadata, instance, updates);
            for (String call : calls) {
                effects.captureReturn(invokeAction(metadata, instance, call));
            }
            invokeHook(metadata.render(), instance);
            return new WireCall(readWire(metadata, instance), effects);
        } finally {
            LievitEffects.clear();
        }
    }

    /** Rehydrates every {@code @Wire} field present in the verified snapshot state. */
    private void rehydrate(
            ComponentMetadata metadata, Object instance, Map<String, Object> snapshotWire) {
        for (Map.Entry<String, Object> entry : snapshotWire.entrySet()) {
            WireField field = metadata.wireFields().get(entry.getKey());
            if (field != null) {
                field.write(instance, entry.getValue());
            }
        }
    }

    /**
     * Applies client field updates, rejecting any that target a locked field. An update for an
     * unknown (non-{@code @Wire}) name is ignored, not an error: the snapshot signature already
     * bounds what a non-malicious client sends, and a stray key is treated as noise.
     */
    private void applyUpdates(
            ComponentMetadata metadata, Object instance, Map<String, Object> updates) {
        for (Map.Entry<String, Object> entry : updates.entrySet()) {
            WireField field = metadata.wireFields().get(entry.getKey());
            if (field == null) {
                continue;
            }
            if (field.locked()) {
                throw new WireException(
                        WireError.LOCKED_PROPERTY,
                        "client update rejected for locked @Wire field");
            }
            field.write(instance, entry.getValue());
        }
    }

    private @Nullable Object invokeAction(ComponentMetadata metadata, Object instance, String name) {
        Method action = metadata.action(name);
        if (action == null) {
            // An unknown action means the client named a method the component does not expose,
            // typically a stale build; the component the snapshot names no longer has that action.
            throw new WireException(
                    WireError.UNKNOWN_COMPONENT, "no @LievitAction matches the requested call");
        }
        return invoke(action, instance);
    }

    private void invokeHook(Method hook, Object instance) {
        if (hook != null) {
            invoke(hook, instance);
        }
    }

    private @Nullable Object invoke(Method method, Object instance) {
        try {
            return method.invoke(instance);
        } catch (IllegalAccessException e) {
            throw new IllegalStateException("cannot invoke " + method.getName(), e);
        } catch (InvocationTargetException e) {
            Throwable cause = e.getCause();
            if (cause instanceof RuntimeException re) {
                throw re;
            }
            throw new IllegalStateException("action threw a checked exception", cause);
        }
    }

    private Map<String, Object> readWire(ComponentMetadata metadata, Object instance) {
        Map<String, Object> wire = new LinkedHashMap<>();
        for (WireField field : metadata.wireFields().values()) {
            if (field.serialize()) {
                wire.put(field.name(), field.read(instance));
            }
        }
        return wire;
    }
}
