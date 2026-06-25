/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.component;

import java.util.Locale;

import org.jspecify.annotations.Nullable;

/**
 * Pins the active locale across a component's stateless round trip (ADR-0037, Livewire
 * {@code SupportLocales} parity). Livewire's whole locale feature is two listeners: on
 * {@code dehydrate} store {@code app()->getLocale()} in the snapshot memo; on {@code hydrate}
 * {@code app()->setLocale($memo['locale'])}. lievit mirrors this exactly through the lifecycle bus
 * (ADR-0022) and the snapshot memo (the {@code @memo} bag the {@link WireDispatcher} round-trips):
 *
 * <ul>
 *   <li>{@link LifecyclePhase#DEHYDRATE}: read the active {@link Locale} from the bound
 *       {@link LocaleSource} and store its language tag in the memo under {@link #MEMO_KEY}, so it
 *       rides the signed snapshot to the next request.
 *   <li>{@link LifecyclePhase#HYDRATE} / {@link LifecyclePhase#MOUNT}: read the tag back from the
 *       memo and call {@link LocaleSource#set} <em>before</em> the render, so the component renders
 *       in its pinned locale even though the fresh HTTP request resolved a different default.
 * </ul>
 *
 * <p>The core is Spring-free (ADR-0007): the starter binds a {@link LocaleSource} backed by Spring's
 * {@code LocaleContextHolder} for the duration of a wire call via {@link #bind} (a
 * {@link ThreadLocal}, like {@link SessionListener} and {@link LievitEffects}). When no source is
 * bound (a unit test, or an app without web i18n), the listener no-ops, so a component still works
 * statelessly (the locale simply tracks the request default).
 *
 * <p>The locale tag lives in the memo, not the HTTP session: it survives the round trip via the
 * signed snapshot, so it is per-component (two components on a page can pin different locales) and
 * needs no server-side session. The memo is HMAC-signed (ADR-0001), so the tag cannot be tampered.
 */
public final class LocaleListener implements LifecycleListener {

    /** The memo key under which the pinned locale's language tag is stored (ADR-0037). */
    public static final String MEMO_KEY = "locale";

    private static final ThreadLocal<LocaleSource> CURRENT = new ThreadLocal<>();

    /**
     * Registers this listener on MOUNT, HYDRATE, and DEHYDRATE.
     *
     * @param bus the lifecycle bus
     * @return the same bus, for chaining
     */
    public static LifecycleBus registerOn(LifecycleBus bus) {
        LocaleListener listener = new LocaleListener();
        bus.on(LifecyclePhase.MOUNT, listener);
        bus.on(LifecyclePhase.HYDRATE, listener);
        bus.on(LifecyclePhase.DEHYDRATE, listener);
        return bus;
    }

    /**
     * Binds a locale source for the current thread (the starter calls this around a wire call).
     *
     * @param source the request-scoped locale source
     */
    public static void bind(LocaleSource source) {
        CURRENT.set(source);
    }

    /** Clears the bound source for the current thread (the starter calls this in a finally). */
    public static void clear() {
        CURRENT.remove();
    }

    @Override
    public @Nullable Runnable before(LifecycleContext ctx) {
        LocaleSource source = CURRENT.get();
        if (source == null) {
            return null; // no source bound: stateless fallback, the locale tracks the request default
        }
        return switch (ctx.phase()) {
            // On an update, restore the pinned locale BEFORE client updates and the render run, so
            // the template (and validation messages) resolve in the component's locale, not the
            // fresh request default. The memo was seeded from the verified snapshot before HYDRATE.
            case HYDRATE -> {
                restore(ctx, source);
                yield null;
            }
            // On a mount, the memo is empty (no prior snapshot), so the listener captures the
            // request's resolved locale into the memo at MOUNT for the next round trip. Capturing on
            // MOUNT (not only DEHYDRATE) keeps the dehydrate path uniform across mount and update.
            case MOUNT -> {
                capture(ctx, source);
                yield null;
            }
            // On dehydrate, store the current (possibly just-changed) locale so it rides the snapshot.
            case DEHYDRATE -> {
                capture(ctx, source);
                yield null;
            }
            default -> null;
        };
    }

    /** Reads the memo's language tag and pins it onto the request via the source. */
    private static void restore(LifecycleContext ctx, LocaleSource source) {
        Object tag = ctx.memo().get(MEMO_KEY);
        if (tag instanceof String s && !s.isEmpty()) {
            source.set(Locale.forLanguageTag(s));
        }
    }

    /** Reads the active locale from the source and writes its language tag into the memo. */
    private static void capture(LifecycleContext ctx, LocaleSource source) {
        Locale locale = source.get();
        if (locale != null) {
            ctx.memo().put(MEMO_KEY, locale.toLanguageTag());
        }
    }
}
