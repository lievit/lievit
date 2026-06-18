/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Repeatable;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Authorizes a {@link LievitAction} (or a {@link LievitOn} event listener) before it runs, by a
 * Spring Security expression (the Laravel {@code Gate} / Livewire {@code #[Authorize]} analog,
 * issue #57). A thin alias over Spring Security method-security SpEL: the {@code value()} is the
 * exact same expression language as {@code @PreAuthorize}, evaluated against the current
 * {@link org.springframework.security.core.Authentication Authentication} by the
 * {@code ActionAuthorizer} the host wires in (the starter binds a Spring-Security-backed one).
 *
 * <p>The dispatcher checks authorization <em>before</em> invoking the action (fail-closed: a deny is
 * a {@link io.lievit.wire.WireError#FORBIDDEN_ACTION}, the action never runs), on the {@code l:click}
 * path and on the {@code @LievitOn} event-listener path alike (the easy-to-miss bypass the Livewire
 * study flagged: authorization must be enforced identically whether a method is hit by a directive
 * or by an event). The check is re-evaluated on <em>every</em> wire update, never cached from mount
 * (issue #179: the page's persistent middleware analog for explicit per-action authorization).
 *
 * <p>Repeatable: stacking two {@code @LievitAuthorize} on one method requires <em>all</em> of them to
 * pass (logical AND), so a method can demand both a role and an object-permission. Plain
 * {@code @PreAuthorize} / {@code @PostAuthorize} on the same method are also honored by the starter's
 * authorizer; {@code @LievitAuthorize} is the lievit-named, repeatable, zero-Spring-on-core surface.
 *
 * <p>Examples:
 *
 * <pre>{@code
 * @LievitAction
 * @LievitAuthorize("hasRole('ADMIN')")
 * void deleteAll() { ... }
 *
 * @LievitAction
 * @LievitAuthorize("hasPermission(#root.this.invoice, 'update')")  // object permission via PermissionEvaluator
 * void approve() { ... }
 * }</pre>
 *
 * <p>The expression is evaluated exactly as {@code @PreAuthorize}: the SpEL root is Spring Security's
 * {@code MethodSecurityExpressionRoot} (so {@code hasRole}, {@code hasAuthority},
 * {@code isAuthenticated}, {@code hasPermission} resolve directly), and the component instance the
 * action runs on is reachable as {@code #root.this}, so an expression can authorize against the
 * component's own {@code @Wire} state ({@code hasPermission(#root.this.invoice, 'update')}). The
 * component property must be readable (a public getter). The expression is a SpEL string, not a Java
 * symbol, so it is engine-evaluated by the host's expression handler; nothing in lievit-core depends
 * on Spring (ADR-0007 boundary). This is the eighth annotation, deliberately admitted by the ADR
 * that supersedes ADR-0002: authorization is security-critical and cannot be expressed as
 * convention.
 */
@Documented
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
@Repeatable(LievitAuthorize.List.class)
public @interface LievitAuthorize {

    /**
     * @return the Spring Security authorization expression (same SpEL as {@code @PreAuthorize}); the
     *     action runs only if it evaluates to {@code true}
     */
    String value();

    /**
     * The container for repeated {@link LievitAuthorize} on one method (all must pass, logical AND).
     */
    @Documented
    @Target(ElementType.METHOD)
    @Retention(RetentionPolicy.RUNTIME)
    @interface List {
        /** @return the stacked authorization expressions */
        LievitAuthorize[] value();
    }
}
