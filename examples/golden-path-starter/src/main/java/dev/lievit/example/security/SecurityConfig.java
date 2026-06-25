/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.example.security;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;

/**
 * Spring Security configuration for the golden-path demo:
 * <ul>
 *   <li>Form login at /login, redirecting to /dashboard on success.</li>
 *   <li>CSRF enabled for all routes; the lievit wire endpoint (/lievit/**) is exempted because
 *       the snapshot-HMAC is the integrity guarantee (wire-protocol §3 / ADR-0001).</li>
 *   <li>UserDetailsService backed by the H2 users table (no Spring Security's schema).</li>
 * </ul>
 */
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .authorizeHttpRequests(auth -> auth
                // Public: login, registration, and the lievit wire endpoint.
                .requestMatchers("/login", "/register", "/lievit/**").permitAll()
                // Everything else requires authentication.
                .anyRequest().authenticated()
            )
            .formLogin(form -> form
                .loginPage("/login")
                .defaultSuccessUrl("/dashboard", true)
                .permitAll()
            )
            .logout(logout -> logout
                .logoutSuccessUrl("/login?logout")
                .permitAll()
            )
            .csrf(csrf -> csrf
                // The lievit wire endpoint is protected by the snapshot HMAC; no CSRF token needed.
                .ignoringRequestMatchers("/lievit/**")
            );
        return http.build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(12);
    }

    @Bean
    public UserDetailsService userDetailsService(JdbcTemplate jdbc) {
        return username -> {
            var rows = jdbc.queryForList(
                    "SELECT username, password_hash FROM users WHERE username = ?", username);
            if (rows.isEmpty()) {
                throw new UsernameNotFoundException("User not found: " + username);
            }
            var row = rows.get(0);
            return User.builder()
                    .username((String) row.get("username"))
                    .password((String) row.get("password_hash"))
                    .roles("USER")
                    .build();
        };
    }
}
