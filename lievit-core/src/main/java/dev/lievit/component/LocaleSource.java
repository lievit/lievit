/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.component;

import java.util.Locale;

import org.jspecify.annotations.Nullable;

/**
 * The minimal, Spring-free abstraction the {@link LocaleListener} uses to read and write the active
 * locale of the current request (ADR-0037, Livewire {@code SupportLocales} parity). The core stays
 * Spring-free (ADR-0007): the starter provides the implementation backed by Spring's
 * {@code LocaleContextHolder} / {@code LocaleResolver}; tests use an in-memory holder.
 *
 * <p>The contract is a tag tag-team across the stateless round trip (ADR-0001): on {@code dehydrate}
 * the listener reads {@link #get()} and stores its language tag in the snapshot memo; on
 * {@code hydrate} it reads the tag back from the memo and calls {@link #set(Locale)} so template
 * message resolution ({@code MessageSource} / JTE i18n) and validation messages resolve in the
 * component's pinned locale, not the fresh request's default. Without this, a component first
 * rendered in {@code it} reverts to the server default on every subsequent wire update because each
 * update is a fresh HTTP request with no session locale.
 */
public interface LocaleSource {

    /**
     * @return the active locale of the current request, or {@code null} if none is resolved (the
     *     listener then writes nothing to the memo: the request default stands)
     */
    @Nullable Locale get();

    /**
     * Sets the active locale for the remainder of the current request, so the template render and
     * any message resolution that follows use it.
     *
     * @param locale the locale to pin (never {@code null})
     */
    void set(Locale locale);
}
