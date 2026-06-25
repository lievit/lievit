/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.component;

import org.jspecify.annotations.Nullable;

/**
 * Persists {@code @LievitSession} fields into the HTTP session and restores them (ADR-0031, Livewire
 * {@code #[Session]} parity). Registered on {@link LifecyclePhase#MOUNT} + {@link
 * LifecyclePhase#HYDRATE} (restore the stored value onto the field) and {@link
 * LifecyclePhase#DEHYDRATE} (write the current value back).
 *
 * <p>The session is request-scoped state outside lievit's stateless contract (ADR-0001), so the
 * core never holds an {@code HttpSession}: the starter binds a {@link SessionStore} for the duration
 * of the call via {@link #bind} (a {@link ThreadLocal}, like {@link LievitEffects}). When no store
 * is bound (a unit test, or session support disabled), the listener no-ops, so a component with
 * {@code @LievitSession} fields still works statelessly (the field just keeps its mount default).
 *
 * <p>Ordering on the mount pipeline: the value is restored at MOUNT <em>after</em> the
 * {@code @LievitMount} hook runs (MOUNT-phase finishers run after the mount hook), so the stored
 * value overrides the mount default, matching Livewire's "session wins over mount default". On the
 * update pipeline it restores at HYDRATE before client updates, so a {@code wire:model} update this
 * call still wins over the stored value (the update is the user's latest intent).
 */
public final class SessionListener implements LifecycleListener {

    private static final ThreadLocal<SessionStore> CURRENT = new ThreadLocal<>();

    /**
     * Registers this listener on MOUNT, HYDRATE, and DEHYDRATE.
     *
     * @param bus the lifecycle bus
     * @return the same bus, for chaining
     */
    public static LifecycleBus registerOn(LifecycleBus bus) {
        SessionListener listener = new SessionListener();
        bus.on(LifecyclePhase.MOUNT, listener);
        bus.on(LifecyclePhase.HYDRATE, listener);
        bus.on(LifecyclePhase.DEHYDRATE, listener);
        return bus;
    }

    /**
     * Binds a session store for the current thread (the starter calls this around a wire call when
     * an HTTP session is available).
     *
     * @param store the request-scoped session store
     */
    public static void bind(SessionStore store) {
        CURRENT.set(store);
    }

    /** Clears the bound store for the current thread (the starter calls this in a finally). */
    public static void clear() {
        CURRENT.remove();
    }

    @Override
    public @Nullable Runnable before(LifecycleContext ctx) {
        SessionStore store = CURRENT.get();
        if (store == null) {
            return null; // no session bound: stateless fallback, the field keeps its default
        }
        SessionFields fields = SessionFields.of(ctx.metadata().type());
        if (fields.isEmpty()) {
            return null;
        }
        Object instance = ctx.instance();
        return switch (ctx.phase()) {
            case MOUNT ->
                    // Restore as the MOUNT finish (after @LievitMount), so the stored value wins.
                    () -> restoreAll(fields, instance, store);
            case HYDRATE -> {
                // Restore before client updates so a wire:model this call still overrides it.
                restoreAll(fields, instance, store);
                yield null;
            }
            case DEHYDRATE -> {
                writeAll(fields, instance, store);
                yield null;
            }
            default -> null;
        };
    }

    private static void restoreAll(SessionFields fields, Object instance, SessionStore store) {
        for (SessionFields.Entry entry : fields.entries()) {
            Object stored = store.get(fields.resolveKey(entry, instance));
            if (stored != null) {
                entry.field().write(instance, stored);
            }
        }
    }

    private static void writeAll(SessionFields fields, Object instance, SessionStore store) {
        for (SessionFields.Entry entry : fields.entries()) {
            store.put(fields.resolveKey(entry, instance), entry.field().read(instance));
        }
    }
}
