/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.spring;

/**
 * Centralizes the wire URI prefix and the per-purpose paths (update, the per-component call, the
 * runtime script/map) so they are computed in one place instead of being hardcoded across the
 * controllers (issue #177, Livewire {@code Mechanisms\HandleRequests\HandleRequests} +
 * {@code FrontendAssets} URI assembly).
 *
 * <p>Livewire centralizes the URI assembly so a single {@code lievit.endpoint-prefix} relocates the
 * whole wire surface (update endpoint, runtime asset) without touching the controllers or the client
 * bundle's hardcoded paths. The default prefix is {@code /lievit}, matching the original ADR-0001
 * per-component endpoint, so the batch endpoint and the legacy per-component endpoint share one root.
 *
 * <p>Pure data + string assembly, zero Spring: the controller asks the resolver for its mapping, and
 * the auto-configuration exposes the resolved paths to the client via the asset block.
 */
public final class EndpointResolver {

    /** The default wire URI prefix (ADR-0001 parity: the per-component endpoint lived under it). */
    public static final String DEFAULT_PREFIX = "/lievit";

    private final String prefix;

    /**
     * @param prefix the wire URI prefix (e.g. {@code /lievit}); a trailing slash is stripped so the
     *     assembled paths never double a slash
     */
    public EndpointResolver(String prefix) {
        String trimmed = prefix == null || prefix.isBlank() ? DEFAULT_PREFIX : prefix.trim();
        this.prefix = trimmed.endsWith("/") ? trimmed.substring(0, trimmed.length() - 1) : trimmed;
    }

    /** @return the resolver bound to the default {@code /lievit} prefix. */
    public static EndpointResolver defaults() {
        return new EndpointResolver(DEFAULT_PREFIX);
    }

    /** @return the wire URI prefix, never with a trailing slash. */
    public String prefix() {
        return prefix;
    }

    /**
     * The single batched update endpoint (issue #177): {@code POST {prefix}/update}. A page with
     * several islands commits them all in one request against this path.
     *
     * @return the update path
     */
    public String updatePath() {
        return prefix + "/update";
    }

    /**
     * The legacy per-component call endpoint (ADR-0001): {@code POST {prefix}/{id}/call}. Kept for
     * the single-component fast path; the batch endpoint is the page-level transport.
     *
     * @return the per-component call path template
     */
    public String callPath() {
        return prefix + "/{componentId}/call";
    }
}
