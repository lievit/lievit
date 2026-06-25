/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.spring.dsl;

import org.springframework.beans.factory.config.ConfigurableBeanFactory;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Scope;

/**
 * Minimal Spring Boot app for the single-file-DSL end-to-end test. Registers {@link
 * DslCounterComponent} as a prototype bean (a fresh instance per stateless wire call), exactly as a
 * real lievit app registers its components. No JTE template is needed: the DSL component renders
 * itself through the DSL adapter the starter autoconfigures (ADR-0018).
 */
@SpringBootApplication
public class DslTestApp {

    /**
     * @return a fresh DSL counter per wire call
     */
    @Bean
    @Scope(ConfigurableBeanFactory.SCOPE_PROTOTYPE)
    DslCounterComponent dslCounterComponent() {
        return new DslCounterComponent();
    }
}
