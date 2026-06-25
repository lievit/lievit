/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit.tenancy;

import java.util.Objects;
import java.util.Optional;

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
    private @Nullable BillingProvider billingProvider;
    private boolean requiresSubscription;

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
     * Wires a billing provider for this panel (the Filament {@code tenantBillingProvider}). On its
     * own it only makes the provider available; the subscription gate fires only once
     * {@link #requiresSubscription()} is also declared.
     *
     * @param provider the adopter's billing provider
     * @return this config
     */
    public Tenancy billingProvider(BillingProvider provider) {
        this.billingProvider = Objects.requireNonNull(provider, "provider");
        return this;
    }

    /**
     * Declares that every tenant of this panel must hold an active subscription (the Filament
     * {@code requiresTenantSubscription}). Enables the {@link #subscriptionGate(Tenant)}.
     *
     * @return this config
     */
    public Tenancy requiresSubscription() {
        this.requiresSubscription = true;
        return this;
    }

    /** @return the wired billing provider, empty if none */
    public Optional<BillingProvider> billingProvider() {
        return Optional.ofNullable(billingProvider);
    }

    /** @return whether the panel requires a tenant subscription */
    public boolean isSubscriptionRequired() {
        return requiresSubscription;
    }

    /**
     * The subscription gate for a tenant: when the panel requires a subscription and a provider says
     * the tenant is not subscribed, returns the billing route the tenant must be sent to; otherwise
     * empty (the request proceeds). With no provider, or no subscription requirement, the gate never
     * blocks, so billing costs a non-billing panel nothing.
     *
     * @param tenant the active tenant
     * @return the billing route to redirect to, or empty to let the request through
     */
    public Optional<String> subscriptionGate(Tenant tenant) {
        Objects.requireNonNull(tenant, "tenant");
        if (!requiresSubscription || billingProvider == null) {
            return Optional.empty();
        }
        return billingProvider.isSubscribed(tenant)
                ? Optional.empty()
                : Optional.of(billingProvider.routeAction());
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
