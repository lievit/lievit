/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.example.admin.security;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.provisioning.InMemoryUserDetailsManager;
import org.springframework.security.web.SecurityFilterChain;

/**
 * Spring Security for the admin demo: form login, a single in-memory {@code admin}/{@code admin}
 * user, and the lievit wire endpoint covered by the same filter chain as the pages (wire-protocol
 * §7). CSRF is enabled for the MVC forms; the wire endpoint is exempted because the snapshot HMAC is
 * its integrity guarantee (wire-protocol §3 / ADR-0001).
 */
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http.authorizeHttpRequests(
                        auth ->
                                auth.requestMatchers("/login", "/lievit/**")
                                        .permitAll()
                                        .anyRequest()
                                        .authenticated())
                .formLogin(form -> form.defaultSuccessUrl("/admin/products", true).permitAll())
                .logout(logout -> logout.logoutSuccessUrl("/login?logout").permitAll())
                // The wire endpoint is protected by the snapshot HMAC, not a CSRF token.
                .csrf(csrf -> csrf.ignoringRequestMatchers("/lievit/**"));
        return http.build();
    }

    @Bean
    @SuppressWarnings("deprecation")
    public UserDetailsService userDetailsService() {
        // {noop} keeps the demo password in plain text; a real app uses BCrypt.
        User.UserBuilder builder = User.withDefaultPasswordEncoder();
        return new InMemoryUserDetailsManager(
                builder.username("admin").password("admin").roles("ADMIN").build());
    }
}
