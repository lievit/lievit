/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit.tenancy;

import java.util.Objects;
import java.util.Optional;

import org.jspecify.annotations.Nullable;

/**
 * The active tenant resolved for the current request (the Filament {@code Filament::getTenant()}),
 * plus the principal it belongs to. The host's middleware resolves it (from the url or the default)
 * and hands it to the kit; a resource then scopes its records to {@link #tenant()} through its {@link
 * TenantScope}.
 *
 * @param tenant the active tenant
 * @param principal the principal the tenant was resolved for (for ownership of created records)
 */
public record TenantContext(Tenant tenant, @Nullable Object principal) {

    /** Compact constructor: defends the tenant. */
    public TenantContext {
        Objects.requireNonNull(tenant, "tenant");
    }

    /**
     * Resolves the tenant context for a request: the tenant named in the url if the principal may
     * access it, else the principal's default tenant, else empty (the Filament IdentifyTenant
     * middleware resolution). Refusing an inaccessible tenant is the isolation guarantee: a url
     * cannot grant access membership does not.
     *
     * @param principal the authenticated principal implementing {@link HasTenants}
     * @param requestedTenantId the tenant id/slug from the url, or {@code null} if none
     * @return the resolved context, or empty if the principal has no accessible tenant
     */
    public static Optional<TenantContext> resolve(
            HasTenants principal, @Nullable String requestedTenantId) {
        Objects.requireNonNull(principal, "principal");
        Optional<Tenant> requested = principal.resolveTenant(requestedTenantId);
        if (requested.isPresent()) {
            return Optional.of(new TenantContext(requested.get(), principal));
        }
        return principal.defaultTenant().map(t -> new TenantContext(t, principal));
    }
}
