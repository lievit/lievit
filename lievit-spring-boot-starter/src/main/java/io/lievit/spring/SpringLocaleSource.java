/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.spring;

import java.util.Locale;

import org.jspecify.annotations.Nullable;
import org.springframework.context.i18n.LocaleContextHolder;

import io.lievit.component.LocaleSource;

/**
 * The {@code LocaleContextHolder}-backed {@link LocaleSource} the starter binds for the duration of a
 * wire call (ADR-0037, Livewire {@code SupportLocales} parity). The core stays Spring-free (ADR-0007):
 * this adapter is the only place that knows about Spring's request-scoped locale.
 *
 * <p>{@link #get()} returns the locale Spring resolved for the request (via the configured
 * {@code LocaleResolver}: {@code Accept-Language}, a cookie, a session, etc.). {@link #set(Locale)}
 * writes onto {@link LocaleContextHolder}, which is the canonical Spring idiom for changing the
 * active locale for the rest of the request, so {@code MessageSource} resolution and JTE i18n that
 * run during the render use the pinned locale rather than the request default.
 *
 * <p>Stateless: this holds no state; {@link LocaleContextHolder} is the (request-scoped) state, reset
 * by Spring per request. The pinned tag itself rides the signed snapshot memo, not the holder.
 */
public final class SpringLocaleSource implements LocaleSource {

    /** Singleton: stateless, thread-safe (it only delegates to the request-scoped holder). */
    public static final SpringLocaleSource INSTANCE = new SpringLocaleSource();

    private SpringLocaleSource() {}

    @Override
    public @Nullable Locale get() {
        return LocaleContextHolder.getLocale();
    }

    @Override
    public void set(Locale locale) {
        LocaleContextHolder.setLocale(locale);
    }
}
