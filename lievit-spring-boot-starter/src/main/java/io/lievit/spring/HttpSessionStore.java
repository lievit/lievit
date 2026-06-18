/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.spring;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;

import org.jspecify.annotations.Nullable;

import io.lievit.component.SessionStore;

/**
 * The {@code HttpSession}-backed {@link SessionStore} for {@code @LievitSession} fields (ADR-0031).
 * It is the deliberate, opt-in bridge from lievit's stateless core (ADR-0001) to server session
 * state: the {@link io.lievit.component.SessionListener} binds an instance of this around each wire
 * call so a {@code @LievitSession} field is read from / written to the user's HTTP session.
 *
 * <p>Stored values are session attributes keyed by the resolved session key. Values must be
 * serializable for a distributed/persistent session store; lievit only writes the {@code @Wire}
 * field value, which is already JSON-round-trippable, so this holds for the common case.
 *
 * <p>{@code lazyGet} on read does not create a session (a read before any write returns {@code null}
 * without allocating a session), but a write creates the session, consistent with "the field has no
 * stored value until it is persisted".
 */
public final class HttpSessionStore implements SessionStore {

    private final HttpServletRequest request;

    /**
     * @param request the current servlet request (the session source)
     */
    public HttpSessionStore(HttpServletRequest request) {
        this.request = request;
    }

    @Override
    public @Nullable Object get(String key) {
        HttpSession session = request.getSession(false);
        return session == null ? null : session.getAttribute(key);
    }

    @Override
    public void put(String key, @Nullable Object value) {
        HttpSession session = request.getSession(true);
        if (value == null) {
            session.removeAttribute(key);
        } else {
            session.setAttribute(key, value);
        }
    }
}
