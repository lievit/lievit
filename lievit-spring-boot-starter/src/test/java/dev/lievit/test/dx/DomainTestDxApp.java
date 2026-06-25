/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.test.dx;

import org.springframework.beans.factory.config.ConfigurableBeanFactory;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Scope;

/**
 * Spring Boot app for the domain test-DX integration test: registers the form, table, and wizard
 * fixtures as prototype beans and activates the lievit autoconfiguration (which picks up Hibernate
 * Validator for the form fixture's validation).
 */
@SpringBootApplication
public class DomainTestDxApp {

    /** @return a fresh admin form per wire call */
    @Bean
    @Scope(ConfigurableBeanFactory.SCOPE_PROTOTYPE)
    AdminFormComponent adminFormComponent() {
        return new AdminFormComponent();
    }

    /** @return a fresh records table per wire call */
    @Bean
    @Scope(ConfigurableBeanFactory.SCOPE_PROTOTYPE)
    RecordsTableComponent recordsTableComponent() {
        return new RecordsTableComponent();
    }

    /** @return a fresh wizard per wire call */
    @Bean
    @Scope(ConfigurableBeanFactory.SCOPE_PROTOTYPE)
    WizardComponent wizardComponent() {
        return new WizardComponent();
    }
}
