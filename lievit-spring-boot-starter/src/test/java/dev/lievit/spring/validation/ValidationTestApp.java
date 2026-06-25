/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.spring.validation;

import org.springframework.beans.factory.config.ConfigurableBeanFactory;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Scope;

/**
 * Minimal Spring Boot app for the real-time validation end-to-end test. Activates the lievit
 * autoconfiguration (which picks up Hibernate Validator via {@code spring-boot-starter-validation}
 * and auto-configures the {@code BeanValidationFieldValidator}) and registers
 * {@link RegistrationComponent} as a prototype bean.
 */
@SpringBootApplication
public class ValidationTestApp {

    /**
     * @return a fresh registration component per wire call
     */
    @Bean
    @Scope(ConfigurableBeanFactory.SCOPE_PROTOTYPE)
    RegistrationComponent registrationComponent() {
        return new RegistrationComponent();
    }

    /**
     * @return a fresh signup component per wire call (validation-depth test: imperative error bag +
     *     real-time per-field validation)
     */
    @Bean
    @Scope(ConfigurableBeanFactory.SCOPE_PROTOTYPE)
    SignupComponent signupComponent() {
        return new SignupComponent();
    }
}
