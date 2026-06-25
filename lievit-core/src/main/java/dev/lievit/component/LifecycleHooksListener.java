/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.component;

import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;

import org.jspecify.annotations.Nullable;

/**
 * Dispatches a component's convention-named {@link LifecycleHooks} (boot/booted, hydrate/dehydrate,
 * updating/updated incl. per-property, rendering/rendered) through the {@link LifecycleBus} at the
 * matching phase (ADR-0030, Livewire {@code SupportLifecycleHooks} parity). One instance is
 * registered on every relevant phase; the dispatcher fires it with the call context.
 *
 * <p>Ordering (the load-bearing part, asserted by an invariant test):
 *
 * <ul>
 *   <li><b>boot</b> runs first on both pipelines (a {@code before} on MOUNT and HYDRATE), <b>booted</b>
 *       as the corresponding finish callback (after the mount / hydrate work).
 *   <li><b>hydrate</b> on HYDRATE; <b>dehydrate</b> on DEHYDRATE — the round-trip seam.
 *   <li><b>updating</b> / per-property {@code updatingFoo} run on UPDATE <em>before</em> the field is
 *       written, so they see the OLD value; <b>updated</b> / {@code updatedFoo} run as the UPDATE
 *       finish callback, after the write, so they see the NEW value (Livewire's contract).
 *   <li><b>rendering</b> on RENDER before the render hook; <b>rendered</b> as its finish callback.
 * </ul>
 *
 * <p>The user hooks are never reachable as a frontend action (only an {@code @LievitAction} is in the
 * call allowlist, ADR-0013).
 */
public final class LifecycleHooksListener implements LifecycleListener {

    /**
     * Registers this listener on every phase a user hook can fire at. Call once when building the
     * bus; the listener no-ops for a component that declares no hooks.
     *
     * @param bus the lifecycle bus to register on
     * @return the same bus, for chaining
     */
    public static LifecycleBus registerOn(LifecycleBus bus) {
        LifecycleHooksListener listener = new LifecycleHooksListener();
        bus.on(LifecyclePhase.MOUNT, listener);
        bus.on(LifecyclePhase.HYDRATE, listener);
        bus.on(LifecyclePhase.UPDATE, listener);
        bus.on(LifecyclePhase.RENDER, listener);
        bus.on(LifecyclePhase.DEHYDRATE, listener);
        return bus;
    }

    @Override
    public @Nullable Runnable before(LifecycleContext ctx) {
        LifecycleHooks hooks = LifecycleHooks.of(ctx.metadata().type());
        if (hooks.isEmpty()) {
            return null;
        }
        Object instance = ctx.instance();
        return switch (ctx.phase()) {
            case MOUNT, HYDRATE -> {
                // boot runs before mount/hydrate work; hydrate() (update pipeline only) on HYDRATE;
                // booted runs as the finish, after.
                invoke(hooks.boot(), instance);
                if (ctx.phase() == LifecyclePhase.HYDRATE) {
                    invoke(hooks.hydrate(), instance);
                }
                yield () -> invoke(hooks.booted(), instance);
            }
            case UPDATE -> {
                // Before the write: updating() + updatingFoo(value) see the OLD value.
                String key = ctx.updateKey();
                Object value = ctx.updateValue();
                invoke(hooks.updating(), instance);
                if (key != null) {
                    invokeWithValue(hooks.updatingProp(propRoot(key)), instance, value);
                }
                // The finish (run after ALL writes): updated() + updatedFoo(value) see the NEW value.
                yield () -> {
                    invoke(hooks.updated(), instance);
                    if (key != null) {
                        invokeWithValue(hooks.updatedProp(propRoot(key)), instance, value);
                    }
                };
            }
            case RENDER -> {
                invoke(hooks.rendering(), instance);
                yield () -> invoke(hooks.rendered(), instance);
            }
            case DEHYDRATE -> {
                // dehydrate runs as the state is read back (before the snapshot is sealed).
                invoke(hooks.dehydrate(), instance);
                yield null;
            }
            default -> null;
        };
    }

    /** The root field name of a possibly-dotted update key ({@code form.email} -> {@code form}). */
    private static String propRoot(String key) {
        int dot = key.indexOf('.');
        return dot < 0 ? key : key.substring(0, dot);
    }

    private static void invoke(@Nullable Method hook, Object instance) {
        if (hook == null) {
            return;
        }
        try {
            hook.invoke(instance);
        } catch (IllegalAccessException e) {
            throw new IllegalStateException("cannot invoke lifecycle hook " + hook.getName(), e);
        } catch (InvocationTargetException e) {
            rethrow(e);
        }
    }

    private static void invokeWithValue(@Nullable Method hook, Object instance, @Nullable Object value) {
        if (hook == null) {
            return;
        }
        try {
            hook.invoke(instance, value);
        } catch (IllegalAccessException e) {
            throw new IllegalStateException("cannot invoke lifecycle hook " + hook.getName(), e);
        } catch (IllegalArgumentException e) {
            // The hook's parameter type did not accept the raw update value; skip rather than 500.
        } catch (InvocationTargetException e) {
            rethrow(e);
        }
    }

    private static void rethrow(InvocationTargetException e) {
        Throwable cause = e.getCause();
        if (cause instanceof RuntimeException re) {
            throw re;
        }
        throw new IllegalStateException("lifecycle hook threw a checked exception", cause);
    }
}
