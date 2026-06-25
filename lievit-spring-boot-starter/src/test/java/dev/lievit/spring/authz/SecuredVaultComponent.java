/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.spring.authz;

import static dev.lievit.dsl.H.div;
import static dev.lievit.dsl.H.span;
import static dev.lievit.dsl.H.text;

import org.springframework.security.access.prepost.PreAuthorize;

import dev.lievit.LievitAction;
import dev.lievit.LievitAuthorize;
import dev.lievit.LievitComponent;
import dev.lievit.LievitOn;
import dev.lievit.LievitRender;
import dev.lievit.Wire;
import dev.lievit.dsl.Html;

/**
 * A component exercising every authorization path the starter wires (ADR-0053, issue #57): a
 * {@code @LievitAuthorize} role check, a plain {@code @PreAuthorize}, an object-permission check via
 * {@code hasPermission(...)} (the {@code PermissionEvaluator} SPI), a stacked (repeated)
 * {@code @LievitAuthorize}, and a {@code @LievitOn} listener carrying authorization (the event-path
 * is not a bypass). The single-file {@code @LievitRender} keeps it template-free.
 */
@LievitComponent
public class SecuredVaultComponent {

    @Wire int opened;

    /** A "domain object" the PermissionEvaluator authorizes against; id 1 is updatable, 2 is not. */
    @Wire long invoiceId = 1L;

    @LievitRender
    Html view() {
        return div(span(text(String.valueOf(opened))).attr("data-opened", ""));
    }

    /** Allowed only for ROLE_ADMIN (the @LievitAuthorize role check). */
    @LievitAction
    @LievitAuthorize("hasRole('ADMIN')")
    void openAsAdmin() {
        this.opened++;
    }

    /** Allowed only for an authenticated principal (a plain @PreAuthorize, also honored). */
    @LievitAction
    @PreAuthorize("isAuthenticated()")
    void openWhenAuthenticated() {
        this.opened++;
    }

    /**
     * Allowed only when the PermissionEvaluator grants {@code update} on the component's own
     * {@code invoiceId} (the domain-policy analog, hasPermission via the SPI). {@code #this} is the
     * component instance, so the expression reads its {@code @Wire} state.
     */
    @LievitAction
    @LievitAuthorize("hasPermission(#root.this.invoiceId, 'Invoice', 'update')")
    void approveInvoice() {
        this.opened++;
    }

    /** Stacked authorization: BOTH must pass (logical AND of two @LievitAuthorize). */
    @LievitAction
    @LievitAuthorize("isAuthenticated()")
    @LievitAuthorize("hasRole('ADMIN')")
    void openWithStackedChecks() {
        this.opened++;
    }

    /** No annotation: always allowed (the permissive default, backward compatible). */
    @LievitAction
    void openFreely() {
        this.opened++;
    }

    /** An event listener carrying authorization: the event path must enforce it too. */
    @LievitOn("intrusion")
    @LievitAuthorize("hasRole('ADMIN')")
    void onIntrusion() {
        this.opened = 999;
    }

    /** Public getter so the SpEL {@code #this.invoiceId} resolves via the property accessor. */
    public long getInvoiceId() {
        return invoiceId;
    }
}
