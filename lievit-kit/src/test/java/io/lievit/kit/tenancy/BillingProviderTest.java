/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.kit.tenancy;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

/**
 * Specifies the {@link BillingProvider} SPI and its wiring through {@link Tenancy}: a pluggable
 * billing hook (a route action to send an unsubscribed tenant to + a subscription check), shipping a
 * no-op default so the abstraction costs an adopter nothing until a concrete provider is wired and
 * the panel requires a subscription.
 */
class BillingProviderTest {

    /**
     * @spec.given the no-op default billing provider
     * @spec.when  a tenant's subscription is checked
     * @spec.then  every tenant is treated as subscribed (no gating without a real provider)
     */
    @Test
    void the_default_provider_subscribes_everyone() {
        BillingProvider provider = BillingProvider.noop();

        assertThat(provider.isSubscribed(Tenant.of("acme", "Acme"))).isTrue();
        assertThat(provider.routeAction()).isEqualTo("/billing");
    }

    /**
     * @spec.given a stub provider that subscribes only one tenant, wired through tenancy with
     *     subscription required
     * @spec.when  a subscribed and an unsubscribed tenant are gated
     * @spec.then  the subscribed tenant is allowed and the unsubscribed one is redirected to billing
     */
    @Test
    void a_provider_gates_a_subscription_required_route() {
        BillingProvider provider =
                new BillingProvider() {
                    @Override
                    public String routeAction() {
                        return "/app/billing/subscribe";
                    }

                    @Override
                    public boolean isSubscribed(Tenant tenant) {
                        return tenant.id().equals("paid");
                    }
                };

        Tenancy tenancy =
                Tenancy.enabled().billingProvider(provider).requiresSubscription();

        assertThat(tenancy.isSubscriptionRequired()).isTrue();
        assertThat(tenancy.billingProvider()).contains(provider);

        Tenant paid = Tenant.of("paid", "Paid Co");
        Tenant free = Tenant.of("free", "Free Co");

        // The gate: a required subscription lets a subscribed tenant through and redirects the rest.
        assertThat(tenancy.subscriptionGate(paid)).isEmpty();
        assertThat(tenancy.subscriptionGate(free)).contains("/app/billing/subscribe");
    }

    /**
     * @spec.given a tenancy with a billing provider but subscription NOT required
     * @spec.when  an unsubscribed tenant is gated
     * @spec.then  it passes (a provider present but not required imposes no gate)
     */
    @Test
    void no_gate_when_subscription_not_required() {
        Tenancy tenancy = Tenancy.enabled().billingProvider(BillingProvider.noop());

        assertThat(tenancy.isSubscriptionRequired()).isFalse();
        assertThat(tenancy.subscriptionGate(Tenant.of("any", "Any"))).isEmpty();
    }

    /**
     * @spec.given a plain tenancy with no billing provider configured
     * @spec.when  the billing provider is read
     * @spec.then  it is empty and no gate applies (billing pays off only with a provider)
     */
    @Test
    void tenancy_has_no_billing_provider_by_default() {
        Tenancy tenancy = Tenancy.enabled();

        assertThat(tenancy.billingProvider()).isEmpty();
        assertThat(tenancy.subscriptionGate(Tenant.of("any", "Any"))).isEmpty();
    }
}
