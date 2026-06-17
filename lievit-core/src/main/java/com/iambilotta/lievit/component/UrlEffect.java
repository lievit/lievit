/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package com.iambilotta.lievit.component;

import com.iambilotta.lievit.LievitUrl.History;

/**
 * The {@code url} effect: the server's instruction to the client to update the browser's URL query
 * string via the History API after a wire call (ADR-0012, the URL-binding feature). It rides in the
 * {@code Lievit-Effects} header alongside any {@code redirect} / {@code dispatch} / {@code returns}.
 *
 * <p>The effect carries <strong>only the query string</strong> (the part after {@code ?}, without
 * the leading {@code ?}), never a host, scheme, or path. The client merges it onto the current
 * {@code location.pathname} and calls {@code history.pushState({}, '', pathname + '?' + query)} when
 * {@link #history()} is {@link History#PUSH}, or {@code history.replaceState(...)} when it is
 * {@link History#REPLACE}. Because the server never emits a destination, the effect can never be an
 * open redirect: it updates the address bar, it does not navigate.
 *
 * <p>An empty {@link #query()} means "the URL should have no query parameters"; the client writes
 * just the pathname (dropping the {@code ?}).
 *
 * @param query the URL-encoded query string (no leading {@code ?}), already escaped per key=value
 *     pair; empty to clear all parameters
 * @param history whether the client pushes a new history entry or replaces the current one
 */
public record UrlEffect(String query, History history) {

    /**
     * @param query the encoded query string (must be non-null; may be empty)
     */
    public UrlEffect {
        if (query == null) {
            throw new IllegalArgumentException("url effect query must be non-null (use \"\" to clear)");
        }
    }
}
