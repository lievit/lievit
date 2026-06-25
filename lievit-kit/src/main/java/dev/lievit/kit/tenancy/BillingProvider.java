/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.kit.tenancy;

/**
 * The billing hook a subscription-gated panel calls (the Filament panels
 * {@code Billing/Providers/Contracts/BillingProvider} carried over): where to send a tenant to
 * manage billing ({@link #routeAction()}, the Filament {@code getRouteAction}) and whether a tenant
 * currently has an active subscription ({@link #isSubscribed(Tenant)}, the Java idiom of the
 * Filament {@code getSubscribedMiddleware} gate).
 *
 * <p>This is an abstraction ONLY: the kit ships no payment-vendor coupling. An adopter implements it
 * over their own provider (Stripe, Paddle, an internal ledger) and wires it through {@link
 * Tenancy#billingProvider(BillingProvider)}; the gate fires only when the panel also declares
 * {@link Tenancy#requiresSubscription()}. The {@link #noop()} default subscribes everyone, so the
 * abstraction is free until a real provider is present, the Filament "lowest priority, pays off only
 * with tenancy + a concrete provider" lesson.
 */
public interface BillingProvider {

    /**
     * @return the route an unsubscribed tenant is sent to in order to subscribe / manage billing
     *     (the Filament {@code getRouteAction})
     */
    String routeAction();

    /**
     * @param tenant the tenant whose subscription is checked
     * @return whether the tenant has an active subscription (the Filament subscribed gate)
     */
    boolean isSubscribed(Tenant tenant);

    /**
     * @return the no-op provider: a {@code /billing} route action and every tenant subscribed, so a
     *     panel that wires it (or wires nothing) is never gated until a real provider replaces it
     */
    static BillingProvider noop() {
        return new BillingProvider() {
            @Override
            public String routeAction() {
                return "/billing";
            }

            @Override
            public boolean isSubscribed(Tenant tenant) {
                return true;
            }
        };
    }
}
