/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package com.iambilotta.lievit.kit;

import org.jspecify.annotations.Nullable;

/**
 * The authorization seam at the action / mount boundary (the load-bearing filament-internals.md
 * lesson: "Authorization belongs at the Resource/Page boundary, not scattered in the view";
 * Filament calls {@code authorizeAccess()} in {@code mount()} on every page).
 *
 * <p>v0.1 ships the <em>seam</em>, not a policy engine: the kit always asks before a write, the host
 * app decides. The default {@link #permitAll()} allows everything (so the skeleton runs); a real
 * deployment supplies a bean that delegates to the host's authorization (Spring Security
 * {@code AuthorizationManager}, a domain policy, an ABAC check). Because the kit funnels every write
 * through here, wiring the host's policy later is a one-bean change, not a scatter-edit across pages.
 *
 * <p>The full per-record policy layer (Filament's {@code HasAuthorization} with row-level gates)
 * lands in a later wave; this interface already accepts the optional record so that layer slots in
 * without a signature break.
 */
@FunctionalInterface
public interface AdminAuthorizer {

    /**
     * Decides whether the current principal may perform {@code operation} on {@code resource},
     * optionally against a specific {@code record}.
     *
     * @param operation the operation about to run
     * @param resource the resource it targets
     * @param record the specific record for a row-scoped operation (edit / delete), or {@code null}
     *     for a resource-scoped one (view list / create)
     * @return {@code true} to allow, {@code false} to deny
     */
    boolean isAllowed(AdminOperation operation, Resource<?> resource, @Nullable Object record);

    /**
     * @return an authorizer that allows every operation (the v0.1 default; a real deployment
     *     replaces it with one bound to the host's authorization)
     */
    static AdminAuthorizer permitAll() {
        return (operation, resource, record) -> true;
    }
}
