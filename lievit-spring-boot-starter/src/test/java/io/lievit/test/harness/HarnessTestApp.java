/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package io.lievit.test.harness;

import org.springframework.beans.factory.config.ConfigurableBeanFactory;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Scope;

/**
 * Minimal Spring Boot app for the harness's own tests. Registers {@link GreeterComponent} as a
 * prototype bean (a fresh instance per stateless wire call, the snapshot the only carrier of state),
 * exactly as a real lievit app registers its components.
 */
@SpringBootApplication
public class HarnessTestApp {

    /**
     * @return a fresh greeter per wire call
     */
    @Bean
    @Scope(ConfigurableBeanFactory.SCOPE_PROTOTYPE)
    GreeterComponent greeterComponent() {
        return new GreeterComponent();
    }
}
