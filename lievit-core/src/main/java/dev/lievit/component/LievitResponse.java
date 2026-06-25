/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.component;

import org.jspecify.annotations.Nullable;

/**
 * The per-request response-control sink: the server-side, request-scoped collector of HTTP response
 * controls a component sets while it mounts or renders (issue #123, Livewire
 * {@code SupportDisablingBackButtonCache} parity). A component reads the sink for the current request
 * via {@link #current()} and asks the framework to amend the page response. Today it carries one
 * control, {@link #disableBackButtonCache()}: opt the page out of the browser back-forward cache so a
 * sensitive/authenticated page is re-fetched on back-navigation instead of restored stale from bfcache.
 *
 * <p>Lifecycle invariant (ADR-0001 statelessness): the sink is bound to the request via a {@link
 * ThreadLocal} and reset for every request, exactly like {@link LievitEffects}, {@link LievitChildren},
 * and {@link ComponentStack}. Nothing survives between requests, so the flag resets per request and a
 * following non-lievit request is unaffected (the {@code Cache-Control} headers are added only when a
 * component on that request opted out). When no sink is bound (a unit test, or server-side code off
 * the wire), {@link #disableBackButtonCache()} is a no-op rather than a crash, so a component still
 * mounts statelessly.
 *
 * <p>This is a runtime API, not an annotation: it gives components the Livewire
 * {@code $this->disableBackButtonCache()} ergonomics without adding to the annotation surface
 * (ADR-0002), mirroring how {@link LievitEffects} added {@code redirect()} / {@code dispatch()}.
 */
public final class LievitResponse {

    private static final ThreadLocal<@Nullable LievitResponse> CURRENT = new ThreadLocal<>();

    private boolean backButtonCacheDisabled;

    /**
     * Creates a fresh response-control sink. The response filter constructs one per request and binds
     * it via {@link #bind}; nothing carries over between requests (the per-request reset).
     */
    public LievitResponse() {}

    /**
     * Disables the browser back-forward cache for the current page response (Livewire
     * {@code disableBackButtonCache()} parity). The framework adds {@code Cache-Control: no-cache,
     * no-store, must-revalidate} (plus the legacy {@code Pragma}/{@code Expires}) to the response that
     * carries this page, so a back-navigation re-fetches it from the server instead of restoring a
     * stale snapshot of an authenticated view. A no-op when no sink is bound (off the wire).
     */
    public static void disableBackButtonCache() {
        LievitResponse response = CURRENT.get();
        if (response != null) {
            response.backButtonCacheDisabled = true;
        }
    }

    /**
     * @return the response-control sink bound to the current request, or {@code null} if none is bound
     *     (the response filter binds one around every request it handles)
     */
    public static @Nullable LievitResponse current() {
        return CURRENT.get();
    }

    /** Binds {@code response} as the sink for the current thread (called by the response filter). */
    public static void bind(LievitResponse response) {
        CURRENT.set(response);
    }

    /** Clears the bound sink for the current thread (called by the response filter in a finally). */
    public static void clear() {
        CURRENT.remove();
    }

    /**
     * @return true if a component on this request opted out of the back-forward cache (so the filter
     *     adds the no-store headers); false on a fresh sink
     */
    public boolean isBackButtonCacheDisabled() {
        return backButtonCacheDisabled;
    }
}
