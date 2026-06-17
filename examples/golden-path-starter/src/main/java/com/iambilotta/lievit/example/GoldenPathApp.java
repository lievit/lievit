/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package com.iambilotta.lievit.example;

import com.iambilotta.lievit.EnableLievit;
import com.iambilotta.lievit.example.auth.RegisterComponent;
import com.iambilotta.lievit.example.notes.NoteListComponent;
import org.springframework.beans.factory.config.ConfigurableBeanFactory;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Scope;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;

/**
 * Golden-path example: demonstrates register, login, dashboard, and a notes CRUD component.
 *
 * <p>Each lievit component is a <strong>prototype</strong> bean: a fresh instance per wire call, so
 * no state leaks between calls. The snapshot is the only carrier of state (ADR-0001).
 */
@SpringBootApplication
@EnableLievit
public class GoldenPathApp {

    public static void main(String[] args) {
        SpringApplication.run(GoldenPathApp.class, args);
    }

    /**
     * RegisterComponent needs collaborators; the factory method injects them from the context,
     * which is the correct pattern when a prototype bean has dependencies.
     *
     * @param jdbc the JDBC template for the user store
     * @param encoder the BCrypt encoder from SecurityConfig
     * @return a fresh RegisterComponent per wire call
     */
    @Bean
    @Scope(ConfigurableBeanFactory.SCOPE_PROTOTYPE)
    RegisterComponent registerComponent(JdbcTemplate jdbc, PasswordEncoder encoder) {
        return new RegisterComponent(jdbc, encoder);
    }

    /**
     * @return a fresh NoteListComponent per wire call (state lives in the snapshot)
     */
    @Bean
    @Scope(ConfigurableBeanFactory.SCOPE_PROTOTYPE)
    NoteListComponent noteListComponent() {
        return new NoteListComponent();
    }
}
