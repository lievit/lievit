/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.spring;

import java.io.IOException;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.springframework.http.HttpHeaders;
import org.springframework.web.filter.OncePerRequestFilter;

import dev.lievit.component.LievitResponse;

/**
 * Adds the no-store headers to a page response when a lievit component on that request opted out of
 * the browser back-forward cache (issue #123, Livewire {@code SupportDisablingBackButtonCache}
 * parity). It binds a {@link LievitResponse} request-scoped sink around the request; a component's
 * {@code @LievitMount} calls {@link LievitResponse#disableBackButtonCache()} while the page renders;
 * after the handler builds the page, this filter reads the flag and, if set, stamps
 * {@code Cache-Control: no-cache, no-store, must-revalidate} (plus the legacy {@code Pragma} /
 * {@code Expires}) so a back-navigation re-fetches the page from the server instead of restoring a
 * stale snapshot of an authenticated view.
 *
 * <p>The headers are set in a response wrapper that defers the commit until just before the body is
 * written, so the flag (only known after the handler mounts the component) is read while the headers
 * are still mutable. The sink is cleared in a {@code finally}, so the flag resets per request and a
 * following non-lievit request stays bfcache-eligible (the issue's "resets per request" contract).
 */
public final class LievitBackButtonCacheFilter extends OncePerRequestFilter {

    @Override
    protected void doFilterInternal(
            HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        LievitResponse sink = new LievitResponse();
        LievitResponse.bind(sink);
        // Defer the response commit (header lock) until the first body write, then stamp the no-store
        // headers if a component opted out while rendering. The handler mounts the component (which may
        // call disableBackButtonCache()) before any body byte is written, so the flag is known in time.
        BeforeCommitResponse wrapped = new BeforeCommitResponse(response, sink);
        try {
            chain.doFilter(request, wrapped);
            // A handler that wrote nothing (an empty body, a 304) never tripped the wrapper's commit
            // hook; apply the headers here so the opt-out still lands.
            wrapped.applyBackButtonCacheHeadersIfNeeded();
        } finally {
            LievitResponse.clear();
        }
    }

    /** No-store cache directives stamped when a component opted out of bfcache (issue #123). */
    private static void stampNoStore(HttpServletResponse response) {
        response.setHeader(
                HttpHeaders.CACHE_CONTROL, "no-cache, no-store, must-revalidate");
        response.setHeader(HttpHeaders.PRAGMA, "no-cache");
        response.setHeader(HttpHeaders.EXPIRES, "0");
    }

    /**
     * A response wrapper that stamps the no-store headers just before the response is committed: the
     * commit happens on the first body write / flush, by which point the handler has already mounted
     * the component, so the back-button-cache flag is decided. Idempotent: the headers are applied at
     * most once.
     */
    private static final class BeforeCommitResponse
            extends jakarta.servlet.http.HttpServletResponseWrapper {

        private final LievitResponse sink;
        private boolean applied;

        BeforeCommitResponse(HttpServletResponse response, LievitResponse sink) {
            super(response);
            this.sink = sink;
        }

        @Override
        public jakarta.servlet.ServletOutputStream getOutputStream() throws IOException {
            applyBackButtonCacheHeadersIfNeeded();
            return super.getOutputStream();
        }

        @Override
        public java.io.PrintWriter getWriter() throws IOException {
            applyBackButtonCacheHeadersIfNeeded();
            return super.getWriter();
        }

        @Override
        public void flushBuffer() throws IOException {
            applyBackButtonCacheHeadersIfNeeded();
            super.flushBuffer();
        }

        void applyBackButtonCacheHeadersIfNeeded() {
            if (applied) {
                return;
            }
            applied = true;
            if (sink.isBackButtonCacheDisabled() && !isCommitted()) {
                stampNoStore((HttpServletResponse) getResponse());
            }
        }
    }
}
