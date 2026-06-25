/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.spring.islands;

import org.springframework.beans.factory.config.ConfigurableBeanFactory;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Scope;

/** Minimal Spring Boot app for the island-targeting test (issue #89 server half). */
@SpringBootApplication
public class IslandsTestApp {

    /** @return a fresh island component per wire call. */
    @Bean
    @Scope(ConfigurableBeanFactory.SCOPE_PROTOTYPE)
    IslandComponent islandComponent() {
        return new IslandComponent();
    }
}
