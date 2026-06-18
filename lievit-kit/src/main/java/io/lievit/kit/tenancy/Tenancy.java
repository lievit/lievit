/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit.tenancy;

import java.util.Objects;

import org.jspecify.annotations.Nullable;

/**
 * The opt-in tenancy configuration of a panel (the Filament {@code Panel::tenant(...)} bundle): the
 * tenant route segment, whether the registration and profile pages are offered, and the tenant
 * switcher's label. A panel turns tenancy on by handing one of these to {@code Panel.tenancy(...)};
 * without it the panel is single-tenant, so tenancy never costs a non-tenant app anything.
 *
 * <p>Routing model: path-based ({@code /{panel}/{tenant-slug}/...}). The {@code routePrefix} segment
 * sits between the panel path and the resource slug; the tenant switcher and the resolved {@link
 * TenantContext} fill it.
 */
public final class Tenancy {

    private final String routeParameter;

    private boolean registration;
    private boolean profile;
    private @Nullable String switcherLabel;

    private Tenancy(String routeParameter) {
        this.routeParameter = Objects.requireNonNull(routeParameter, "routeParameter");
    }

    /**
     * Enables tenancy with the default {@code "tenant"} route parameter.
     *
     * @return a tenancy config
     */
    public static Tenancy enabled() {
        return new Tenancy("tenant");
    }

    /**
     * Enables tenancy with an explicit route parameter name (for example {@code "team"} →
     * {@code /app/{team}/...}).
     *
     * @param routeParameter the tenant route parameter name
     * @return a tenancy config
     */
    public static Tenancy withRouteParameter(String routeParameter) {
        return new Tenancy(routeParameter);
    }

    /**
     * Offers the tenant registration page (create-a-new-tenant), the Filament {@code
     * tenantRegistration}.
     *
     * @return this config
     */
    public Tenancy registration() {
        this.registration = true;
        return this;
    }

    /**
     * Offers the tenant profile page (edit-the-current-tenant), the Filament {@code tenantProfile}.
     *
     * @return this config
     */
    public Tenancy profile() {
        this.profile = true;
        return this;
    }

    /**
     * Sets the tenant-switcher label (defaults to the active tenant's name).
     *
     * @param label the switcher label
     * @return this config
     */
    public Tenancy switcherLabel(String label) {
        this.switcherLabel = Objects.requireNonNull(label, "label");
        return this;
    }

    /** @return the tenant route parameter name */
    public String routeParameter() {
        return routeParameter;
    }

    /** @return whether the tenant registration page is offered */
    public boolean hasRegistration() {
        return registration;
    }

    /** @return whether the tenant profile page is offered */
    public boolean hasProfile() {
        return profile;
    }

    /** @return the configured switcher label, or {@code null} to default to the tenant name */
    public @Nullable String switcherLabel() {
        return switcherLabel;
    }

    /**
     * Builds the tenant-relative route prefix for a panel + active tenant: {@code
     * /{panelPath}/{tenant-slug}}.
     *
     * @param panelPath the panel route prefix
     * @param tenant the active tenant
     * @return the tenant-scoped route prefix
     */
    public String prefix(String panelPath, Tenant tenant) {
        return "/" + panelPath + "/" + tenant.slug();
    }

    /**
     * Builds the tenant-switcher view-model for a principal: an entry per accessible tenant, the
     * active one marked, each linking to that tenant's panel root.
     *
     * @param panelPath the panel route prefix
     * @param principal the principal whose tenants populate the switcher
     * @param active the active tenant
     * @return the switcher menu
     */
    public TenantMenu switcher(String panelPath, HasTenants principal, Tenant active) {
        return TenantMenu.build(this, panelPath, principal, active);
    }
}
