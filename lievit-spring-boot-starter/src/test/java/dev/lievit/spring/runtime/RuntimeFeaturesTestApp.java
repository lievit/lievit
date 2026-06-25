/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
package dev.lievit.spring.runtime;

import org.springframework.beans.factory.config.ConfigurableBeanFactory;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Scope;

/**
 * Minimal Spring Boot app for the Epic #34 server-side runtime-parity end-to-end test. Activates the
 * lievit autoconfiguration (whose default {@code LifecycleBus} registers the built-in runtime
 * listeners) and registers {@link RuntimeComponent} as a prototype bean.
 */
@SpringBootApplication
public class RuntimeFeaturesTestApp {

    /**
     * @return a fresh runtime component per wire call
     */
    @Bean
    @Scope(ConfigurableBeanFactory.SCOPE_PROTOTYPE)
    RuntimeComponent runtimeComponent() {
        return new RuntimeComponent();
    }
}
