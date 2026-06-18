/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.component;

import java.util.concurrent.ConcurrentHashMap;
import java.util.Map;

import org.jspecify.annotations.Nullable;

import io.lievit.LievitIsolate;

/**
 * Stamps the {@code isolate} flag into the snapshot memo for a {@code @LievitIsolate} component
 * (issue #61, ADR-0075, Livewire {@code SupportIsolating} parity). The whole server-side feature is a
 * dehydrate listener: on {@link LifecyclePhase#MOUNT} and {@link LifecyclePhase#DEHYDRATE} it reflects
 * the component's {@code @LievitIsolate} annotation and, when present, writes {@code isolate: true}
 * into the memo under {@link #MEMO_KEY}, so the flag rides the signed snapshot to the client.
 *
 * <p>The client reads the flag off the snapshot memo and sends the component's updates in their own
 * request instead of bundling them into a shared multi-component commit. The server stays stateless:
 * it only emits the flag; the request bundling is the client's job, the same split the modelable
 * up-leg and the locale pinning use (ADR-0016, ADR-0037).
 *
 * <p>A component without {@code @LievitIsolate} writes nothing, so the memo (and the Counter snapshot)
 * is unchanged for the common case. The annotation lookup is cached per class (the reflection cost is
 * paid once).
 */
public final class IsolateListener implements LifecycleListener {

    /** The memo key under which the isolate flag is stored (ADR-0075). */
    public static final String MEMO_KEY = "isolate";

    private static final Map<Class<?>, Boolean> CACHE = new ConcurrentHashMap<>();

    /**
     * Registers this listener on MOUNT and DEHYDRATE (the snapshot-writing phases).
     *
     * @param bus the lifecycle bus
     * @return the same bus, for chaining
     */
    public static LifecycleBus registerOn(LifecycleBus bus) {
        IsolateListener listener = new IsolateListener();
        bus.on(LifecyclePhase.MOUNT, listener);
        bus.on(LifecyclePhase.DEHYDRATE, listener);
        return bus;
    }

    @Override
    public @Nullable Runnable before(LifecycleContext ctx) {
        return switch (ctx.phase()) {
            case MOUNT, DEHYDRATE -> {
                if (isIsolated(ctx.metadata().type())) {
                    ctx.memo().put(MEMO_KEY, Boolean.TRUE);
                }
                yield null;
            }
            default -> null;
        };
    }

    private static boolean isIsolated(Class<?> type) {
        return CACHE.computeIfAbsent(type, t -> t.isAnnotationPresent(LievitIsolate.class));
    }
}
