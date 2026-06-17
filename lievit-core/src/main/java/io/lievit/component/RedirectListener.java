/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.component;

import org.jspecify.annotations.Nullable;

/**
 * Skips the re-render when an action queued a redirect (ADR-0031, Livewire {@code SupportRedirects}
 * default {@code render_on_redirect = false}). An action calls {@code LievitEffects.current()
 * .redirect("/path")}; the {@code redirect} effect already rides the {@code Lievit-Effects} header
 * (ADR-0012). This RENDER-phase listener additionally marks the render skipped so the response
 * carries no wasted HTML the client is about to throw away when it navigates.
 *
 * <p>Registered on {@link LifecyclePhase#RENDER}. It reads the bound {@link LievitEffects#current()}
 * sink for the in-flight call; if a redirect is queued it requests skip-render. (Livewire allows
 * opting back into rendering on redirect; lievit defers that toggle until a component needs it, the
 * default-skip is the common case.)
 */
public final class RedirectListener implements LifecycleListener {

    /**
     * Registers this listener on the RENDER phase.
     *
     * @param bus the lifecycle bus
     * @return the same bus, for chaining
     */
    public static LifecycleBus registerOn(LifecycleBus bus) {
        return bus.on(LifecyclePhase.RENDER, new RedirectListener());
    }

    @Override
    public @Nullable Runnable before(LifecycleContext ctx) {
        if (ctx.phase() != LifecyclePhase.RENDER) {
            return null;
        }
        // A redirect was queued this call: skip the render (render_on_redirect = false default).
        if (LievitEffects.current().redirect() != null) {
            ctx.requestSkipRender();
        }
        return null;
    }
}
