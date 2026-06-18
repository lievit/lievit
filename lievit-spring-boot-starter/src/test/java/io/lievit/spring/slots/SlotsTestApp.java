/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.spring.slots;

import org.springframework.beans.factory.config.ConfigurableBeanFactory;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Scope;

/** Minimal Spring Boot app for the slots test (issue #91). */
@SpringBootApplication
public class SlotsTestApp {

    /** @return a fresh card host (parent) per wire call. */
    @Bean
    @Scope(ConfigurableBeanFactory.SCOPE_PROTOTYPE)
    CardHostComponent cardHostComponent() {
        return new CardHostComponent();
    }

    /** @return a fresh card (child) per wire call. */
    @Bean
    @Scope(ConfigurableBeanFactory.SCOPE_PROTOTYPE)
    CardComponent cardComponent() {
        return new CardComponent();
    }
}
