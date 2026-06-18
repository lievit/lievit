/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.spring.authz;

import java.io.Serializable;

import org.springframework.beans.factory.config.ConfigurableBeanFactory;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Scope;
import org.springframework.security.access.PermissionEvaluator;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.provisioning.InMemoryUserDetailsManager;
import org.springframework.security.web.SecurityFilterChain;

/**
 * The authorization end-to-end test app (ADR-0053, issue #57): it declares its OWN
 * {@link SecurityFilterChain} (so it replaces the starter's permissive default and proves the
 * documented secure convention) and a {@link PermissionEvaluator} (so {@code hasPermission(...)} in
 * a {@code @LievitAuthorize} resolves, the domain-policy analog). The chain leaves {@code /lievit/**}
 * permitAll at the URL level: per-action authorization is what {@code @LievitAuthorize} enforces
 * (issue #57), distinct from URL-level protection (issue #179).
 */
@SpringBootApplication
@EnableWebSecurity
public class AuthzTestApp {

    @Bean
    @Scope(ConfigurableBeanFactory.SCOPE_PROTOTYPE)
    SecuredVaultComponent securedVaultComponent() {
        return new SecuredVaultComponent();
    }

    @Bean
    SecurityFilterChain authzFilterChain(HttpSecurity http) throws Exception {
        http.authorizeHttpRequests(auth -> auth.requestMatchers("/lievit/**").permitAll()
                        .anyRequest().authenticated())
                .csrf(csrf -> csrf.ignoringRequestMatchers("/lievit/**"));
        return http.build();
    }

    @Bean
    @SuppressWarnings("deprecation")
    UserDetailsService userDetailsService() {
        User.UserBuilder builder = User.withDefaultPasswordEncoder();
        return new InMemoryUserDetailsManager(
                builder.username("admin").password("admin").roles("ADMIN").build(),
                User.withDefaultPasswordEncoder()
                        .username("clerk")
                        .password("clerk")
                        .roles("USER")
                        .build());
    }

    /**
     * A toy {@link PermissionEvaluator}: grants {@code update} on {@code Invoice} id 1 only, for any
     * authenticated user. Proves the SPI is wired so {@code hasPermission(#this.invoiceId, 'Invoice',
     * 'update')} reaches it (the Laravel-Policy / domain-object check analog, issue #57).
     */
    @Bean
    PermissionEvaluator invoicePermissionEvaluator() {
        return new PermissionEvaluator() {
            @Override
            public boolean hasPermission(
                    Authentication authentication, Object targetDomainObject, Object permission) {
                return false; // only the id-based form is used in this test
            }

            @Override
            public boolean hasPermission(
                    Authentication authentication,
                    Serializable targetId,
                    String targetType,
                    Object permission) {
                return authentication != null
                        && authentication.isAuthenticated()
                        && "Invoice".equals(targetType)
                        && "update".equals(permission)
                        && Long.valueOf(1L).equals(toLong(targetId));
            }

            private Long toLong(Serializable id) {
                return (id instanceof Number n) ? n.longValue() : null;
            }
        };
    }
}
