/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.spring.security;

import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;
import org.springframework.security.access.PermissionEvaluator;
import org.springframework.security.access.expression.method.DefaultMethodSecurityExpressionHandler;
import org.springframework.security.access.expression.method.MethodSecurityExpressionHandler;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.web.SecurityFilterChain;

import io.lievit.component.ActionAuthorizer;

/**
 * Wires Spring Security as lievit's authorization backbone (ADR-0053 / ADR-0054, issues #57 / #179)
 * when {@code spring-boot-starter-security} is on the classpath (it is, by default, since the starter
 * depends on it). Three pieces, all backward-compatible by construction:
 *
 * <ol>
 *   <li>A <strong>permissive default {@link SecurityFilterChain}</strong> ({@code @ConditionalOnMissingBean}):
 *       it permits every request and exempts {@code /lievit/**} from CSRF (the wire endpoint's
 *       integrity is the snapshot HMAC, wire-protocol §3 / ADR-0001). This neutralizes Spring Boot's
 *       default lock-down (HTTP Basic on everything) that would otherwise break every existing
 *       starter test the moment Spring Security lands on the classpath. An app that declares its own
 *       chain (the documented secure convention, e.g. both bundled examples) replaces this one
 *       entirely. The wire endpoint thus sits INSIDE whichever chain is active, so authorization is
 *       re-evaluated on every wire POST (the Spring-native answer to #179's persistent middleware).</li>
 *   <li>A <strong>{@link MethodSecurityExpressionHandler}</strong> ({@code @ConditionalOnMissingBean}):
 *       the engine that evaluates {@link io.lievit.LievitAuthorize} / {@code @PreAuthorize} SpEL. When
 *       the host declares a {@link PermissionEvaluator} bean it is attached, so
 *       {@code hasPermission(#this.invoice, 'update')} resolves (the Laravel-Policy analog).</li>
 *   <li>The <strong>{@link SpringSecurityActionAuthorizer}</strong> ({@code @ConditionalOnMissingBean}
 *       for {@link ActionAuthorizer}): bound into the {@code WireDispatcher} by
 *       {@code LievitAutoConfiguration}. With no annotation on an action it permits (the permissive
 *       default); it enforces only where {@code @LievitAuthorize}/{@code @PreAuthorize} is declared.</li>
 * </ol>
 *
 * <p>Method-security on the components' own annotations (Spring's AOP {@code @EnableMethodSecurity})
 * is NOT force-enabled here: the {@code @LievitAction} dispatch runs through the
 * {@link SpringSecurityActionAuthorizer} (which evaluates the same annotations programmatically), so
 * enabling AOP method security is the adopter's choice for their non-wire service methods. Documented,
 * available, not forced.
 */
@AutoConfiguration
@ConditionalOnClass({SecurityFilterChain.class, HttpSecurity.class})
public class LievitSecurityAutoConfiguration {

    /**
     * The permissive default chain: present only when the application declares none, so it preserves
     * the pre-security allow-behavior and lets any app fully override it with its own chain.
     *
     * @param http the Spring Security HTTP builder
     * @return a chain that permits all requests and exempts {@code /lievit/**} from CSRF
     * @throws Exception if the builder fails
     */
    @Bean
    @ConditionalOnMissingBean(SecurityFilterChain.class)
    public SecurityFilterChain lievitPermissiveSecurityFilterChain(HttpSecurity http)
            throws Exception {
        http.authorizeHttpRequests(auth -> auth.anyRequest().permitAll())
                // The wire endpoint is integrity-protected by the snapshot HMAC, not a CSRF token
                // (ADR-0001); a state-changing POST there carries no CSRF token by design.
                .csrf(csrf -> csrf.ignoringRequestMatchers("/lievit/**"))
                // No login page is imposed by the framework default: an app that wants auth declares
                // its own chain. Disable the auto form login / basic so the default is genuinely open.
                .formLogin(AbstractHttpConfigurer::disable)
                .httpBasic(AbstractHttpConfigurer::disable)
                // Spring Security stamps a blanket no-store Cache-Control on every response; that
                // would defeat lievit's opt-in back-forward-cache model (issue #123, ADR-0051),
                // where a plain page stays bfcache-eligible and only a component that calls
                // disableBackButtonCache() opts out (via LievitBackButtonCacheFilter). In this
                // permissive default chain lievit owns cache-control; an app that brings its own
                // SecurityFilterChain keeps Spring Security's secure no-store default.
                .headers(headers -> headers.cacheControl(cache -> cache.disable()));
        return http.build();
    }

    /**
     * The method-security expression handler that evaluates {@code @LievitAuthorize}/{@code @PreAuthorize}
     * SpEL, with the host's {@link PermissionEvaluator} attached when one is present (so
     * {@code hasPermission(...)} works, the domain-policy analog).
     *
     * @param permissionEvaluator the host's permission evaluator, if any
     * @return the expression handler (overridable by the application)
     */
    @Bean
    @ConditionalOnMissingBean
    public MethodSecurityExpressionHandler lievitMethodSecurityExpressionHandler(
            ObjectProvider<PermissionEvaluator> permissionEvaluator) {
        DefaultMethodSecurityExpressionHandler handler = new DefaultMethodSecurityExpressionHandler();
        permissionEvaluator.ifAvailable(handler::setPermissionEvaluator);
        return handler;
    }

    /**
     * The Spring-Security-backed {@link ActionAuthorizer}, consumed by {@code LievitAutoConfiguration}
     * when it builds the {@code WireDispatcher}. {@code @ConditionalOnMissingBean} so an app can wire
     * a custom authorizer (e.g. an ABAC engine) and have the dispatcher use it instead.
     *
     * @param expressionHandler the method-security expression handler
     * @return the action authorizer
     */
    @Bean
    @ConditionalOnMissingBean(ActionAuthorizer.class)
    public ActionAuthorizer lievitActionAuthorizer(
            MethodSecurityExpressionHandler expressionHandler) {
        return new SpringSecurityActionAuthorizer(expressionHandler);
    }
}
