/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit.tenancy;

import java.util.List;
import java.util.Optional;

import org.jspecify.annotations.Nullable;

/**
 * The principal-side tenancy port (the Filament {@code HasTenants} + {@code HasDefaultTenant}
 * contracts on the {@code User} model): the host's authenticated principal declares which tenants it
 * belongs to and which is its default. The {@code canAccessTenant} gate is derived from membership.
 *
 * <p>The host implements this on its user type (or adapts one with a lambda over its own
 * membership). The kit reads it to build the tenant switcher, to gate a tenant switch, and to pick
 * the landing tenant.
 */
public interface HasTenants {

    /**
     * @return the tenants this principal may access, in display order (empty = no tenant access)
     */
    List<Tenant> tenants();

    /**
     * The tenant this principal lands on when none is in the url (the Filament {@code
     * getDefaultTenant}). Defaults to the first of {@link #tenants()}.
     *
     * @return the default tenant, or empty if the principal has no tenants
     */
    default Optional<Tenant> defaultTenant() {
        List<Tenant> tenants = tenants();
        return tenants.isEmpty() ? Optional.empty() : Optional.of(tenants.get(0));
    }

    /**
     * Whether this principal may access a tenant (the Filament {@code canAccessTenant}). Defaults to
     * membership: it may access exactly the tenants in {@link #tenants()}.
     *
     * @param tenant the tenant
     * @return {@code true} if the principal may access it
     */
    default boolean canAccessTenant(Tenant tenant) {
        return tenants().stream().anyMatch(t -> t.id().equals(tenant.id()));
    }

    /**
     * Resolves a tenant of this principal by id (for url resolution), only if accessible.
     *
     * @param tenantId the tenant id (or slug)
     * @return the accessible tenant, or empty if unknown / inaccessible
     */
    default Optional<Tenant> resolveTenant(@Nullable String tenantId) {
        if (tenantId == null) {
            return Optional.empty();
        }
        return tenants().stream()
                .filter(t -> t.id().equals(tenantId) || t.slug().equals(tenantId))
                .findFirst();
    }
}
